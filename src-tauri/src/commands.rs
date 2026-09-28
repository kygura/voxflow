//! IPC commands (SPEC "IPC surface"). All errors are plain strings.

use crate::dictation::{Input, Phase};
use crate::{ai_key, api_key, keyring_entry, AppState, KEY_AI, KEY_REMOTE};
use serde::Serialize;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager, State, Wry};
use tauri_plugin_global_shortcut::{Code, GlobalShortcut, GlobalShortcutExt, Shortcut};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;
use voxflow_core::history::HistoryEntry;
use voxflow_core::models::{self, ModelInfo};
use voxflow_core::settings::Settings;
use voxflow_core::{audio, cleanup, output, transcribe::remote};

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
    has_ai_key: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanupPreview {
    basic: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    ai: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    ai_error: Option<String>,
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

/// A hotkey string the global-shortcut plugin accepts; Esc is reserved for cancel.
fn parse_hotkey(hotkey: &str) -> Res<Shortcut> {
    let s: Shortcut = hotkey.parse().map_err(|e| format!("Invalid hotkey {hotkey}: {e}"))?;
    if s.key == Code::Escape {
        return Err("Esc is reserved for cancelling dictation".into());
    }
    Ok(s)
}

/// Unregister `old` hotkeys, register `new` ones ("" = none). On failure the old set is
/// re-registered; failures of that restore are appended to the error.
fn swap_with<'a, E: std::fmt::Display>(
    mut register: impl FnMut(&'a str) -> Result<(), E>,
    mut unregister: impl FnMut(&'a str) -> Result<(), E>,
    old: [&'a str; 2],
    new: [&'a str; 2],
) -> Res {
    let set = |keys: [&'a str; 2]| keys.into_iter().filter(|k| !k.is_empty());
    set(old).for_each(|k| drop(unregister(k)));
    let mut done = Vec::new();
    for k in set(new) {
        if let Err(e) = register(k) {
            done.into_iter().for_each(|d| drop(unregister(d)));
            let mut msg = format!("Could not register hotkey {k}: {e}");
            for o in set(old) {
                if let Err(e) = register(o) {
                    msg += &format!("; restoring hotkey {o} failed: {e}");
                }
            }
            return Err(msg);
        }
        done.push(k);
    }
    Ok(())
}

fn swap_hotkeys<'a>(gs: &GlobalShortcut<Wry>, old: [&'a str; 2], new: [&'a str; 2]) -> Res {
    swap_with(|k| gs.register(k), |k| gs.unregister(k), old, new)
}

/// Validate, re-register the hotkeys if they changed (reverting on failure), then persist.
#[tauri::command]
pub fn save_settings(app: AppHandle, state: State<AppState>, settings: Settings) -> Res {
    settings.validate().map_err(err)?;
    let hotkey = parse_hotkey(&settings.hotkey)?;
    if !settings.paste_last_hotkey.is_empty() && parse_hotkey(&settings.paste_last_hotkey)? == hotkey {
        return Err("Paste-last hotkey must differ from the dictation hotkey".into());
    }
    let mut current = state.settings.lock().unwrap();
    let old = [current.hotkey.clone(), current.paste_last_hotkey.clone()];
    let old = [old[0].as_str(), old[1].as_str()];
    let new = [settings.hotkey.as_str(), settings.paste_last_hotkey.as_str()];
    let changed = old != new;
    let gs = app.global_shortcut();
    if changed {
        swap_hotkeys(gs, old, new)?;
        // Right away: the handler routes the new paste-last key by this id.
        state.paste_last_id.store(crate::shortcut_id(new[1]), Ordering::Relaxed);
    }
    if let Err(e) = settings.save(&state.settings_path) {
        let mut msg = err(e);
        if changed {
            state.paste_last_id.store(crate::shortcut_id(old[1]), Ordering::Relaxed);
            if let Err(r) = swap_hotkeys(gs, new, old) {
                msg = format!("{msg}; reverting hotkeys failed: {r}");
                state.status.lock().unwrap().last_error = Some(msg.clone());
            }
        }
        return Err(msg);
    }
    *current = settings;
    drop(current);
    let _ = app.emit("settings://changed", ());
    Ok(())
}

fn set_key(account: &str, key: &str) -> Res {
    let key = key.trim();
    if key.is_empty() {
        return Err("API key is empty".into());
    }
    keyring_entry(account)?.set_password(key).map_err(err)
}

fn clear_key(account: &str) -> Res {
    match keyring_entry(account)?.delete_credential() {
        Err(keyring::Error::NoEntry) | Ok(()) => Ok(()),
        Err(e) => Err(err(e)),
    }
}

#[tauri::command]
pub fn set_api_key(key: String) -> Res {
    set_key(KEY_REMOTE, &key)
}

#[tauri::command]
pub fn clear_api_key() -> Res {
    clear_key(KEY_REMOTE)
}

#[tauri::command]
pub fn set_ai_key(key: String) -> Res {
    set_key(KEY_AI, &key)
}

#[tauri::command]
pub fn clear_ai_key() -> Res {
    clear_key(KEY_AI)
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
    if state.settings.lock().unwrap().local_model == name {
        return Err("Select another model before deleting the active one".into());
    }
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

/// Async + blocking pool: up to the 20 s AI timeout.
#[tauri::command]
pub async fn test_ai(app: AppHandle) -> Res<String> {
    let cfg = app.state::<AppState>().settings.lock().unwrap().ai.clone();
    tauri::async_runtime::spawn_blocking(move || cleanup::test_ai(&cfg, ai_key().as_deref()))
        .await
        .map_err(err)?
        .map_err(err)
}

/// Basic output always; AI attempted whenever an AI server URL is configured.
#[tauri::command]
pub async fn cleanup_preview(app: AppHandle, text: String) -> Res<CleanupPreview> {
    let s = app.state::<AppState>().settings.lock().unwrap().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let text = cleanup::apply_dictionary(&text, &s.dictionary);
        let basic = cleanup::basic(&text, &s.language);
        let (ai, ai_error) = if s.ai.base_url.trim().is_empty() {
            (None, Some("AI server not configured".to_owned()))
        } else {
            match cleanup::ai(&text, &s.language, &s.ai, &s.cleanup_instructions, ai_key().as_deref()) {
                Ok(t) => (Some(t), None),
                Err(e) => (None, Some(err(e))),
            }
        };
        CleanupPreview { basic, ai, ai_error }
    })
    .await
    .map_err(err)
}

fn ensure_idle(state: &AppState) -> Res {
    let st = state.status.lock().unwrap();
    idle_check(st.phase, st.demo)
}

fn idle_check(phase: Phase, demo: bool) -> Res {
    match phase {
        _ if demo => Ok(()), // the worker aborts (or restarts) the demo
        Phase::Recording | Phase::Transcribing | Phase::Cleaning => {
            Err("Busy: finish or cancel the current dictation first".into())
        }
        _ => Ok(()),
    }
}

/// Native picker, then the dictation pipeline (clipboard only, no auto-paste). Cancel → Ok.
#[tauri::command]
pub async fn transcribe_file(app: AppHandle) -> Res {
    ensure_idle(&app.state::<AppState>())?;
    let picker = app.clone();
    // blocking_pick_file must not run on the main thread; the blocking pool is fine.
    let picked = tauri::async_runtime::spawn_blocking(move || {
        let mut dialog = picker.dialog().file().add_filter("Audio", &["wav", "mp3", "m4a", "ogg", "flac"]);
        if let Some(main) = picker.get_webview_window("main") {
            dialog = dialog.set_parent(&main);
        }
        dialog.blocking_pick_file()
    })
    .await
    .map_err(err)?;
    let Some(file) = picked else { return Ok(()) };
    let path = file.into_path().map_err(err)?;
    let state = app.state::<AppState>();
    ensure_idle(&state)?; // a dictation may have started while the picker was open
    let _ = state.tx.send(Input::File(path));
    Ok(())
}

/// One demo cycle of the pill (no mic, clipboard, paste or history).
#[tauri::command]
pub fn preview_overlay(state: State<AppState>) -> Res {
    ensure_idle(&state)?;
    let _ = state.tx.send(Input::Demo(1));
    Ok(())
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

/// Mouse over the pill bubble: pauses done/error auto-dismiss until released.
#[tauri::command]
pub fn hold_pill(state: State<AppState>, hold: bool) {
    let _ = state.tx.send(Input::Hold(hold));
}

#[tauri::command]
pub fn get_status(state: State<AppState>) -> Status {
    let has_api_key = api_key().is_some();
    let has_ai_key = ai_key().is_some();
    let st = state.status.lock().unwrap();
    Status {
        state: st.phase,
        message: st.message.clone(),
        last_error: st.last_error.clone(),
        has_api_key,
        has_ai_key,
    }
}

#[tauri::command]
pub fn open_data_dir(app: AppHandle, state: State<AppState>) -> Res {
    std::fs::create_dir_all(&state.data_dir).map_err(err)?;
    app.opener()
        .open_path(state.data_dir.to_string_lossy(), None::<&str>)
        .map_err(err)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn swap_orderings() {
        use std::cell::RefCell;
        use std::collections::BTreeSet;
        type Case<'a> = (&'a str, [&'a str; 2], [&'a str; 2], &'a [&'a str], bool, &'a [&'a str], &'a str);
        #[rustfmt::skip]
        let table: [Case; 6] = [
            // name, old, new, failing keys, ok, registered after, log
            ("new[1] fails", ["A", "B"], ["C", "D"], &["D"], false, &["A", "B"], "-A -B +C -C +A +B"),
            ("new[0] fails", ["A", "B"], ["C", "D"], &["C"], false, &["A", "B"], "-A -B +A +B"),
            ("role swap", ["A", "B"], ["B", "A"], &[], true, &["A", "B"], "-A -B +B +A"),
            ("disable paste-last", ["A", "B"], ["A", ""], &[], true, &["A"], "-A -B +A"),
            ("paste-last stays off", ["A", ""], ["C", ""], &[], true, &["C"], "-A +C"),
            ("restore fails", ["A", "B"], ["C", "D"], &["D", "B"], false, &["A"], "-A -B +C -C +A"),
        ];
        for (name, old, new, failing, ok, after, want_log) in table {
            let reg: RefCell<BTreeSet<&str>> = RefCell::new(old.into_iter().filter(|k| !k.is_empty()).collect());
            let log = RefCell::new(Vec::new());
            let res = swap_with(
                |k| {
                    if failing.contains(&k) {
                        return Err("taken");
                    }
                    log.borrow_mut().push(format!("+{k}"));
                    reg.borrow_mut().insert(k);
                    Ok(())
                },
                |k| {
                    log.borrow_mut().push(format!("-{k}"));
                    reg.borrow_mut().remove(k);
                    Ok(())
                },
                old,
                new,
            );
            assert_eq!(res.is_ok(), ok, "{name}: {res:?}");
            assert_eq!(reg.into_inner().into_iter().collect::<Vec<_>>(), after, "{name}");
            assert_eq!(log.into_inner().join(" "), want_log, "{name}");
            if name == "restore fails" {
                assert_eq!(res.unwrap_err(), "Could not register hotkey D: taken; restoring hotkey B failed: taken");
            }
        }
    }

    #[test]
    fn idle_check_allows_demo_blocks_real_work() {
        use Phase::*;
        for (phase, demo, ok) in [
            (Recording, true, true),
            (Recording, false, false),
            (Transcribing, false, false),
            (Cleaning, false, false),
            (Idle, false, true),
            (Done, false, true),
            (Error, false, true),
        ] {
            assert_eq!(idle_check(phase, demo).is_ok(), ok, "{phase:?} demo={demo}");
        }
    }
}
