mod pty;

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(pty::PtyManager::new())
        .invoke_handler(tauri::generate_handler![
            create_pty, attach_pty, write_pty, resize_pty, close_pty,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
