//! Dictation state machine. Every input (hotkey, Esc, UI, tray, timers, finished
//! transcriptions) goes through one channel into one worker thread, so the phase logic is
//! single-threaded. The worker never runs inside the global-shortcut handler, which holds the
//! plugin's shortcut lock (registering Esc from there would deadlock).

use crate::{ai_key, api_key, AppState};
use serde::Serialize;
use std::panic::{catch_unwind, AssertUnwindSafe};
use std::path::PathBuf;
use std::sync::atomic::Ordering;
use std::sync::mpsc::{Receiver, Sender};
use std::thread;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Shortcut};
use voxflow_core::audio::{self, is_probably_silent, Recorder, SilenceDetector, MAX_DURATION, MIN_SAMPLES};
use voxflow_core::history::HistoryEntry;
use voxflow_core::output::{deliver, Delivered};
use voxflow_core::cleanup::{self, Cleaned};
use voxflow_core::settings::{Backend, Cleanup, HotkeyMode, Settings};
use voxflow_core::{decode, models, transcribe::{remote, LocalEngine}};

#[derive(Serialize, Clone, Copy, PartialEq, Eq, Debug, Default)]
#[serde(rename_all = "lowercase")]
pub enum Phase {
    #[default]
    Idle,
    Recording,
    Transcribing,
    Cleaning,
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

/// No audio within this long of starting → the mic is dead or blocked (SPEC v3).
pub const WARMUP: Duration = Duration::from_millis(1500);

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
        (Phase::Transcribing | Phase::Cleaning, _) | (_, false) => Action::Ignore,
        (_, true) => Action::Start, // Idle, or Done/Error still on screen
    }
}

