use std::fs;
use std::path::{Path, PathBuf};

use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SharedSessionState {
    pub session: SharedSession,
    pub project_root: String,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SharedSession {
    pub id: String,
    pub project_name: String,
    pub started_at: String,
    pub last_active_at: String,
    pub messages: Vec<Value>,
    pub tasks: Vec<Value>,
    pub worklog: Vec<WorklogEntry>,
    pub active_models: Vec<String>,
    pub orchestration_mode: String,
    pub panes: Vec<SharedPaneState>,
    pub pane_count: u32,
    pub active_pane_id: u32,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SharedPaneState {
    pub id: u32,
    pub model_id: Option<String>,
    pub status: String,
    pub last_active_at: String,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WorklogEntry {
    pub id: String,
    pub title: String,
    pub summary: String,
    pub status: String,
    pub created_by: String,
    pub model_id: Option<String>,
    pub pane_id: Option<u32>,
    pub task_id: Option<String>,
    pub files: Option<Vec<String>>,
    pub blockers: Option<Vec<String>>,
    pub next_step: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct LatestSessionPointer {
    session_id: String,
    project_name: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorklogEntryInput {
    pub id: Option<String>,
    pub title: String,
    pub summary: String,
    pub status: String,
    pub pane_id: u32,
    pub created_by: Option<String>,
    pub model_id: Option<String>,
    pub task_id: Option<String>,
    pub files: Option<Vec<String>>,
    pub blockers: Option<Vec<String>>,
    pub next_step: Option<String>,
}

pub fn load_or_create_shared_session(
    default_pane_count: u32,
    default_active_pane_id: u32,
) -> Result<SharedSessionState, String> {
    let project_root = find_project_root()?;
    let mut session = load_latest_session(&project_root)?;

    if session.is_none() {
        session = Some(new_session(
            &project_root,
            normalize_pane_count(default_pane_count),
            normalize_active_pane_id(default_active_pane_id, default_pane_count),
        ));
    }

    let mut session = session.expect("session should exist after initialization");
    session.pane_count = normalize_pane_count(session.pane_count);
    session.active_pane_id =
        normalize_active_pane_id(session.active_pane_id, session.pane_count);
    session.last_active_at = now_iso();
    session.panes = reconcile_panes(&session.panes, session.pane_count, session.active_pane_id);
    persist_session(&project_root, &session)?;

    Ok(SharedSessionState {
        session,
        project_root: project_root.display().to_string(),
    })
}

pub fn sync_shared_session(
    pane_count: u32,
    active_pane_id: u32,
) -> Result<SharedSession, String> {
    let project_root = find_project_root()?;
    let SharedSessionState { mut session, .. } =
        load_or_create_shared_session(pane_count, active_pane_id)?;

    session.pane_count = normalize_pane_count(pane_count);
    session.active_pane_id = normalize_active_pane_id(active_pane_id, pane_count);
    session.last_active_at = now_iso();
    session.panes = reconcile_panes(&session.panes, session.pane_count, session.active_pane_id);

    persist_session(&project_root, &session)?;
    Ok(session)
}

pub fn upsert_worklog_entry(
    input: WorklogEntryInput,
    pane_count: u32,
    active_pane_id: u32,
) -> Result<SharedSession, String> {
    let project_root = find_project_root()?;
    let SharedSessionState { mut session, .. } =
        load_or_create_shared_session(pane_count, active_pane_id)?;

    let now = now_iso();
    let normalized_files = normalize_string_list(input.files);
    let normalized_blockers = normalize_string_list(input.blockers);
    let pane_id = normalize_active_pane_id(input.pane_id, pane_count);

    let existing_index = input
        .id
        .as_ref()
        .and_then(|id| session.worklog.iter().position(|entry| entry.id == *id));

    let existing = existing_index.map(|index| session.worklog[index].clone());

    let entry = WorklogEntry {
        id: existing
            .as_ref()
            .map(|entry| entry.id.clone())
            .or(input.id)
            .unwrap_or_else(|| Uuid::new_v4().to_string()),
        title: input.title.trim().to_string(),
        summary: input.summary.trim().to_string(),
        status: input.status.trim().to_string(),
        created_by: existing
            .as_ref()
            .map(|entry| entry.created_by.clone())
            .or(input.created_by)
            .unwrap_or_else(|| "desktop".to_string()),
        model_id: input
            .model_id
            .or_else(|| Some(format!("pane-{}", pane_id))),
        pane_id: Some(pane_id),
        task_id: input.task_id,
        files: normalized_files,
        blockers: normalized_blockers,
        next_step: input.next_step.and_then(|value| normalize_optional_string(&value)),
        created_at: existing
            .as_ref()
            .map(|entry| entry.created_at.clone())
            .unwrap_or_else(|| now.clone()),
        updated_at: now.clone(),
    };

    if let Some(index) = existing_index {
        session.worklog[index] = entry;
    } else {
        session.worklog.push(entry);
    }

    session.pane_count = normalize_pane_count(pane_count);
    session.active_pane_id = normalize_active_pane_id(active_pane_id, pane_count);
    session.last_active_at = now;
    session.panes = reconcile_panes(&session.panes, session.pane_count, session.active_pane_id);

    persist_session(&project_root, &session)?;
    Ok(session)
}

fn now_iso() -> String {
    Utc::now().to_rfc3339()
}

fn find_project_root() -> Result<PathBuf, String> {
    let cwd = std::env::current_dir().map_err(|e| e.to_string())?;
    for candidate in cwd.ancestors() {
        if candidate.join(".git").exists() || candidate.join("manifold.toml").exists() {
            return Ok(candidate.to_path_buf());
        }
    }

    Ok(cwd)
}

fn load_latest_session(project_root: &Path) -> Result<Option<SharedSession>, String> {
    let latest_path = latest_session_pointer_path(project_root);
    if !latest_path.exists() {
        return Ok(None);
    }

    let latest_data = fs::read_to_string(&latest_path).map_err(|e| e.to_string())?;
    let pointer: LatestSessionPointer =
        serde_json::from_str(&latest_data).map_err(|e| e.to_string())?;

    if pointer.project_name != project_name(project_root) {
        return Ok(None);
    }

    let session_path = session_file_path(project_root, &pointer.session_id);
    if !session_path.exists() {
        return Ok(None);
    }

    let session_data = fs::read_to_string(session_path).map_err(|e| e.to_string())?;
    let mut session: SharedSession =
        serde_json::from_str(&session_data).map_err(|e| e.to_string())?;
    session.worklog.sort_by(|a, b| a.updated_at.cmp(&b.updated_at));
    Ok(Some(session))
}

fn new_session(
    project_root: &Path,
    pane_count: u32,
    active_pane_id: u32,
) -> SharedSession {
    let now = now_iso();
    SharedSession {
        id: Uuid::new_v4().to_string(),
        project_name: project_name(project_root),
        started_at: now.clone(),
        last_active_at: now.clone(),
        messages: Vec::new(),
        tasks: Vec::new(),
        worklog: Vec::new(),
        active_models: Vec::new(),
        orchestration_mode: "collaborative".to_string(),
        panes: reconcile_panes(&[], pane_count, active_pane_id),
        pane_count,
        active_pane_id,
    }
}

fn persist_session(project_root: &Path, session: &SharedSession) -> Result<(), String> {
    let storage_dir = storage_dir(project_root);
    fs::create_dir_all(&storage_dir).map_err(|e| e.to_string())?;

    let session_path = session_file_path(project_root, &session.id);
    let latest_path = latest_session_pointer_path(project_root);

    let session_json = serde_json::to_string_pretty(session).map_err(|e| e.to_string())?;
    fs::write(session_path, session_json).map_err(|e| e.to_string())?;

    let latest_json = serde_json::json!({
        "sessionId": session.id,
        "projectName": session.project_name,
        "savedAt": now_iso(),
    });
    fs::write(latest_path, latest_json.to_string()).map_err(|e| e.to_string())
}

fn reconcile_panes(
    existing: &[SharedPaneState],
    pane_count: u32,
    active_pane_id: u32,
) -> Vec<SharedPaneState> {
    let now = now_iso();
    (1..=pane_count)
        .map(|id| {
            let previous = existing.iter().find(|pane| pane.id == id);
            SharedPaneState {
                id,
                model_id: previous.and_then(|pane| pane.model_id.clone()),
                status: previous
                    .map(|pane| pane.status.clone())
                    .unwrap_or_else(|| "idle".to_string()),
                last_active_at: if id == active_pane_id {
                    now.clone()
                } else {
                    previous
                        .map(|pane| pane.last_active_at.clone())
                        .unwrap_or_else(|| now.clone())
                },
            }
        })
        .collect()
}

fn normalize_pane_count(pane_count: u32) -> u32 {
    match pane_count {
        1 | 2 | 4 | 6 | 9 => pane_count,
        _ => 2,
    }
}

fn normalize_active_pane_id(active_pane_id: u32, pane_count: u32) -> u32 {
    let max = normalize_pane_count(pane_count);
    active_pane_id.clamp(1, max)
}

fn normalize_string_list(values: Option<Vec<String>>) -> Option<Vec<String>> {
    let items = values
        .unwrap_or_default()
        .into_iter()
        .filter_map(|value| normalize_optional_string(&value))
        .collect::<Vec<_>>();

    if items.is_empty() {
        None
    } else {
        Some(items)
    }
}

fn normalize_optional_string(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

fn project_name(project_root: &Path) -> String {
    project_root
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("manifold")
        .to_string()
}

fn storage_dir(project_root: &Path) -> PathBuf {
    project_root.join(".manifold").join("sessions")
}

fn latest_session_pointer_path(project_root: &Path) -> PathBuf {
    storage_dir(project_root).join("latest.json")
}

fn session_file_path(project_root: &Path, session_id: &str) -> PathBuf {
    storage_dir(project_root).join(format!("{session_id}.json"))
}
