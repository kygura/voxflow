# voxflow — Technical Research (2026-09-27)

Wispr Flow clone: Tauri v2 + React/TS (bun) + Rust core. Windows primary, Linux secondary.
All versions checked against crates.io API / npm registry on 2026-09-27. Where a WebFetch summary
could not confirm an exact detail from the live doc, this is flagged explicitly — verify against
the cited URL before relying on it.

---

## 1. Tauri v2 core + multi-window "pill" overlay

**Versions (crates.io / npm, 2026-09-27):**
- `tauri` = 2.12.0 — https://crates.io/api/v1/crates/tauri
- `tauri-build` = 2.7.0 — https://crates.io/api/v1/crates/tauri-build
- `@tauri-apps/cli` = 2.12.0 — https://registry.npmjs.org/@tauri-apps/cli/latest
- `@tauri-apps/api` = 2.12.0 — https://registry.npmjs.org/@tauri-apps/api/latest

**WebviewWindowBuilder (src-tauri, Rust)** — https://docs.rs/tauri/2.12.0/tauri/webview/struct.WebviewWindowBuilder.html
```rust
.transparent(bool)   // window should be transparent
.decorations(bool)   // borders/title bar
.always_on_top(bool)
.skip_taskbar(bool)  // hide icon from taskbar
.focused(bool)       // initially focused or not
.focusable(bool)     // whether window can receive focus at all
.visible(bool)       // visible immediately on creation
.position(x: f64, y: f64)     // logical pixels
.inner_size(width: f64, height: f64)
```
For the pill overlay: `.transparent(true).decorations(false).always_on_top(true).skip_taskbar(true).focused(false).focusable(false)`.

**Runtime methods on `WebviewWindow`** — https://docs.rs/tauri/2.12.0/tauri/webview/struct.WebviewWindow.html
```rust
pub fn show(&self) -> Result<()>
pub fn set_focus(&self) -> Result<()>
pub fn set_focusable(&self, focusable: bool) -> Result<()>
pub fn set_ignore_cursor_events(&self, ignore: bool) -> Result<()>   // click-through
pub fn set_always_on_top(&self, always_on_top: bool) -> Result<()>
pub fn set_skip_taskbar(&self, skip: bool) -> Result<()>
pub fn set_position<Pos: Into<Position>>(&self, position: Pos) -> Result<()>
pub fn current_monitor(&self) -> Result<Option<Monitor>>
pub fn primary_monitor(&self) -> Result<Option<Monitor>>
```

**Show without stealing focus:** `show()` itself just makes the window visible — the docs text
does not state it forces OS activation, but the standard Tauri idiom for "no-steal-focus" popups is
to build the window with `.focused(false).focusable(false)` up front and call `show()` (not
`set_focus()`) at runtime. There is no separate `show_without_activate()` API in 2.x; combining
`focusable(false)` (build-time) + `set_focusable(false)` (runtime, if you need to toggle it back on
when the pill becomes interactive) is the mechanism. **Verify actual Windows activation behavior in
a build** — WebFetch could not pull the prose note from the docs page; this matches community
reports that on Windows, `.focused(false)` at window creation is the load-bearing flag, not `show()`.

**Bottom-center-of-primary-monitor positioning (runtime, Rust):**
```rust
if let Some(monitor) = window.primary_monitor()? {
    let size = monitor.size();      // PhysicalSize<u32>, monitor pixels
    let win_size = window.outer_size()?;
    let x = (size.width as i32 - win_size.width as i32) / 2;
    let y = size.height as i32 - win_size.height as i32 - 40; // 40px margin above taskbar
    window.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x, y }))?;
}
```

**Click-through:** `window.set_ignore_cursor_events(true)` — confirmed API on `WebviewWindow`.

**Transparency:**
- No `macOSPrivateApi` needed — that flag is macOS-only, irrelevant here.
- Windows 10/11: transparency on WebView2 works but the *window frame* (not the webview content)
  needs `decorations(false)` + `transparent(true)`; known WebView2 gotcha is that transparent
  windows can show a black/white flash on first paint until the webview's background-color is set
  to `transparent` in CSS (`html, body { background: transparent; }`).
