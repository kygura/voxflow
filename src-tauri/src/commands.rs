//! IPC commands (SPEC "IPC surface"). All errors are plain strings.

use crate::dictation::{Input, Phase};
use crate::{api_key, keyring_entry, AppState};
use serde::Serialize;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};
use tauri_plugin_opener::OpenerExt;
use voxflow_core::history::HistoryEntry;
use voxflow_core::models::{self, ModelInfo};
use voxflow_core::settings::Settings;
use voxflow_core::{audio, output, transcribe::remote};

type Res<T = ()> = Result<T, String>;

fn err(e: impl std::fmt::Display) -> String {
    format!("{e:#}")
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Status {
    state: Phase,
    #[serde(skip_serializing_if = "Option::is_none")]
    message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    last_error: Option<String>,
    has_api_key: bool,
}

#[derive(Serialize, Clone)]
struct Progress<'a> {
    name: &'a str,
    downloaded: u64,
    total: u64,
}

#[derive(Serialize, Clone)]
struct DownloadDone<'a> {
    name: &'a str,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

#[tauri::command]
pub fn get_settings(state: State<AppState>) -> Settings {
    state.settings.lock().unwrap().clone()
}

/// Validate, re-register the hotkey if it changed (reverting on failure), then persist.
#[tauri::command]
pub fn save_settings(app: AppHandle, state: State<AppState>, settings: Settings) -> Res {
    settings.validate().map_err(err)?;
    let mut current = state.settings.lock().unwrap();
    let old = current.hotkey.clone();
    let changed = old != settings.hotkey;
    let gs = app.global_shortcut();
    if changed {
        let new: Shortcut = settings.hotkey.parse().map_err(|e| format!("Invalid hotkey {}: {e}", settings.hotkey))?;
        if new == crate::dictation::esc() {
            return Err("Esc is reserved for cancelling dictation".into());
        }
        let _ = gs.unregister(old.as_str());
        if let Err(e) = gs.register(new) {
            let _ = gs.register(old.as_str());
            return Err(format!("Could not register hotkey {}: {e}", settings.hotkey));
        }
    }
    if let Err(e) = settings.save(&state.settings_path) {
        if changed {
            let _ = gs.unregister(settings.hotkey.as_str());
            let _ = gs.register(old.as_str());
        }
        return Err(err(e));
    }
    *current = settings;
    Ok(())
}

#[tauri::command]
pub fn set_api_key(key: String) -> Res {
    let key = key.trim();
    if key.is_empty() {
        return Err("API key is empty".into());
    }
    keyring_entry()?.set_password(key).map_err(err)
}

#[tauri::command]
pub fn clear_api_key() -> Res {
    match keyring_entry()?.delete_credential() {
        Err(keyring::Error::NoEntry) | Ok(()) => Ok(()),
        Err(e) => Err(err(e)),
    }
}

#[tauri::command]
pub fn has_api_key() -> bool {
    api_key().is_some()
}

#[tauri::command]
pub fn list_models(state: State<AppState>) -> Vec<ModelInfo> {
    models::list(&state.models_dir)
}

#[tauri::command]
pub fn download_model(app: AppHandle, state: State<AppState>, name: String) -> Res {
    models::model_path(&state.models_dir, &name).map_err(err)?;
    let cancel = Arc::new(AtomicBool::new(false));
    {
        let mut d = state.downloads.lock().unwrap();
        if d.contains_key(&name) {
            return Err(format!("{name} is already downloading"));
        }
        d.insert(name.clone(), cancel.clone());
    }
    let dir = state.models_dir.clone();
    std::thread::spawn(move || {
        let r = models::download(&dir, &name, &cancel, |downloaded, total| {
            let _ = app.emit("models://progress", Progress { name: &name, downloaded, total });
        });
        app.state::<AppState>().downloads.lock().unwrap().remove(&name);
        let error = r.err().map(err);
        let _ = app.emit("models://done", DownloadDone { name: &name, error });
    });
    Ok(())
}

#[tauri::command]
pub fn cancel_download(state: State<AppState>, name: String) {
    if let Some(flag) = state.downloads.lock().unwrap().get(&name) {
        flag.store(true, Ordering::Relaxed);
    }
}

#[tauri::command]
pub fn delete_model(state: State<AppState>, name: String) -> Res {
    models::delete(&state.models_dir, &name).map_err(err)
}

#[tauri::command]
pub fn list_input_devices() -> Res<Vec<String>> {
    audio::list_input_devices().map_err(err)
}

/// Async + blocking pool: the check can take up to the 60 s HTTP timeout.
#[tauri::command]
pub async fn test_remote(app: AppHandle) -> Res<String> {
    let cfg = app.state::<AppState>().settings.lock().unwrap().remote.clone();
    tauri::async_runtime::spawn_blocking(move || remote::test(&cfg, api_key().as_deref()))
        .await
        .map_err(err)?
        .map_err(err)
}

#[tauri::command]
pub fn get_history(state: State<AppState>) -> Vec<HistoryEntry> {
    state.history.lock().unwrap().entries().to_vec()
}

#[tauri::command]
pub fn delete_history_entry(state: State<AppState>, id: String) -> Res {
    let mut h = state.history.lock().unwrap();
    h.delete(&id);
    h.save().map_err(err)
}

#[tauri::command]
pub fn clear_history(state: State<AppState>) -> Res {
    let mut h = state.history.lock().unwrap();
    h.clear();
    h.save().map_err(err)
}

#[tauri::command]
pub fn copy_text(text: String) -> Res {
    output::deliver(&text, false, false).map(|_| ()).map_err(err)
}

#[tauri::command]
pub fn start_dictation(state: State<AppState>) {
    let _ = state.tx.send(Input::Start);
}

#[tauri::command]
pub fn stop_dictation(state: State<AppState>) {
    let _ = state.tx.send(Input::Stop);
}

#[tauri::command]
pub fn cancel_dictation(state: State<AppState>) {
    let _ = state.tx.send(Input::Cancel);
}

#[tauri::command]
pub fn get_status(state: State<AppState>) -> Status {
    let has_api_key = api_key().is_some();
    let st = state.status.lock().unwrap();
    Status {
        state: st.phase,
        message: st.message.clone(),
        last_error: st.last_error.clone(),
        has_api_key,
    }
}

#[tauri::command]
pub fn open_data_dir(app: AppHandle, state: State<AppState>) -> Res {
    std::fs::create_dir_all(&state.data_dir).map_err(err)?;
    app.opener()
        .open_path(state.data_dir.to_string_lossy(), None::<&str>)
        .map_err(err)
}
