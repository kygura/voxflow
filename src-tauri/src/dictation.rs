//! Dictation state machine. Every input (hotkey, Esc, UI, tray, timers, finished
//! transcriptions) goes through one channel into one worker thread, so the phase logic is
//! single-threaded. The worker never runs inside the global-shortcut handler, which holds the
//! plugin's shortcut lock (registering Esc from there would deadlock).

use crate::{api_key, AppState};
use serde::Serialize;
use std::sync::atomic::Ordering;
use std::sync::mpsc::{Receiver, Sender};
use std::thread;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Shortcut};
use voxflow_core::audio::{is_probably_silent, Recorder, MAX_DURATION, MIN_SAMPLES};
use voxflow_core::history::HistoryEntry;
use voxflow_core::output::{deliver, Delivered};
use voxflow_core::settings::{Backend, HotkeyMode, Settings};
use voxflow_core::{models, transcribe::remote};

#[derive(Serialize, Clone, Copy, PartialEq, Eq, Debug, Default)]
#[serde(rename_all = "lowercase")]
pub enum Phase {
    #[default]
    Idle,
    Recording,
    Transcribing,
    Done,
    Error,
}

#[derive(Debug, PartialEq, Eq, Clone, Copy)]
pub enum Action {
    Start,
    Stop,
    HandsFree,
    Ignore,
}

/// Hybrid mode: a hold at least this long is push-to-talk, shorter is a tap (hands-free).
pub const HOLD: Duration = Duration::from_millis(350);

/// Hotkey decision. `hands_free`: the recording keeps going after the key is released
/// (toggle mode, a hybrid tap, or started from the UI/tray). A press while a held recording
/// is running is ignored (key repeat / push-to-talk).
pub fn decide(mode: HotkeyMode, phase: Phase, hands_free: bool, pressed: bool, held: Duration) -> Action {
    match (phase, pressed) {
        (Phase::Recording, true) if hands_free => Action::Stop,
        (Phase::Recording, true) => Action::Ignore,
        (Phase::Recording, false) if hands_free => Action::Ignore,
        (Phase::Recording, false) => match mode {
            HotkeyMode::PushToTalk => Action::Stop,
            HotkeyMode::Hybrid if held >= HOLD => Action::Stop,
            HotkeyMode::Hybrid => Action::HandsFree,
            HotkeyMode::Toggle => Action::Ignore,
        },
        (Phase::Transcribing, _) | (_, false) => Action::Ignore,
        (_, true) => Action::Start, // Idle, or Done/Error still on screen
    }
}

pub enum Input {
    Key { pressed: bool, at: Instant },
    Esc,
    Start,
    Stop,
    Cancel,
    /// Tray item: start, stop or cancel depending on phase.
    Tray,
    AutoStop(u64),
    Transcribed { gen: u64, settings: Settings, duration_ms: u64, result: Result<String, String> },
    /// Done/Error display time is over → idle.
    Expire(u64),
    HideWindow(u64),
}

/// Esc cancels. Also Esc plus the hotkey's modifiers, so Esc works while a push-to-talk
/// hotkey is still held (e.g. "CommandOrControl+Shift+Escape").
fn esc_keys(hotkey: &str) -> Vec<Shortcut> {
    let mut keys = vec![Shortcut::new(None, Code::Escape)];
    if let Ok(hk) = hotkey.parse::<Shortcut>() {
        if !hk.mods.is_empty() {
            keys.push(Shortcut::new(Some(hk.mods), Code::Escape));
        }
    }
    keys
}

#[derive(Serialize, Clone)]
struct StateEvent<'a> {
    state: Phase,
    #[serde(skip_serializing_if = "Option::is_none")]
    message: Option<&'a str>,
    #[serde(skip_serializing_if = "Option::is_none")]
    mode: Option<&'static str>,
}

#[derive(Serialize, Clone)]
struct LevelEvent {
    level: f32,
}