- Linux (GTK/WebKitGTK): transparency requires a compositor (works on GNOME/KDE Wayland/X11 with a
  compositing WM); on non-compositing X11 window managers transparency silently renders as black.
  This is a well-known Tauri/GTK limitation, not something fixable in-app.

Source: https://v2.tauri.app/ (config schema, capabilities model) and https://docs.rs/tauri/2.12.0/tauri/

---

## 2. tauri-plugin-global-shortcut (push-to-talk)

**Version:** `tauri-plugin-global-shortcut` = 2.4.0 — https://crates.io/api/v1/crates/tauri-plugin-global-shortcut

**Rust API** — https://docs.rs/tauri-plugin-global-shortcut/latest/tauri_plugin_global_shortcut/
```rust
use tauri_plugin_global_shortcut::{Builder, ShortcutState, GlobalShortcutExt};

tauri::Builder::default()
    .plugin(
        Builder::new()
            .with_handler(|app, shortcut, event| {
                match event.state() {
                    ShortcutState::Pressed => { /* start recording */ }
                    ShortcutState::Released => { /* stop recording, transcribe */ }
                }
            })
            .build(),
    )
```
`ShortcutState` has exactly two variants: `Pressed` and `Released`. Confirmed both fire — this is
the plugin's whole reason to exist for push-to-talk use cases (it's the documented pattern in the
plugin's own examples). **Released firing on Windows**: yes, standard `WM_HOTKEY`/RegisterHotKey
release detection is what the plugin wraps. **Linux**: the plugin uses the `global-hotkey` crate
under the hood, which on X11 works via XGrabKey; on **Wayland it does not work at all** for
arbitrary global shortcuts (no portal-based global shortcut support in `global-hotkey` as of this
version) — this is a known upstream limitation of the `global-hotkey` crate, not just this plugin.
Test explicitly on your target Linux desktop (GNOME Wayland vs Wayland+KDE vs X11 session).

Runtime register/unregister via the app handle:
```rust
app.global_shortcut().register("CommandOrControl+Shift+Space")?;
app.global_shortcut().unregister("CommandOrControl+Shift+Space")?;
```
(`GlobalShortcutExt::global_shortcut()` trait method.) Re-registering with a new string is just
`unregister` then `register` with the new shortcut string.

**Shortcut string format:** `"CommandOrControl+Shift+Space"` — modifiers `CommandOrControl`
(aliased `CmdOrCtrl`), `Shift`, `Alt`, `Super`/`Meta`, joined with `+` to one non-modifier key or code.

