use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};

use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;
use tauri::Emitter;

struct PtyInstance {
    writer: Mutex<Box<dyn Write + Send>>,
    #[allow(dead_code)]
    master: Mutex<Box<dyn MasterPty + Send>>,
    buffered_output: Mutex<String>,
    is_attached: Mutex<bool>,
    has_exited: Mutex<bool>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PtyAttachState {
    pub buffered_output: String,
    pub has_exited: bool,
}

pub struct PtyManager {
    instances: Mutex<HashMap<String, Arc<PtyInstance>>>,
    next_id: Mutex<u32>,
}

impl PtyManager {
    pub fn new() -> Self {
        Self {
            instances: Mutex::new(HashMap::new()),
            next_id: Mutex::new(0),
        }
    }

    pub fn create(
        &self,
        rows: u16,
        cols: u16,
        cwd: Option<String>,
        app_handle: tauri::AppHandle,
    ) -> Result<String, String> {
        let id = {
            let mut next = self.next_id.lock().unwrap();
            *next += 1;
            format!("pty-{}", *next)
        };

        let pty_system = native_pty_system();
        let pair = pty_system
            .openpty(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| e.to_string())?;

        let mut cmd = Self::default_shell();
        if let Some(ref dir) = cwd {
            cmd.cwd(dir);
        }

        let _child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;
        drop(pair.slave);

        let reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
        let writer = pair.master.take_writer().map_err(|e| e.to_string())?;

        let instance = Arc::new(PtyInstance {
            writer: Mutex::new(writer),
            master: Mutex::new(pair.master),
            buffered_output: Mutex::new(String::new()),
            is_attached: Mutex::new(false),
            has_exited: Mutex::new(false),
        });

        {
            let mut instances = self.instances.lock().unwrap();
            instances.insert(id.clone(), Arc::clone(&instance));
        }

        // Spawn a thread to read PTY output and emit events to the frontend
        let pty_id = id.clone();
        std::thread::spawn(move || {
            Self::read_loop(reader, instance, pty_id, app_handle);
        });

        Ok(id)
    }

    pub fn attach(&self, id: &str) -> Result<PtyAttachState, String> {
        let instances = self.instances.lock().unwrap();
        let instance = instances.get(id).ok_or("PTY not found")?;

        {
            let mut is_attached = instance.is_attached.lock().unwrap();
            *is_attached = true;
        }

        let buffered_output = {
            let mut buffered_output = instance.buffered_output.lock().unwrap();
            std::mem::take(&mut *buffered_output)
        };

        let has_exited = *instance.has_exited.lock().unwrap();

        Ok(PtyAttachState {
            buffered_output,
            has_exited,
        })
    }

    pub fn write(&self, id: &str, data: &[u8]) -> Result<(), String> {
        let instances = self.instances.lock().unwrap();
        let instance = instances.get(id).ok_or("PTY not found")?;
        let mut writer = instance.writer.lock().unwrap();
        writer.write_all(data).map_err(|e| e.to_string())?;
        writer.flush().map_err(|e| e.to_string())
    }

    pub fn resize(&self, id: &str, rows: u16, cols: u16) -> Result<(), String> {
        let instances = self.instances.lock().unwrap();
        let instance = instances.get(id).ok_or("PTY not found")?;
        let master = instance.master.lock().unwrap();
        master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| e.to_string())
    }

    pub fn close(&self, id: &str) -> Result<(), String> {
        let mut instances = self.instances.lock().unwrap();
        instances.remove(id).ok_or_else(|| "PTY not found".to_string())?;
        Ok(())
    }

    fn read_loop(
        mut reader: Box<dyn Read + Send>,
        instance: Arc<PtyInstance>,
        pty_id: String,
        app_handle: tauri::AppHandle,
    ) {
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let data = String::from_utf8_lossy(&buf[..n]).to_string();
                    let is_attached = *instance.is_attached.lock().unwrap();
                    if is_attached {
                        let _ = app_handle.emit(&format!("pty-output-{}", pty_id), &data);
                    } else {
                        let mut buffered_output =
                            instance.buffered_output.lock().unwrap();
                        buffered_output.push_str(&data);
                    }
                }
                Err(_) => break,
            }
        }
        {
            let mut has_exited = instance.has_exited.lock().unwrap();
            *has_exited = true;
        }

        if *instance.is_attached.lock().unwrap() {
            let _ = app_handle.emit(&format!("pty-exit-{}", pty_id), ());
        }
    }

    #[cfg(target_os = "windows")]
    fn default_shell() -> CommandBuilder {
        CommandBuilder::new("powershell.exe")
    }

    #[cfg(not(target_os = "windows"))]
    fn default_shell() -> CommandBuilder {
        let shell =
            std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string());
        CommandBuilder::new(shell)
    }
}