struct Worker {
    app: AppHandle,
    tx: Sender<Input>,
    phase: Phase,
    recorder: Option<Recorder>,
    pressed_at: Instant,
    hands_free: bool,
    /// Bumped on start and cancel; stale timers and transcriptions carry an old value.
    gen: u64,
    /// Esc shortcuts currently registered (empty = none).
    esc_registered: Vec<Shortcut>,
}

pub fn spawn(app: AppHandle, tx: Sender<Input>, rx: Receiver<Input>) {
    let mut w = Worker {
        app,
        tx,
        phase: Phase::Idle,
        recorder: None,
        pressed_at: Instant::now(),
        hands_free: false,
        gen: 0,
        esc_registered: Vec::new(),
    };
    thread::Builder::new()
        .name("voxflow-dictation".into())
        .spawn(move || {
            for input in rx {
                w.handle(input);
            }
        })
        .expect("spawn dictation thread");
}

impl Worker {
    fn state(&self) -> tauri::State<'_, AppState> {
        self.app.state::<AppState>()
    }

    fn settings(&self) -> Settings {
        self.state().settings.lock().unwrap().clone()
    }

    fn handle(&mut self, input: Input) {
        let active = matches!(self.phase, Phase::Recording | Phase::Transcribing);
        match input {
            Input::Key { pressed, at } => {
                let held = at.saturating_duration_since(self.pressed_at);
                let mode = self.settings().hotkey_mode;
                match decide(mode, self.phase, self.hands_free, pressed, held) {
                    Action::Start => self.start(mode == HotkeyMode::Toggle, at),
                    Action::Stop => self.stop(),
                    Action::HandsFree => {
                        self.hands_free = true;
                        self.emit(Phase::Recording, None);
                    }
                    Action::Ignore => {}
                }
            }
            Input::Esc | Input::Cancel if active => self.cancel(),
            Input::Start if !active => self.start(true, Instant::now()),
            Input::Stop if self.phase == Phase::Recording => self.stop(),
            Input::Tray => match self.phase {
                Phase::Recording => self.stop(),
                Phase::Transcribing => self.cancel(),
                _ => self.start(true, Instant::now()),
            },
            Input::AutoStop(gen) if gen == self.gen && self.phase == Phase::Recording => self.stop(),
            Input::Transcribed { gen, settings, duration_ms, result }
                if gen == self.gen && self.phase == Phase::Transcribing =>
            {
                match result {
                    Ok(text) if text.is_empty() => self.go_idle(),
                    Ok(text) => self.output(text, &settings, duration_ms),
                    Err(e) => self.fail(e),
                }
            }
            Input::Expire(gen) if gen == self.gen && matches!(self.phase, Phase::Done | Phase::Error) => {
                self.go_idle()
            }
            Input::HideWindow(gen) if gen == self.gen && self.phase == Phase::Idle => {
                if let Some(pill) = self.app.get_webview_window("pill") {
                    let _ = pill.hide();
                }
            }
            _ => {}
        }
    }

    fn start(&mut self, hands_free: bool, at: Instant) {
        let s = self.settings();
        let app = self.app.clone();
        let rec = Recorder::start(s.input_device.as_deref(), move |level| {
            let _ = app.emit_to("pill", "dictation://level", LevelEvent { level });
        });
        self.gen += 1;
        show_pill(&self.app);
        match rec {
            Ok(r) => self.recorder = Some(r),
            Err(e) => return self.fail(format!("Microphone: {e:#}")),
        }
        self.pressed_at = at;
        self.hands_free = hands_free;
        self.set_esc(true);
        self.emit(Phase::Recording, None);
        let (tx, gen) = (self.tx.clone(), self.gen);
        thread::spawn(move || {
            thread::sleep(MAX_DURATION);
            let _ = tx.send(Input::AutoStop(gen));
        });
    }

    fn stop(&mut self) {
        let Some(rec) = self.recorder.take() else { return };
        let duration_ms = rec.elapsed().as_millis() as u64;
        let samples = match rec.stop() {
            Ok(s) => s,
            Err(e) => return self.fail(format!("{e:#}")),
        };
        if samples.len() < MIN_SAMPLES || is_probably_silent(&samples) {
            return self.go_idle();
        }
        self.emit(Phase::Transcribing, None);
        let (app, tx, gen, settings) = (self.app.clone(), self.tx.clone(), self.gen, self.settings());
        thread::spawn(move || {
            let result = transcribe(&app.state::<AppState>(), &settings, &samples);
            let _ = tx.send(Input::Transcribed { gen, settings, duration_ms, result });
        });
    }

    fn cancel(&mut self) {
        self.recorder = None; // dropping discards the audio
        self.gen += 1; // a pending transcription result is now stale
        self.go_idle();
    }

    fn output(&mut self, text: String, s: &Settings, duration_ms: u64) {
        self.set_esc(false);
        // The stop may have been a key press: pasting while the hotkey's modifiers are still
        // down would send e.g. Ctrl+Shift+V. Wait for the release (bounded).
        // ponytail: held longer than 1.5 s → we paste anyway and may send a modified Ctrl+V;
        // poll real modifier state (OS API) if that shows up in practice.
        let t = Instant::now();
        while self.state().hotkey_down.load(Ordering::Relaxed) && t.elapsed() < Duration::from_millis(1500) {
            thread::sleep(Duration::from_millis(20));
        }
        let delivered = match deliver(&text, s.auto_paste, s.restore_clipboard) {
            Ok(d) => d,
            Err(e) => return self.fail(format!("{e:#}")),
        };
        let state = self.state();
        if s.save_history {
            let model = match s.backend {
                Backend::Local => s.local_model.clone(),
                Backend::Remote => s.remote.model.clone(),
            };
            let mut h = state.history.lock().unwrap();
            h.push(HistoryEntry::new(text.clone(), s.backend, model, duration_ms));
            if let Err(e) = h.save() {
                eprintln!("voxflow: saving history failed: {e:#}");
            }
            drop(h);
            let _ = self.app.emit("history://changed", ());
        }
        *state.last_text.lock().unwrap() = Some(text);
        let (msg, ms) = match delivered {
            Delivered::Pasted => ("Pasted", 900),
            Delivered::Copied => ("Copied", 1400),
        };
        self.emit(Phase::Done, Some(msg));
        self.after(ms, Input::Expire(self.gen));
    }

    fn fail(&mut self, msg: String) {
        eprintln!("voxflow: dictation error: {msg}");
        self.recorder = None;
        self.set_esc(false);
        self.state().status.lock().unwrap().last_error = Some(msg.clone());
        self.emit(Phase::Error, Some(&msg));
        self.after(3000, Input::Expire(self.gen));
    }

    fn go_idle(&mut self) {
        self.set_esc(false);
        self.emit(Phase::Idle, None);
        // Let the pill play its fade-out before the window disappears.
        self.after(220, Input::HideWindow(self.gen));
    }

    fn after(&self, ms: u64, input: Input) {
        let tx = self.tx.clone();
        thread::spawn(move || {
            thread::sleep(Duration::from_millis(ms));
            let _ = tx.send(input);
        });
    }

    fn set_esc(&mut self, on: bool) {
        let hotkey = self.settings().hotkey;
        let gs = self.app.global_shortcut();
        if !on {
            for k in self.esc_registered.drain(..) {
                if let Err(e) = gs.unregister(k) {
                    eprintln!("voxflow: Esc shortcut: {e}");
                }
            }
        } else if self.esc_registered.is_empty() {
            for k in esc_keys(&hotkey) {
                match gs.register(k) {
                    Ok(()) => self.esc_registered.push(k),
                    Err(e) => eprintln!("voxflow: Esc shortcut {k:?}: {e}"),
                }
            }
        }
    }

    fn emit(&mut self, phase: Phase, message: Option<&str>) {
        self.phase = phase;
        {
            let state = self.state();
            let mut st = state.status.lock().unwrap();
            st.phase = phase;
            st.message = message.map(str::to_owned);
        }
        let mode = (phase == Phase::Recording)
            .then_some(if self.hands_free { "toggle" } else { "push_to_talk" });
        let _ = self.app.emit("dictation://state", StateEvent { state: phase, message, mode });
        crate::update_tray(&self.app, phase);
    }
}