**Modifier-only shortcuts (e.g. "Ctrl+Win" with no letter/key):** **not supported.** The
`global-hotkey`/OS hotkey APIs (RegisterHotKey on Windows, XGrabKey on X11) require at least one
non-modifier key in the combination; you cannot register a chord consisting solely of modifier keys.
If you want a "hold Fn/Ctrl" push-to-talk trigger, you need a different mechanism (e.g. a raw
low-level keyboard hook via `windows-rs`/`winapi` on Windows, since the global-shortcut plugin
can't express it) — flag this as a design constraint for voxflow's PTT key.

**Capabilities JSON** (`src-tauri/capabilities/default.json`):
```json
{
  "permissions": [
    "global-shortcut:allow-is-registered",
    "global-shortcut:allow-register",
    "global-shortcut:allow-unregister"
  ]
}
```
No shortcut permissions are enabled by default ("inherently dangerous" per plugin docs).

Source: https://v2.tauri.app/plugin/global-shortcut/, https://docs.rs/tauri-plugin-global-shortcut/latest/

---

## 3. Tray icon (Rust, tauri v2)

Tray support is built into the `tauri` crate itself via the `tray-icon` Cargo feature (not a
separate plugin crate) — enable in `Cargo.toml`: `tauri = { version = "2.12.0", features = ["tray-icon"] }`.

```rust
use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;

let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
let menu = Menu::with_items(app, &[&quit_i])?;

let _tray = TrayIconBuilder::new()
    .icon(app.default_window_icon().unwrap().clone())
    .menu(&menu)
    .show_menu_on_left_click(true)
    .on_menu_event(|app, event| match event.id.as_ref() {
        "quit" => app.exit(0),
        _ => {}
    })
    .on_tray_icon_event(|tray, event| { /* handle click/move */ })
    .build(app)?;
```

**Linux requirement:** the tray icon backend on Linux needs `libayatana-appindicator3` (or the
older `libappindicator3`) installed at runtime, and GTK's tray-icon click event is documented as
**unsupported on Linux** — "The event is not emitted even though the icon is shown and will still
show a context menu on right click" (per plugin/tray docs). Debian/Ubuntu package:
`libayatana-appindicator3-dev` at build time, `libayatana-appindicator3-1` at runtime.

Source: https://v2.tauri.app/plugin/system-tray/, https://docs.rs/tauri/2.12.0/tauri/tray/

---

## 4. single-instance / autostart / clipboard

**Versions (crates.io, 2026-09-27):**
- `tauri-plugin-single-instance` = 2.5.0
- `tauri-plugin-autostart` = 2.6.0
- `tauri-plugin-clipboard-manager` = 2.4.0
- `arboard` = 3.6.1

Sources: https://crates.io/api/v1/crates/tauri-plugin-single-instance,
https://crates.io/api/v1/crates/tauri-plugin-autostart,
https://crates.io/api/v1/crates/tauri-plugin-clipboard-manager,
https://crates.io/api/v1/crates/arboard

**Clipboard, Rust-side only — pick `arboard` directly, not the Tauri plugin.** The
`tauri-plugin-clipboard-manager` exists to expose clipboard read/write to the **JS frontend** via
IPC and needs capability grants (`clipboard-manager:allow-write-text` etc.); voxflow pastes
transcribed text into other apps from **Rust** (after simulating focus via enigo/paste), so there is
no need to round-trip through the webview. `arboard::Clipboard::new()?.set_text(String)` /
`get_text()` is simpler, has no IPC/permission overhead, and works headless from any Rust thread.
Only add the Tauri plugin if the React UI itself needs to read/write the system clipboard directly.

---

## 5. whisper-rs (local transcription)

**Versions:** `whisper-rs` = 0.16.0, `whisper-rs-sys` = 0.15.0 — https://crates.io/api/v1/crates/whisper-rs, https://crates.io/api/v1/crates/whisper-rs-sys

**Current API (0.16.0)** — https://docs.rs/whisper-rs/0.16.0/whisper_rs/
```rust
use whisper_rs::{WhisperContext, WhisperContextParameters, FullParams, SamplingStrategy};

let ctx = WhisperContext::new_with_params(
    "path/to/ggml-base.en.bin",
    WhisperContextParameters::default(),
)?;
let mut state = ctx.create_state()?;

let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
params.set_language(Some("en"));
params.set_n_threads(4);
params.set_translate(false);
params.set_print_progress(false);
params.set_print_special(false);

// audio: &[f32], 16 kHz, mono, raw PCM
state.full(params, &audio)?;

let num_segments = state.full_n_segments(); // c_int
for i in 0..num_segments {
    if let Some(segment) = state.get_segment(i) {
        let text = segment.to_str_lossy(); // or to_str()
        // segment.start_timestamp(), segment.end_timestamp()
    }
}
```
Also available: `state.as_iter()` returns a `WhisperStateSegmentIterator` for a for-loop instead of
manual index+`get_segment`. This segment-object API (`get_segment(i) -> Option<WhisperSegment>`,
`.to_str_lossy()`) is the **current (0.14+) shape**; older 0.12 code used free functions like
`state.full_get_segment_text(i)` directly on `WhisperState` — do not follow older blog posts/READMEs
that show that pattern, they're stale against 0.16.0.

**Windows build prerequisites:**
- MSVC (Visual Studio C++ Build Tools) in PATH.
- CMake in PATH (whisper.cpp is built via cmake from `whisper-rs-sys`'s build.rs).
- **LLVM/clang (libclang) IS required** — `whisper-rs-sys`'s `build.rs` depends on `bindgen` as a
  hard (non-optional) build-dependency, so bindings are generated at build time, not shipped
  pregenerated. Confirmed from the crate's own BUILDING.md: "Make sure you have installed and in the
  path: Visual Studio C++ … cmake … LLVM(clang)", plus set `LIBCLANG_PATH` env var and **restart
  your shell** after setting it (common footgun — a stale shell session with the old PATH silently
  fails or picks up a wrong libclang). — https://github.com/tazz4843/whisper-rs (BUILDING.md)
- Static CRT / long paths: not documented explicitly by the crate; general whisper.cpp/CMake-on-Windows
  advice applies (avoid deeply nested build paths, enable long-path support in Windows if the repo is
  nested deep, e.g. under OneDrive).

**Linux build prerequisites:** `cmake`, a C/C++ compiler (`gcc`/`clang`), and `clang`/`libclang-dev`
for bindgen (`sudo apt install cmake clang libclang-dev`).

**Feature flags** (Cargo.toml, all off by default): `cuda`, `vulkan`, `openblas` — enable one for GPU
acceleration. On Windows, `vulkan` is the practical cross-vendor GPU option (works on both AMD/NVIDIA/Intel
without CUDA toolkit installation); `cuda` requires the full NVIDIA CUDA Toolkit installed and in PATH.

Source: https://docs.rs/whisper-rs/0.16.0/whisper_rs/, https://github.com/tazz4843/whisper-rs

---

## 6. cpal (mic capture) + resampling

**Version:** `cpal` = 0.18.2 — https://crates.io/api/v1/crates/cpal

```rust
use cpal::traits::{HostTrait, DeviceTrait, StreamTrait};

let host = cpal::default_host();
let device = host.default_input_device().expect("no input device");
// enumerate by name:
for d in host.input_devices()? { println!("{}", d.name()?); }

let config = device.default_input_config()?;
let sample_format = config.sample_format();
let stream_config = config.into();

let err_fn = |e| eprintln!("stream error: {e}");
let stream = match sample_format {
    cpal::SampleFormat::F32 => device.build_input_stream(&stream_config,
        move |data: &[f32], _| { /* push to ring buffer */ }, err_fn, None)?,
    cpal::SampleFormat::I16 => device.build_input_stream(&stream_config,
        move |data: &[i16], _| { /* convert to f32 */ }, err_fn, None)?,
    cpal::SampleFormat::U16 => device.build_input_stream(&stream_config,
        move |data: &[u16], _| { /* convert to f32 */ }, err_fn, None)?,
    _ => panic!("unsupported sample format"),
};
stream.play()?;
```

**`Stream` is `!Send`** on cpal's underlying platform backends (WASAPI COM objects on Windows,
CoreAudio on macOS both use non-thread-safe handles) — this has been true across cpal's history and
is why the standard pattern is to **spawn a dedicated OS thread that creates the `Stream`, calls
`.play()`, and then parks/blocks that thread** (e.g. on a channel recv) for the stream's lifetime,
communicating audio data out via an `Arc<Mutex<..>>`/ring buffer/`std::sync::mpsc` channel rather
than moving the `Stream` itself across threads. WebFetch of the crate's README/docs.rs page in this
session did not surface an explicit `!Send` sentence (couldn't confirm/deny), so **verify against
`cargo doc` output for cpal 0.18.2 locally** (`cargo doc -p cpal --open`, check `Stream`'s auto-trait
impls) before relying on this — but the dedicated-thread pattern is safe and standard regardless.

**Resampling to 16 kHz mono:**
- `rubato` = 5.0.0 — https://crates.io/api/v1/crates/rubato. Rubato 5.x's docs point at an `Fft`
  resampler type as the simplest fixed-ratio option (`Fft::<f64>::new(rate_in, rate_out, chunk_size,
  channels, FixedSync::Both)`, then `.process_all(&input)`). **Note: rubato 5.0.0 is a recent major
  version with an API that differs substantially from the older widely-blogged `SincFixedIn`/
  `FftFixedIn` types from rubato 0.x** — re-check https://docs.rs/rubato/5.0.0/rubato/ directly when
  implementing, don't copy older rubato examples verbatim.
- **Argument for a simple linear resampler instead:** whisper.cpp/whisper-rs expects 16 kHz mono
  f32 and is not picky about resampling artifacts the way, say, a music pipeline is — speech energy
  is concentrated well under 8 kHz, so a plain linear (or even simple decimation for exact-integer
  ratios like 48000→16000 = ÷3) resampler introduces negligible aliasing versus what
  Whisper's own acoustic model can tolerate. Given cpal typically reports 44.1/48 kHz device rates,
  a basic linear interpolator is a handful of lines, has zero extra dependency surface, and is very
  likely "good enough" — pull in `rubato`'s FFT/sinc resampler only if you observe measurable WER
  degradation in testing. This is a reasonable ponytail-style simplification for a v1.

---

## 7. enigo (paste simulation)

**Version:** `enigo` = 0.6.1 — https://crates.io/api/v1/crates/enigo

```rust
use enigo::{Enigo, Settings, Keyboard, Key, Direction::{Press, Release, Click}};

let mut enigo = Enigo::new(&Settings::default())?;
enigo.key(Key::Control, Press)?;
enigo.key(Key::Unicode('v'), Click)?;
enigo.key(Key::Control, Release)?;
```

**Linux X11 vs Wayland:** enigo's X11 backend uses the `x11rb` crate (a Rust-native X11 client) — the
crate has moved away from requiring the system `libxdo`/`libxdotool` shared library that very old
enigo versions (pre-0.1) depended on; `x11rb` support is compiled in as part of normal Linux builds
(not a separate opt-in feature you must remember to enable — but **confirm the exact `Cargo.toml`
feature table for 0.6.1** at https://docs.rs/enigo/0.6.1/enigo/ before shipping, since exact
feature-gating changed across 0.1→0.2→0.3+ releases and WebFetch could not pull the crate's full
Cargo.toml features list this session).
**Wayland:** enigo added Wayland support via the `wayland` protocol extensions (`virtual-keyboard`
unstable protocol) but this **only works on compositors that implement that protocol** (wlroots-based:
Sway, etc.); **GNOME Wayland and KDE Plasma Wayland historically do NOT expose the virtual-keyboard
protocol to arbitrary apps for security reasons**, so simulated paste can silently fail to reach the
focused window under GNOME/KDE Wayland. This is a real, commonly-hit limitation for any
"auto-paste transcribed text" feature on Linux — plan a fallback (e.g. copy to clipboard + toast
"press Ctrl+V") for Wayland desktops where the key injection doesn't land.

Source: https://docs.rs/enigo/0.6.1/enigo/, https://github.com/enigo-rs/enigo

---

## 8. keyring (credential storage — OpenAI/Groq API keys)

**Version:** `keyring` = 4.2.0 — https://crates.io/api/v1/crates/keyring

**Important:** the task assumed "v3?" — the actual current major is **4.x**, which restructured the
crate around a `keyring-core` + pluggable "credential store" crates model. This is a bigger API
change than a typical point release; re-verify examples against the 4.x docs, not older v3 blog posts.

```rust
use keyring::Entry;

let entry = Entry::new("voxflow", "api-key")?;
entry.set_password("sk-...")?;
let secret = entry.get_password()?;
entry.delete_credential()?; // renamed from delete_password() in v3→v4 transition, per changelog
```

**Feature flags (Cargo.toml) — must be explicit, nothing useful is enabled with no features:**
```toml
keyring = { version = "4.2.0", features = ["windows-native-keyring-store", "sync-secret-service"] }
```
Per crates.io's published feature list for 4.2.0:
- `windows-native-keyring-store` — Windows Credential Manager (needed on Windows, primary target)
- `apple-native-keyring-store` — macOS/iOS Keychain
- `linux-keyutils-keyring-store` — Linux kernel keyring (session-only, no GUI prompt)
- `dbus-secret-service-keyring-store` — Secret Service via `dbus` crate (sync)
- `zbus-secret-service-keyring-store` — Secret Service via `zbus` crate (async-capable, no libdbus dependency) — **default feature**, recommended for Linux (GNOME Keyring/KWallet) since it avoids linking `libdbus`
- `android-native-keyring-store`, `cli`, `db-keystore` — not needed for voxflow

For voxflow (Windows primary + Linux secondary): `features = ["windows-native-keyring-store", "zbus-secret-service-keyring-store"]`.
**Verify this exact feature list against https://docs.rs/crate/keyring/4.2.0/features before pinning** —
WebFetch's summary of the crates.io "features" page (not a canonical docs.rs source) is the source
here, not the crate's own README, and feature names/defaults are exactly the kind of thing that
drifts between point releases.

---

## 9. Cloud transcription (OpenAI-compatible)

**Endpoint (OpenAI spec, also implemented by Groq / speaches / faster-whisper-server):**
```
POST {base}/audio/transcriptions
Content-Type: multipart/form-data
  file: <audio bytes>
  model: <model name>
  language: <optional ISO-639-1>
  response_format: json | text | srt | verbose_json | vtt
  prompt: <optional context string>
```

- **OpenAI**: `base = https://api.openai.com/v1`. Models: `whisper-1` (classic Whisper API model),
  `gpt-4o-transcribe`, `gpt-4o-mini-transcribe` (newer, lower-latency GPT-4o-based transcription
  models, OpenAI's recommended default over `whisper-1` for new integrations).
- **Groq**: `base = https://api.groq.com/openai/v1`. Models: `whisper-large-v3-turbo` (fast, Groq's
  recommended default), `whisper-large-v3` (higher accuracy, slower). — https://console.groq.com/docs/speech-to-text
- **speaches / faster-whisper-server** (self-hosted OpenAI-compatible server, formerly
  faster-whisper-server): default local URL is typically `http://localhost:8000/v1`, models named
  after the underlying faster-whisper/CTranslate2 model id (e.g. `Systran/faster-whisper-large-v3`,
  `deepdml/faster-whisper-large-v3-turbo-ct2`) — model naming is server-config-dependent since it's
  self-hosted, unlike the two hosted providers above; check whichever instance voxflow points at
  for its actual model catalog (`GET /v1/models`).

**reqwest dependency line** (multipart + rustls to avoid pulling openssl on Linux):
```toml
reqwest = { version = "0.13.5", features = ["multipart", "json", "rustls-tls"] }
```
Note: reqwest's TLS feature is commonly documented as `rustls-tls` (an umbrella that also pulls in a
default cert provider); if only a bare `rustls` feature is available at 0.13.5 confirm via
https://docs.rs/reqwest/0.13.5/reqwest/ which exact feature name gates rustls vs the default
`default-tls` (openssl-backed on Linux) — **do not enable default features** on Linux or you'll link
system OpenSSL, defeating the purpose (`default-features = false` + explicit `rustls-tls`).

```rust
let form = reqwest::multipart::Form::new()
    .text("model", "whisper-large-v3-turbo")
    .part("file", reqwest::multipart::Part::bytes(wav_bytes).file_name("audio.wav"));

let resp = client.post(format!("{base}/audio/transcriptions"))
    .bearer_auth(api_key)
    .multipart(form)
    .send().await?;
```

---

## 10. whisper.cpp ggml models (HuggingFace)

Repo: `ggerganov/whisper.cpp` on HuggingFace. URL pattern:
`https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-<name>.bin`

| Model | Filename | Size |
|---|---|---|
| tiny | `ggml-tiny.bin` | ~77.7 MB |
| tiny.en | `ggml-tiny.en.bin` | ~77.7 MB |
| base | `ggml-base.bin` | ~148 MB |
| base.en | `ggml-base.en.bin` | ~148 MB |
| small | `ggml-small.bin` | ~488 MB |
| small.en | `ggml-small.en.bin` | ~488 MB |
| medium | `ggml-medium.bin` | ~1.53 GB |
| large-v3-turbo | `ggml-large-v3-turbo.bin` | ~1.62 GB |
| large-v3-turbo-q5_0 | `ggml-large-v3-turbo-q5_0.bin` | ~574 MB |

Source: https://huggingface.co/ggerganov/whisper.cpp/tree/main (sizes as listed by the repo's file
browser; treat as approximate — HF displays rounded sizes, confirm exact byte counts via the repo's
`resolve` HEAD response or `models/download-ggml-model.sh` if exact values matter for a manifest).

**Checksums:** whisper.cpp's `models/download-ggml-model.sh` script (in the ggerganov/whisper.cpp
GitHub repo, not the HF repo) is the canonical downloader and historically has NOT shipped published
SHA1/SHA256 hashes inline in that script for all models — it primarily just curls the HF URL. If you
need integrity verification, compute and pin your own SHA256 at first download and diff on later
downloads, rather than relying on an upstream-published checksum list; **verify current state of
`models/download-ggml-model.sh` in the `ggerganov/whisper.cpp` GitHub repo directly** — this specific
detail was not independently re-confirmed via WebFetch in this session due to time budget.

