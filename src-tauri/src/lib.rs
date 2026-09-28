mod commands;
mod dictation;

use dictation::{Input, Phase};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{mpsc, Arc, Mutex};
use std::time::Instant;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent, Wry};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, ShortcutState};
use voxflow_core::history::History;
use voxflow_core::settings::{Backend, Settings};
use voxflow_core::transcribe::LocalEngine;

#[derive(Default)]
pub struct Status {
    pub phase: Phase,
    pub message: Option<String>,
    pub last_error: Option<String>,
}

pub struct AppState {
    pub settings_path: PathBuf,
    pub data_dir: PathBuf,
    pub models_dir: PathBuf,
    pub settings: Mutex<Settings>,
    pub history: Mutex<History>,
    /// Loaded whisper model, reused across transcriptions.
    pub engine: Mutex<LocalEngine>,
    pub downloads: Mutex<HashMap<String, Arc<AtomicBool>>>,
    pub status: Mutex<Status>,
    pub last_text: Mutex<Option<String>>,
    /// Main hotkey physically down (set straight from the shortcut handler).
    pub hotkey_down: AtomicBool,
    pub tx: mpsc::Sender<Input>,
}

struct TrayDictationItem(MenuItem<Wry>);

const KEYRING_SERVICE: &str = "voxflow";
/// Keyring account of the transcription server key.
pub const KEY_REMOTE: &str = "remote-api-key";
/// Keyring account of the AI cleanup server key (separate from transcription).
pub const KEY_AI: &str = "ai-api-key";

/// Keyring errors never contain the secret. Linux without a Secret Service → Err, not a crash.
pub fn keyring_entry(account: &str) -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYRING_SERVICE, account).map_err(|e| format!("keyring unavailable: {e}"))
}

pub fn api_key() -> Option<String> {
    keyring_entry(KEY_REMOTE).ok()?.get_password().ok()
}

pub fn ai_key() -> Option<String> {
    keyring_entry(KEY_AI).ok()?.get_password().ok()
}

pub fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
    }
}

pub fn update_tray(app: &AppHandle, phase: Phase) {
    if let Some(item) = app.try_state::<TrayDictationItem>() {
        let _ = item.0.set_text(match phase {
            Phase::Recording => "Stop dictation",
            Phase::Transcribing | Phase::Cleaning => "Cancel transcription",
            _ => "Start dictation",
        });
    }
}

fn send(app: &AppHandle, input: Input) {
    if let Some(st) = app.try_state::<AppState>() {
        let _ = st.tx.send(input);
    }
}

fn copy_last(app: &AppHandle) {
    let st = app.state::<AppState>();
    let last = st.last_text.lock().unwrap().clone();
    let text = last.or_else(|| st.history.lock().unwrap().entries().first().map(|e| e.text.clone()));
    if let Some(text) = text {
        if let Err(e) = voxflow_core::output::deliver(&text, false, false) {
            eprintln!("voxflow: copy failed: {e:#}");
        }
    }
}

fn setup(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let handle = app.handle().clone();
    let settings_path = app.path().app_config_dir()?.join("settings.json");
    let data_dir = app.path().app_data_dir()?;
    let models_dir = data_dir.join("models");
    let settings = Settings::load(&settings_path);
    let history = History::load(&data_dir.join("history.json"));

    let mut status = Status::default();
    if let Err(e) = handle.global_shortcut().register(settings.hotkey.as_str()) {
        let msg = format!("Could not register hotkey {}: {e}", settings.hotkey);
        eprintln!("voxflow: {msg}");
        status.last_error = Some(msg);
    }

    let demo = std::env::args().any(|a| a == "--demo");
    let first_run = !demo
        && settings.backend == Backend::Local
        && voxflow_core::models::model_path(&models_dir, &settings.local_model).is_ok_and(|p| !p.is_file());

    let (tx, rx) = mpsc::channel();
    app.manage(AppState {
        settings_path,
        data_dir,
        models_dir,
        settings: Mutex::new(settings),
        history: Mutex::new(history),
        engine: Mutex::new(LocalEngine::new()),
        downloads: Mutex::default(),
        status: Mutex::new(status),
        last_text: Mutex::default(),
        hotkey_down: AtomicBool::new(false),
        tx: tx.clone(),
    });
    if demo {
        let tx = tx.clone();
        std::thread::spawn(move || {
            std::thread::sleep(std::time::Duration::from_secs(1));
            let _ = tx.send(Input::Demo(5));
        });
    }
    dictation::spawn(handle.clone(), tx, rx);

    // Main window is `create: false` in tauri.conf so first run can open it on Transcription.
    let mut cfg = app
        .config()
        .app
        .windows
        .iter()
        .find(|w| w.label == "main")
        .cloned()
        .ok_or("main window config missing")?;
    if first_run {
        cfg.url = WebviewUrl::App("index.html?section=transcription".into());
        cfg.visible = true;
    }
    WebviewWindowBuilder::from_config(&handle, &cfg)?.build()?;

    let dictate = MenuItem::with_id(app, "dictate", "Start dictation", true, None::<&str>)?;
    let menu = Menu::with_items(
        app,
        &[
            &MenuItem::with_id(app, "open", "Open VoxFlow", true, None::<&str>)?,
            &PredefinedMenuItem::separator(app)?,
            &dictate,
            &MenuItem::with_id(app, "copy", "Copy last transcription", true, None::<&str>)?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "quit", "Quit VoxFlow", true, None::<&str>)?,
        ],
    )?;
    app.manage(TrayDictationItem(dictate));
    let mut tray = TrayIconBuilder::with_id("main")
        .tooltip("VoxFlow")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, e| match e.id.as_ref() {
            "open" => show_main(app),
            "dictate" => send(app, Input::Tray),
            "copy" => copy_last(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, e| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = e {
                show_main(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    if let Err(e) = tray.build(app) {
        eprintln!("voxflow: tray unavailable: {e}"); // e.g. Linux without appindicator
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| show_main(app)))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    // Runs with the plugin's shortcut lock held: only hand off, never (un)register here.
                    let Some(st) = app.try_state::<AppState>() else { return };
                    let pressed = event.state() == ShortcutState::Pressed;
                    let input = if shortcut.key == Code::Escape {
                        if !pressed {
                            return;
                        }
                        Input::Esc
                    } else {
                        st.hotkey_down.store(pressed, Ordering::Relaxed);
                        Input::Key { pressed, at: Instant::now() }
                    };
                    let _ = st.tx.send(input);
                })
                .build(),
        )
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .setup(setup)
        .invoke_handler(tauri::generate_handler![
            commands::get_settings,
            commands::save_settings,
            commands::set_api_key,
            commands::clear_api_key,
            commands::list_models,
            commands::download_model,
            commands::cancel_download,
            commands::delete_model,
            commands::list_input_devices,
            commands::test_remote,
            commands::get_history,
            commands::delete_history_entry,
            commands::clear_history,
            commands::copy_text,
            commands::start_dictation,
            commands::stop_dictation,
            commands::cancel_dictation,
            commands::get_status,
            commands::open_data_dir,
            commands::set_ai_key,
            commands::clear_ai_key,
            commands::test_ai,
            commands::cleanup_preview,
            commands::transcribe_file,
            commands::preview_overlay,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