fn transcribe(state: &AppState, s: &Settings, audio: &[f32]) -> Result<String, String> {
    let r = match s.backend {
        Backend::Local => {
            let path = models::model_path(&state.models_dir, &s.local_model).map_err(|e| e.to_string())?;
            if !path.is_file() {
                return Err(format!("Model {} not downloaded", s.local_model));
            }
            state.engine.lock().unwrap().transcribe(&path, audio, &s.language)
        }
        Backend::Remote => remote::transcribe(&s.remote, api_key().as_deref(), audio, &s.language),
    };
    r.map(|t| t.trim().to_owned()).map_err(|e| format!("{e:#}"))
}

/// Bottom-center of the monitor under the cursor (else primary): window bottom = work-area
/// bottom, which puts the pill body 24 px above it (the window has 24 px transparent margin).
fn show_pill(app: &AppHandle) {
    let Some(pill) = app.get_webview_window("pill") else { return };
    let monitor = app
        .cursor_position()
        .ok()
        .and_then(|p| app.monitor_from_point(p.x, p.y).ok().flatten())
        .or_else(|| app.primary_monitor().ok().flatten());
    if let Some(m) = monitor {
        let s = m.scale_factor();
        let (w, h) = ((360.0 * s) as i32, (104.0 * s) as i32);
        let wa = m.work_area();
        let mut bottom = wa.position.y + wa.size.height as i32;
        if wa.size == *m.size() {
            bottom -= (48.0 * s) as i32; // no work area info: body 72 px above the screen bottom
        }
        let x = wa.position.x + (wa.size.width as i32 - w) / 2;
        let _ = pill.set_position(tauri::PhysicalPosition::new(x, bottom - h));
    }
    let _ = pill.show(); // never set_focus: the target app must keep focus for the paste
}

