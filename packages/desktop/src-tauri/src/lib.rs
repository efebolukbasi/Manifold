mod bridge;
mod pty;
mod session;

use serde_json::{json, Value};
use tauri::path::BaseDirectory;
use tauri::{Manager, State};

// ── PTY Commands ────────────────────────────────────────────────────

#[tauri::command]
fn create_pty(
    state: State<pty::PtyManager>,
    app_handle: tauri::AppHandle,
    rows: u16,
    cols: u16,
    cwd: Option<String>,
) -> Result<String, String> {
    state.create(rows, cols, cwd, app_handle)
}

#[tauri::command]
fn attach_pty(
    state: State<pty::PtyManager>,
    id: String,
) -> Result<pty::PtyAttachState, String> {
    state.attach(&id)
}

#[tauri::command]
fn write_pty(state: State<pty::PtyManager>, id: String, data: String) -> Result<(), String> {
    state.write(&id, data.as_bytes())
}

#[tauri::command]
fn resize_pty(
    state: State<pty::PtyManager>,
    id: String,
    rows: u16,
    cols: u16,
) -> Result<(), String> {
    state.resize(&id, rows, cols)
}

#[tauri::command]
fn close_pty(state: State<pty::PtyManager>, id: String) -> Result<(), String> {
    state.close(&id)
}

// ── Session Commands ────────────────────────────────────────────────

#[tauri::command]
fn load_shared_session(
    default_pane_count: u32,
    default_active_pane_id: u32,
) -> Result<session::SharedSessionState, String> {
    session::load_or_create_shared_session(default_pane_count, default_active_pane_id)
}

#[tauri::command]
fn sync_shared_session(
    pane_count: u32,
    active_pane_id: u32,
) -> Result<session::SharedSession, String> {
    session::sync_shared_session(pane_count, active_pane_id)
}

#[tauri::command]
fn upsert_worklog_entry(
    input: session::WorklogEntryInput,
    pane_count: u32,
    active_pane_id: u32,
) -> Result<session::SharedSession, String> {
    session::upsert_worklog_entry(input, pane_count, active_pane_id)
}

// ── Bridge Commands ─────────────────────────────────────────────────

#[tauri::command]
fn bridge_initialize(
    state: State<bridge::BridgeManager>,
    app_handle: tauri::AppHandle,
    project_root: String,
) -> Result<Value, String> {
    // Resolve bridge script path relative to the app
    let bridge_script = resolve_bridge_script(&app_handle)?;

    state.spawn(&bridge_script, app_handle)?;

    let response = state.send("initialize", json!({ "projectRoot": project_root }))?;

    let event = response.get("event").and_then(|v| v.as_str()).unwrap_or("");
    if event == "error" {
        let msg = response
            .get("message")
            .and_then(|v| v.as_str())
            .unwrap_or("Unknown error");
        return Err(msg.to_string());
    }

    Ok(response)
}

#[tauri::command]
fn bridge_chat(
    state: State<bridge::BridgeManager>,
    pane_id: u32,
    input: String,
) -> Result<String, String> {
    // Fire-and-forget — stream events come via Tauri events
    state.send_fire("chat", json!({ "paneId": pane_id, "input": input }))
}

#[tauri::command]
fn bridge_get_status(state: State<bridge::BridgeManager>) -> Result<Value, String> {
    state.send("get_status", json!({}))
}

#[tauri::command]
fn bridge_assign_model(
    state: State<bridge::BridgeManager>,
    pane_id: u32,
    model_id: String,
) -> Result<Value, String> {
    state.send("assign_model", json!({ "paneId": pane_id, "modelId": model_id }))
}

#[tauri::command]
fn bridge_shutdown(state: State<bridge::BridgeManager>) -> Result<(), String> {
    // Try graceful shutdown first
    let _ = state.send("shutdown", json!({}));
    state.kill()
}

// ── Helpers ─────────────────────────────────────────────────────────

fn resolve_bridge_script(app_handle: &tauri::AppHandle) -> Result<String, String> {
    // In development: look for bridge/dist/server.cjs relative to the desktop package
    // Walk up from the executable to find the packages/desktop directory
    let dev_path = std::env::current_dir()
        .ok()
        .map(|d| d.join("bridge").join("dist").join("server.cjs"));

    if let Some(ref path) = dev_path {
        if path.exists() {
            return Ok(path.to_string_lossy().to_string());
        }
    }

    // Try relative to manifest dir (compile-time)
    let manifest_path = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap_or(std::path::Path::new("."))
        .join("bridge")
        .join("dist")
        .join("server.cjs");

    if manifest_path.exists() {
        return Ok(manifest_path.to_string_lossy().to_string());
    }

    // Production: resolve with Tauri's resource path algorithm so bundled relative
    // resources like ../bridge/dist/server.cjs map correctly.
    if let Ok(resource_path) = app_handle
        .path()
        .resolve("../bridge/dist/server.cjs", BaseDirectory::Resource)
    {
        if resource_path.exists() {
            // On Windows, Tauri's resolve() can produce \\?\ extended-length paths.
            // Node.js require() misinterprets these as UNC paths, causing EISDIR errors.
            let path_str = resource_path.to_string_lossy().to_string();
            #[cfg(windows)]
            let path_str = path_str.strip_prefix("\\\\?\\").unwrap_or(&path_str).to_string();
            return Ok(path_str);
        }
    }

    Err("Could not find bridge/dist/server.cjs. Run 'npm run build:bridge' first.".to_string())
}

// ── App Entry ───────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(pty::PtyManager::new())
        .manage(bridge::BridgeManager::new())
        .invoke_handler(tauri::generate_handler![
            // PTY
            create_pty,
            attach_pty,
            write_pty,
            resize_pty,
            close_pty,
            // Session
            load_shared_session,
            sync_shared_session,
            upsert_worklog_entry,
            // Bridge
            bridge_initialize,
            bridge_chat,
            bridge_get_status,
            bridge_assign_model,
            bridge_shutdown,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
