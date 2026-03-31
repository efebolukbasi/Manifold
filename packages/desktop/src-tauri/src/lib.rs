mod pty;
mod session;

use tauri::State;

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(pty::PtyManager::new())
        .invoke_handler(tauri::generate_handler![
            create_pty,
            attach_pty,
            write_pty,
            resize_pty,
            close_pty,
            load_shared_session,
            sync_shared_session,
            upsert_worklog_entry,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