/// Guards for worker-timer and paste-last inputs (other inputs: true). `gen`, `phase`,
/// `hands_free`, `heard` are the worker's current values.
fn admits(input: &Input, gen: u64, phase: Phase, hands_free: bool, heard: bool) -> bool {
    let recording = phase == Phase::Recording;
    match *input {
        Input::Heard(g) => g == gen,
        Input::Warmup(g) => g == gen && recording && !heard,
        Input::Silence(g) => g == gen && recording && hands_free,
        Input::PasteLast => !matches!(phase, Phase::Recording | Phase::Transcribing | Phase::Cleaning),
        _ => true,
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
    /// First level block of this recording arrived.
    Heard(u64),
    /// Warm-up deadline: no audio by now → "Microphone not responding".
    Warmup(u64),
    /// [`audio::SILENCE_STOP`] of silence; stops hands-free recordings.
    Silence(u64),
    /// Paste-last hotkey: re-deliver the most recent transcript.
    PasteLast,
    /// Transcript ready, AI cleanup running (basic is instant and skips this state).
    Cleaning(u64),
    /// `paste`: false for "Transcribe file" (clipboard only).
    Transcribed { gen: u64, settings: Box<Settings>, paste: bool, result: Result<Outcome, String> },
    /// Transcribe an audio file through the same pipeline as a recording.
    File(PathBuf),
    /// Run the overlay demo this many times (no mic, clipboard, paste or history).
    Demo(u32),
    /// Demo timer: move to this phase (`Recording` = next cycle).
    DemoStep(u64, Phase),
    DemoLevel(u64, f32),
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

#[derive(Debug)]
pub struct Outcome {
    raw: String,
    cleaned: Cleaned,
    duration_ms: u64,
}

#[derive(Debug)]
enum Step {
    Idle,
    Fail(String),
    Deliver(Outcome),
}

fn triage(result: Result<Outcome, String>) -> Step {
    match result {
        // No speech: nothing to paste or save, silently.
        Ok(o) if o.raw.is_empty() => Step::Idle,
        Ok(o) if o.cleaned.text.is_empty() => Step::Fail("Nothing to paste — only filler words".into()),
        Ok(o) => Step::Deliver(o),
        Err(e) => Step::Fail(e),
    }
}

/// Done message and display time (DESIGN §2.3).
fn done_message(delivered: Delivered, ai_failed: bool) -> (String, u64) {
    let (msg, ms) = match delivered {
        Delivered::Pasted => ("Pasted", 1600),
        Delivered::Copied => ("Copied", 2000),
    };
    if ai_failed {
        (format!("{msg} · AI cleanup failed, used basic"), 2400)
    } else {
        (msg.to_owned(), ms)
    }
}

#[derive(Serialize, Clone)]
struct StateEvent<'a> {
    state: Phase,
    #[serde(skip_serializing_if = "Option::is_none")]
    message: Option<&'a str>,
    #[serde(skip_serializing_if = "Option::is_none")]
    mode: Option<&'static str>,
    /// Done only: final text and the raw transcript it was cleaned from.
    #[serde(skip_serializing_if = "Option::is_none")]
    text: Option<&'a str>,
    #[serde(skip_serializing_if = "Option::is_none")]
    raw: Option<&'a str>,
}

/// What Whisper might hear from the demo clip ([`audio::DEMO_CLIP_TEXT`]): the clip is clean
/// read speech, so this is a hand-made disfluent version of it for basic cleanup to fix.
const DEMO_RAW: &str =
    "um the work wasn't uh finished at 11:00 p.m. Friday, so they they decided to carry it over to the following Monday.";

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
    /// Overlay demo running (any phase, including the gap between cycles).
    demo: bool,
    /// Demo cycles still to run after the current one.
    demo_left: u32,
    /// Demo clip or sound cue playing; dropping it stops the sound.
    playback: Option<Sender<()>>,
    /// Current recording has delivered audio (warm-up check).
    heard: bool,
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
        demo: false,
        demo_left: 0,
        playback: None,
        heard: false,
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
        // Real activity aborts the demo: Esc/cancel/stop just hide it, a start or file proceeds.
        if self.demo {
            match input {
                Input::Esc | Input::Cancel | Input::Stop => return self.abort_demo(),
                // A new preview restarts the demo.
                Input::Key { pressed: true, .. }
                | Input::Start
                | Input::Tray
                | Input::File(_)
                | Input::Demo(_)
                | Input::PasteLast => {
                    self.abort_demo()
                }
                _ => {}
            }
        }
        let active = matches!(self.phase, Phase::Recording | Phase::Transcribing | Phase::Cleaning);
        let ok = admits(&input, self.gen, self.phase, self.hands_free, self.heard);
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
                Phase::Transcribing | Phase::Cleaning => self.cancel(),
                _ => self.start(true, Instant::now()),
            },
            Input::AutoStop(gen) if gen == self.gen && self.phase == Phase::Recording => self.stop(),
            Input::Heard(_) if ok => self.heard = true,
            Input::Warmup(_) if ok => self.fail("Microphone not responding".into()),
            Input::Silence(_) if ok => self.stop(),
            Input::PasteLast if ok => self.paste_last(),
            Input::Cleaning(gen) if gen == self.gen && self.phase == Phase::Transcribing => {
                self.emit(Phase::Cleaning, None)
            }
            Input::Transcribed { gen, settings, paste, result }
                if gen == self.gen && matches!(self.phase, Phase::Transcribing | Phase::Cleaning) =>
            {
                match triage(result) {
                    Step::Idle => self.go_idle(),
                    Step::Fail(e) => self.fail(e),
                    Step::Deliver(o) => self.output(o, &settings, paste),
                }
            }
            Input::File(path) if !active => {
                self.gen += 1;
                self.hands_free = true;
                show_pill(&self.app);
                self.set_esc(true);
                self.emit(Phase::Transcribing, None);
                self.process(false, move || decode::decode_file(&path).map_err(|e| format!("{e:#}")));
            }
            Input::Demo(cycles) if !active && !self.demo && cycles > 0 => {
                self.gen += 1;
                self.set_demo(true);
                self.demo_left = cycles - 1;
                self.demo_cycle();
            }
            Input::DemoStep(gen, next) if gen == self.gen && self.demo => self.demo_step(next),
            Input::DemoLevel(gen, level) if gen == self.gen && self.demo && self.phase == Phase::Recording => {
                let _ = self.app.emit_to("pill", "dictation://level", LevelEvent { level });
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
        self.gen += 1;
        self.heard = false;
        let (app, tx, gen) = (self.app.clone(), self.tx.clone(), self.gen);
        let skip = if s.sounds { audio::CUE_SKIP } else { Duration::ZERO };
        let (mut heard, mut silence) = (false, SilenceDetector::skipping(skip));
        let rec = Recorder::start(s.input_device.as_deref(), move |level| {
            let _ = app.emit_to("pill", "dictation://level", LevelEvent { level });
            if !heard {
                heard = true;
                let _ = tx.send(Input::Heard(gen));
            }
            if silence.push(level) {
                let _ = tx.send(Input::Silence(gen));
            }
        });
        show_pill(&self.app);
        match rec {
            Ok(r) => self.recorder = Some(r),
            Err(e) => return self.fail(format!("Microphone: {e:#}")),
        }
        if s.sounds {
            self.playback = Some(audio::play(audio::tone(880.0, 1320.0, 90)));
        }
        self.pressed_at = at;
        self.hands_free = hands_free;
        self.set_esc(true);
        self.emit(Phase::Recording, None);
        self.after(WARMUP.as_millis() as u64, Input::Warmup(gen));
        self.after(MAX_DURATION.as_millis() as u64, Input::AutoStop(gen));
    }

    fn stop(&mut self) {
        let Some(rec) = self.recorder.take() else { return };
        let samples = match rec.stop() {
            Ok(s) => s,
            Err(e) => return self.fail(format!("{e:#}")),
        };
        let sounds = self.settings().sounds;
        if sounds {
            self.playback = Some(audio::play(audio::tone(1320.0, 880.0, 120)));
        }
        let skip = if sounds { audio::CUE_SKIP } else { Duration::ZERO };
        if samples.len() < MIN_SAMPLES || is_probably_silent(&samples, skip) {
            return self.go_idle();
        }
        self.emit(Phase::Transcribing, None);
        self.process(true, move || Ok(samples));
    }

    /// Off the worker thread: load audio → transcribe → cleanup → `Input::Transcribed`.
    fn process(&self, paste: bool, load: impl FnOnce() -> Result<Vec<f32>, String> + Send + 'static) {
        let (app, tx, gen, settings) = (self.app.clone(), self.tx.clone(), self.gen, self.settings());
        thread::spawn(move || {
            // A panic (e.g. in a decoder) must still report back, or the pill hangs in Transcribing.
            let result = catch_unwind(AssertUnwindSafe(load))
                .unwrap_or_else(|_| Err("could not decode file".into()))
                .and_then(|audio| catch_unwind(AssertUnwindSafe(|| {
                let duration_ms = audio.len() as u64 * 1000 / 16_000;
                let raw = transcribe(&app.state::<AppState>(), &settings, &audio)?;
                drop(audio);
                if raw.is_empty() {
                    let cleaned = Cleaned { text: String::new(), note: None };
                    return Ok(Outcome { raw, cleaned, duration_ms });
                }
                if settings.cleanup == Cleanup::Ai {
                    let _ = tx.send(Input::Cleaning(gen));
                }
                let key = (settings.cleanup == Cleanup::Ai).then(ai_key).flatten();
                let cleaned = cleanup::run(&raw, &settings, key.as_deref());
                Ok(Outcome { raw, cleaned, duration_ms })
            })).unwrap_or_else(|_| Err("transcription failed".into())));
            let _ = tx.send(Input::Transcribed { gen, settings: Box::new(settings), paste, result });
        });
    }

    fn cancel(&mut self) {
        self.recorder = None; // dropping discards the audio
        self.gen += 1; // a pending transcription result is now stale
        self.go_idle();
    }

    fn output(&mut self, o: Outcome, s: &Settings, paste: bool) {
        let Outcome { raw, cleaned: Cleaned { text, note }, duration_ms } = o;
        self.set_esc(false);
        self.wait_hotkey_release();
        let delivered = match deliver(&text, paste && s.auto_paste, s.restore_clipboard) {
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
            h.push(HistoryEntry::new(text.clone(), s.backend, model, duration_ms).with_raw(&raw));
            if let Err(e) = h.save() {
                eprintln!("voxflow: saving history failed: {e:#}");
            }
            drop(h);
            let _ = self.app.emit("history://changed", ());
        }
        *state.last_text.lock().unwrap() = Some(text.clone());
        if let Some(note) = &note {
            eprintln!("voxflow: AI cleanup failed, used basic: {note}");
        }
        let (msg, ms) = done_message(delivered, note.is_some());
        self.emit_full(Phase::Done, Some(&msg), Some(&text), Some(&raw));
        self.after(ms, Input::Expire(self.gen));
    }

    /// The stop (or paste-last) may have been a key press: pasting while the hotkey's
    /// modifiers are still down would send e.g. Ctrl+Shift+V. Wait for the release (bounded).
    /// ponytail: held longer than 1.5 s → we paste anyway and may send a modified Ctrl+V;
    /// poll real modifier state (OS API) if that shows up in practice.
    fn wait_hotkey_release(&self) {
        let t = Instant::now();
        while self.state().hotkey_down.load(Ordering::Relaxed) && t.elapsed() < Duration::from_millis(1500) {
            thread::sleep(Duration::from_millis(20));
        }
    }

    /// Paste-last hotkey: same output path as a dictation (no history, no raw), done flash.
    fn paste_last(&mut self) {
        let Some(text) = crate::last_transcript(&self.app) else { return };
        let s = self.settings();
        self.gen += 1; // a pending Expire/HideWindow from the previous done state is stale
        show_pill(&self.app);
        self.wait_hotkey_release();
        let delivered = match deliver(&text, s.auto_paste, s.restore_clipboard) {
            Ok(d) => d,
            Err(e) => return self.fail(format!("{e:#}")),
        };
        let (msg, ms) = done_message(delivered, false);
        self.emit_full(Phase::Done, Some(&msg), Some(&text), None);
        self.after(ms, Input::Expire(self.gen));
    }

    fn demo_cycle(&mut self) {
        self.hands_free = true;
        show_pill(&self.app);
        self.set_esc(true);
        self.emit(Phase::Recording, None);
        let (tx, gen) = (self.tx.clone(), self.gen);
        // Real audio: the bundled clip's level envelope, streamed in real time through the
        // same level path as the mic while the clip plays on the speakers.
        let clip = voxflow_core::decode::decode_bytes(audio::DEMO_CLIP, "mp3").unwrap_or_else(|e| {
            eprintln!("voxflow: demo clip: {e:#}");
            Vec::new()
        });
        let levels = audio::envelope(&clip);
        let block = Duration::from_millis(audio::LEVEL_BLOCK_MS);
        let len = block * levels.len() as u32;
        self.playback = Some(audio::play(clip));
        thread::spawn(move || {
            let start = Instant::now();
            for (i, level) in levels.into_iter().enumerate() {
                // Paced by wall clock (block i ends at (i+1)·block), so sleeps don't drift.
                thread::sleep((start + block * (i as u32 + 1)).saturating_duration_since(Instant::now()));
                if tx.send(Input::DemoLevel(gen, level)).is_err() {
                    break;
                }
            }
        });
        self.after(len.as_millis() as u64, Input::DemoStep(gen, Phase::Transcribing));
    }

    fn demo_step(&mut self, next: Phase) {
        let gen = self.gen;
        match next {
            Phase::Recording => self.demo_cycle(),
            Phase::Transcribing => {
                self.playback = None;
                self.emit(Phase::Transcribing, None);
                self.after(1200, Input::DemoStep(gen, Phase::Cleaning));
            }
            Phase::Cleaning => {
                self.emit(Phase::Cleaning, None);
                self.after(900, Input::DemoStep(gen, Phase::Done));
            }
            Phase::Done => {
                let text = cleanup::basic(DEMO_RAW, "en");
                self.emit_full(Phase::Done, Some("Pasted"), Some(&text), Some(DEMO_RAW));
                self.after(2000, Input::DemoStep(gen, Phase::Idle));
            }
            Phase::Idle => {
                self.go_idle();
                if self.demo_left > 0 {
                    self.demo_left -= 1;
                    self.after(1500, Input::DemoStep(gen, Phase::Recording));
                } else {
                    self.set_demo(false);
                }
            }
            Phase::Error => {}
        }
    }

    /// Mirrored into `Status` so commands don't treat a running demo as busy.
    fn set_demo(&mut self, on: bool) {
        self.demo = on;
        self.state().status.lock().unwrap().demo = on;
    }

    fn abort_demo(&mut self) {
        self.playback = None;
        self.set_demo(false);
        self.gen += 1; // pending demo steps and levels are now stale
        self.go_idle();
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
        self.emit_full(phase, message, None, None);
    }

    fn emit_full(&mut self, phase: Phase, message: Option<&str>, text: Option<&str>, raw: Option<&str>) {
        self.phase = phase;
        {
            let state = self.state();
            let mut st = state.status.lock().unwrap();
            st.phase = phase;
            st.message = message.map(str::to_owned);
        }
        let mode = (phase == Phase::Recording)
            .then_some(if self.hands_free { "toggle" } else { "push_to_talk" });
        let _ = self.app.emit("dictation://state", StateEvent { state: phase, message, mode, text, raw });
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
            // `process` catches a panic mid-transcription; the engine may be half-updated, so
            // a poisoned lock gets a fresh engine (the model reloads on next use).
            let mut engine = state.engine.lock().unwrap_or_else(|e| {
                eprintln!("voxflow: local engine poisoned by an earlier panic; resetting");
                state.engine.clear_poison();
                let mut g = e.into_inner();
                *g = LocalEngine::new();
                g
            });
            engine.transcribe(&path, audio, &s.language)
        }
        Backend::Remote => remote::transcribe(&s.remote, api_key().as_deref(), audio, &s.language),
    };
    r.map(|t| t.trim().to_owned()).map_err(|e| format!("{e:#}"))
}

