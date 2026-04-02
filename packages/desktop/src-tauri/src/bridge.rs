use std::collections::{HashMap, VecDeque};
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::{Arc, Mutex};

use serde_json::Value;
use tauri::Emitter;
use tokio::sync::oneshot;

// ── Manager ─────────────────────────────────────────────────────────

pub struct BridgeManager {
    child: Mutex<Option<Child>>,
    stdin: Mutex<Option<Box<dyn Write + Send>>>,
    pending: Arc<Mutex<HashMap<String, oneshot::Sender<Value>>>>,
    stderr_tail: Arc<Mutex<VecDeque<String>>>,
    next_id: AtomicU32,
}

impl BridgeManager {
    pub fn new() -> Self {
        Self {
            child: Mutex::new(None),
            stdin: Mutex::new(None),
            pending: Arc::new(Mutex::new(HashMap::new())),
            stderr_tail: Arc::new(Mutex::new(VecDeque::with_capacity(16))),
            next_id: AtomicU32::new(1),
        }
    }

    fn next_req_id(&self) -> String {
        let id = self.next_id.fetch_add(1, Ordering::SeqCst);
        format!("req-{}", id)
    }

    /// Spawn the Node.js bridge process and start the stdout reader thread.
    pub fn spawn(
        &self,
        bridge_script: &str,
        app_handle: tauri::AppHandle,
    ) -> Result<(), String> {
        let mut child_guard = self.child.lock().map_err(|e| e.to_string())?;

        // Kill existing process if any
        if let Some(ref mut child) = *child_guard {
            let _ = child.kill();
        }

        if let Ok(mut tail) = self.stderr_tail.lock() {
            tail.clear();
        }

        let mut child = Command::new("node")
            .arg("--eval")
            .arg("require(process.argv[1])")
            .arg(bridge_script)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to spawn bridge process: {}. Is Node.js installed?", e))?;

        let stdout = child
            .stdout
            .take()
            .ok_or("Failed to capture bridge stdout")?;
        let stderr = child
            .stderr
            .take()
            .ok_or("Failed to capture bridge stderr")?;
        let child_stdin = child
            .stdin
            .take()
            .ok_or("Failed to capture bridge stdin")?;

        *child_guard = Some(child);
        drop(child_guard);

        *self.stdin.lock().map_err(|e| e.to_string())? = Some(Box::new(child_stdin));

        // Capture bridge stderr so packaged startup failures can be surfaced in the UI.
        let stderr_tail = Arc::clone(&self.stderr_tail);
        std::thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines() {
                let line = match line {
                    Ok(l) => l,
                    Err(_) => break,
                };

                eprintln!("[bridge] {}", line);

                if let Ok(mut tail) = stderr_tail.lock() {
                    if tail.len() >= 16 {
                        tail.pop_front();
                    }
                    tail.push_back(line);
                }
            }
        });

        // Spawn reader thread
        let pending = Arc::clone(&self.pending);
        let stderr_tail = Arc::clone(&self.stderr_tail);
        std::thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                let line = match line {
                    Ok(l) => l,
                    Err(_) => break, // EOF or error
                };

                let msg: Value = match serde_json::from_str(&line) {
                    Ok(v) => v,
                    Err(_) => continue,
                };

                let event_type = msg.get("event").and_then(|v| v.as_str()).unwrap_or("");
                let req_id = msg.get("id").and_then(|v| v.as_str()).unwrap_or("");

                match event_type {
                    "stream" => {
                        // Emit per-pane stream event to frontend
                        if let Some(pane_id) = msg.get("paneId").and_then(|v| v.as_u64()) {
                            let event_name = format!("bridge-stream-{}", pane_id);
                            let data = msg.get("data").cloned().unwrap_or(Value::Null);
                            let _ = app_handle.emit(&event_name, data);
                        }
                    }
                    "stream_end" => {
                        if let Some(pane_id) = msg.get("paneId").and_then(|v| v.as_u64()) {
                            let event_name = format!("bridge-stream-end-{}", pane_id);
                            let _ = app_handle.emit(&event_name, ());
                        }
                    }
                    "error" if !req_id.is_empty() => {
                        // Try resolving pending request, also emit error event
                        let error_msg = msg
                            .get("message")
                            .and_then(|v| v.as_str())
                            .unwrap_or("Unknown error");

                        if let Some(pane_id) = msg.get("paneId").and_then(|v| v.as_u64()) {
                            let event_name = format!("bridge-error-{}", pane_id);
                            let _ = app_handle.emit(&event_name, error_msg.to_string());
                        }

                        // Resolve pending so send() doesn't hang
                        if let Ok(mut map) = pending.lock() {
                            if let Some(tx) = map.remove(req_id) {
                                let _ = tx.send(msg.clone());
                            }
                        }
                    }
                    _ => {
                        // Non-streaming response: resolve pending request
                        if !req_id.is_empty() {
                            if let Ok(mut map) = pending.lock() {
                                if let Some(tx) = map.remove(req_id) {
                                    let _ = tx.send(msg.clone());
                                }
                            }
                        }
                    }
                }
            }

            // Resolve any in-flight requests so the frontend doesn't hang forever
            // if the bridge exits during startup.
            let stderr_summary = stderr_tail
                .lock()
                .ok()
                .map(|tail| tail.iter().cloned().collect::<Vec<_>>().join("\n"))
                .unwrap_or_default();

            if let Ok(mut map) = pending.lock() {
                let req_ids: Vec<String> = map.keys().cloned().collect();
                for req_id in req_ids {
                    if let Some(tx) = map.remove(&req_id) {
                        let message = if stderr_summary.trim().is_empty() {
                            "Bridge process exited before responding.".to_string()
                        } else {
                            format!(
                                "Bridge process exited before responding.\n{}",
                                stderr_summary
                            )
                        };

                        let _ = tx.send(serde_json::json!({
                            "id": req_id,
                            "event": "error",
                            "message": message,
                        }));
                    }
                }
            }

            // Bridge process exited
            let _ = app_handle.emit("bridge-disconnected", ());
        });

        Ok(())
    }

    /// Send a request and wait for the response.
    pub fn send(&self, action: &str, extra: Value) -> Result<Value, String> {
        let id = self.next_req_id();

        let (tx, rx) = oneshot::channel();

        self.pending
            .lock()
            .map_err(|e| e.to_string())?
            .insert(id.clone(), tx);

        let mut msg = serde_json::Map::new();
        msg.insert("id".into(), Value::String(id.clone()));
        msg.insert("action".into(), Value::String(action.into()));

        // Merge extra fields
        if let Value::Object(extra_map) = extra {
            for (k, v) in extra_map {
                msg.insert(k, v);
            }
        }

        let line = serde_json::to_string(&Value::Object(msg)).map_err(|e| e.to_string())?;

        {
            let mut stdin_guard = self.stdin.lock().map_err(|e| e.to_string())?;
            let stdin = stdin_guard.as_mut().ok_or("Bridge not spawned")?;
            writeln!(stdin, "{}", line).map_err(|e| format!("Failed to write to bridge: {}", e))?;
            stdin.flush().map_err(|e| e.to_string())?;
        }

        // Block on the oneshot (we're in a sync Tauri command context)
        rx.blocking_recv()
            .map_err(|_| "Bridge response channel closed".to_string())
    }

    /// Send a fire-and-forget request (for streaming operations).
    /// The response comes back as Tauri events, not through this channel.
    pub fn send_fire(&self, action: &str, extra: Value) -> Result<String, String> {
        let id = self.next_req_id();

        let mut msg = serde_json::Map::new();
        msg.insert("id".into(), Value::String(id.clone()));
        msg.insert("action".into(), Value::String(action.into()));

        if let Value::Object(extra_map) = extra {
            for (k, v) in extra_map {
                msg.insert(k, v);
            }
        }

        let line = serde_json::to_string(&Value::Object(msg)).map_err(|e| e.to_string())?;

        {
            let mut stdin_guard = self.stdin.lock().map_err(|e| e.to_string())?;
            let stdin = stdin_guard.as_mut().ok_or("Bridge not spawned")?;
            writeln!(stdin, "{}", line).map_err(|e| format!("Failed to write to bridge: {}", e))?;
            stdin.flush().map_err(|e| e.to_string())?;
        }

        Ok(id)
    }

    /// Kill the bridge process.
    pub fn kill(&self) -> Result<(), String> {
        if let Ok(mut guard) = self.child.lock() {
            if let Some(ref mut child) = *guard {
                let _ = child.kill();
            }
            *guard = None;
        }
        if let Ok(mut guard) = self.stdin.lock() {
            *guard = None;
        }
        Ok(())
    }
}