---

## 11. App config/data dir (Tauri v2 path API)

```rust
use tauri::Manager; // brings `.path()` into scope on App/AppHandle/Window

fn setup(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let app_handle = app.handle();
    let config_dir = app_handle.path().app_config_dir()?;
    let data_dir = app_handle.path().app_data_dir()?;
    Ok(())
}
```
`Manager::path(&self) -> &PathResolver<R>` (confirmed signature,
https://docs.rs/tauri/2.12.0/tauri/trait.Manager.html). **Do not use `app.path_resolver()`** — that
was the Tauri v1 API and is gone in v2; the v2 replacement is the `path()` method shown above,
returning a `PathResolver` with `app_config_dir()`/`app_data_dir()`/`app_log_dir()` etc. Resolved
path is `<OS config dir>/<tauri.conf.json bundle identifier>` (e.g.
`%APPDATA%\com.voxflow.app` on Windows, `~/.config/com.voxflow.app` on Linux).

The plain `dirs` crate (= 7.0.0, https://crates.io/api/v1/crates/dirs) is an alternative for
non-Tauri-context code (e.g. a standalone CLI/test binary) but inside the Tauri app just use
`app.path()` — it already knows the configured bundle identifier and is one less dependency.

---

## Windows build prerequisites (summary)

- Visual Studio C++ Build Tools (MSVC) in PATH — required by both Tauri's Rust toolchain and
  whisper-rs-sys's cmake build.
- CMake in PATH — whisper-rs-sys builds whisper.cpp via CMake.
- **LLVM/clang (libclang)** in PATH, with `LIBCLANG_PATH` env var set — required for `bindgen` inside
  whisper-rs-sys; **restart the shell after setting this env var** (documented footgun).
- WebView2 runtime (present by default on Windows 11, may need installing on older Windows 10 builds)
  for the Tauri webview itself.
- Rust MSVC target (`x86_64-pc-windows-msvc`), not the GNU target, is the standard Tauri Windows target.
- Optional GPU accel: `vulkan` whisper-rs feature (broad GPU vendor support, no extra SDK beyond the
  Vulkan SDK/driver) vs `cuda` (needs full NVIDIA CUDA Toolkit installed).

## Linux build prerequisites (summary)

- `cmake`, `clang`/`libclang-dev`, a C/C++ compiler — for whisper-rs-sys.
- ALSA dev headers for cpal: `libasound2-dev` (Debian/Ubuntu) / `alsa-lib-devel` (Fedora).
- `libayatana-appindicator3-dev` (build) / `libayatana-appindicator3-1` (runtime) for the tray icon.
- WebKitGTK + GTK dev packages for Tauri itself (standard Tauri Linux prerequisite, e.g.
  `libwebkit2gtk-4.1-dev`, `libgtk-3-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev` on Debian/Ubuntu
  per Tauri's own Linux prerequisites doc — not independently re-fetched this session, standard for
  any Tauri v2 Linux build, verify against https://v2.tauri.app/start/prerequisites/#linux).
- Global shortcuts (`tauri-plugin-global-shortcut`) work on X11; **do not rely on them working under
  Wayland** — test on the actual target compositor.
- enigo's simulated Ctrl+V paste is similarly **X11-reliable, Wayland-unreliable** (GNOME/KDE Wayland
  block the virtual-keyboard protocol for arbitrary apps) — plan a clipboard-copy fallback for Wayland.
- `keyring` needs `zbus-secret-service-keyring-store` (or `linux-keyutils-keyring-store`) feature
  enabled explicitly; nothing works out of the box with default features alone on Linux.
