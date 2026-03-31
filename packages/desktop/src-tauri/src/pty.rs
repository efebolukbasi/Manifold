use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};

use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use tauri::Emitter;

struct PtyInstance {
    writer: Mutex<Box<dyn Write + Send>>,
    #[allow(dead_code)]
    master: Mutex<Box<dyn MasterPty + Send>>,
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
        });

        {
            let mut instances = self.instances.lock().unwrap();
            instances.insert(id.clone(), instance);
        }

        // Spawn a thread to read PTY output and emit events to the frontend
        let pty_id = id.clone();
        std::thread::spawn(move || {
            Self::read_loop(reader, pty_id, app_handle);
        });

        Ok(id)
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
        pty_id: String,
        app_handle: tauri::AppHandle,
    ) {
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let data = String::from_utf8_lossy(&buf[..n]).to_string();
                    let _ = app_handle.emit(&format!("pty-output-{}", pty_id), &data);
                }
                Err(_) => break,
            }
        }
        let _ = app_handle.emit(&format!("pty-exit-{}", pty_id), ());
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