#[cfg(test)]
mod tests {
    use super::*;
    use Action::*;
    use HotkeyMode::*;
    use Phase::*;

    #[test]
    fn esc_keys_follow_hotkey_modifiers() {
        let esc = Shortcut::new(None, Code::Escape);
        assert_eq!(esc_keys("F9"), [esc]);
        let keys = esc_keys("CommandOrControl+Shift+Space");
        assert_eq!(keys.len(), 2);
        assert_eq!(keys[0], esc);
        assert_eq!(keys[1], "CommandOrControl+Shift+Escape".parse::<Shortcut>().unwrap());
    }

    #[test]
    fn hotkey_decisions() {
        let short = Duration::from_millis(100);
        let long = Duration::from_millis(500);
        #[rustfmt::skip]
        let table = [
            // mode, phase, hands_free, pressed, held → action
            (Hybrid, Idle, false, true, short, Start),
            (Hybrid, Done, false, true, short, Start),
            (Hybrid, Error, false, true, short, Start),
            (Hybrid, Recording, false, false, long, Stop),
            (Hybrid, Recording, false, false, short, HandsFree),
            (Hybrid, Recording, false, false, HOLD, Stop),
            (Hybrid, Recording, false, false, HOLD - Duration::from_millis(1), HandsFree),
            (Hybrid, Recording, true, true, short, Stop),
            (Hybrid, Recording, true, false, short, Ignore),
            (Hybrid, Recording, false, true, short, Ignore),
            (Hybrid, Transcribing, true, true, short, Ignore),
            (Hybrid, Idle, false, false, short, Ignore),
            (PushToTalk, Recording, false, false, short, Stop),
            (PushToTalk, Recording, false, true, short, Ignore),
            (PushToTalk, Recording, true, true, short, Stop),
            (Toggle, Idle, false, true, short, Start),
            (Toggle, Recording, true, false, long, Ignore),
            (Toggle, Recording, true, true, short, Stop),
            (Toggle, Transcribing, true, true, short, Ignore),
        ];
        for (mode, phase, hf, pressed, held, want) in table {
            assert_eq!(decide(mode, phase, hf, pressed, held), want, "{mode:?} {phase:?} hf={hf} pressed={pressed} {held:?}");
        }
    }
}