/// Bottom-center of the monitor under the cursor (else primary), DESIGN §2.1: window bottom
/// 14 px above the work-area bottom, so the pill body (10 px bottom margin) sits 24 px above it.
fn show_pill(app: &AppHandle) {
    let Some(pill) = app.get_webview_window("pill") else { return };
    let monitor = app
        .cursor_position()
        .ok()
        .and_then(|p| app.monitor_from_point(p.x, p.y).ok().flatten())
        .or_else(|| app.primary_monitor().ok().flatten());
    if let Some(m) = monitor {
        let s = m.scale_factor();
        let (w, h) = ((440.0 * s) as i32, (240.0 * s) as i32);
        let wa = m.work_area();
        // No work-area info (work area == monitor): assume a taskbar, 62 px up.
        let margin = if wa.size == *m.size() { 62.0 } else { 12.0 };
        let bottom = wa.position.y + wa.size.height as i32 - (margin * s) as i32;
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
    fn demo_raw_cleans_to_clip_text() {
        assert_eq!(cleanup::basic(DEMO_RAW, "en"), audio::DEMO_CLIP_TEXT);
    }

    #[test]
    fn transcribed_result_mapping() {
        let o = |raw: &str, text: &str, note: Option<&str>| {
            Ok(Outcome {
                raw: raw.into(),
                cleaned: Cleaned { text: text.into(), note: note.map(Into::into) },
                duration_ms: 1,
            })
        };
        assert!(matches!(triage(o("", "", None)), Step::Idle));
        assert!(matches!(triage(o("um", "", None)), Step::Fail(m) if m == "Nothing to paste — only filler words"));
        assert!(matches!(triage(o("um hi", "Hi", Some("x"))), Step::Deliver(d) if d.cleaned.text == "Hi"));
        assert!(matches!(triage(Err("boom".into())), Step::Fail(m) if m == "boom"));
        #[rustfmt::skip]
        let table = [
            (Delivered::Pasted, false, "Pasted", 1600),
            (Delivered::Copied, false, "Copied", 2000),
            (Delivered::Pasted, true, "Pasted · AI cleanup failed, used basic", 2400),
            (Delivered::Copied, true, "Copied · AI cleanup failed, used basic", 2400),
        ];
        for (d, ai_failed, msg, ms) in table {
            assert_eq!(done_message(d, ai_failed), (msg.to_owned(), ms), "{d:?} {ai_failed}");
        }
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
            (Hybrid, Cleaning, true, true, short, Ignore),
            (Toggle, Cleaning, false, true, short, Ignore),
        ];
        for (mode, phase, hf, pressed, held, want) in table {
            assert_eq!(decide(mode, phase, hf, pressed, held), want, "{mode:?} {phase:?} hf={hf} pressed={pressed} {held:?}");
        }
    }

    #[test]
    fn input_guards() {
        #[rustfmt::skip]
        let table = [
            // input, phase, hands_free, heard → admitted (worker gen is 2)
            (Input::Heard(2), Idle, false, false, true),
            (Input::Heard(1), Recording, false, false, false),
            (Input::Warmup(2), Recording, false, false, true),
            (Input::Warmup(2), Recording, false, true, false),
            (Input::Warmup(2), Transcribing, false, false, false),
            (Input::Warmup(1), Recording, false, false, false),
            (Input::Silence(2), Recording, true, true, true),
            (Input::Silence(2), Recording, false, true, false),
            (Input::Silence(2), Transcribing, true, true, false),
            (Input::Silence(1), Recording, true, true, false),
            (Input::PasteLast, Idle, false, false, true),
            (Input::PasteLast, Done, false, false, true),
            (Input::PasteLast, Recording, false, false, false),
            (Input::PasteLast, Cleaning, false, false, false),
        ];
        for (input, phase, hf, heard, want) in table {
            assert_eq!(admits(&input, 2, phase, hf, heard), want, "{phase:?} hf={hf} heard={heard}");
        }
    }
}
