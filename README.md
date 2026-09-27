# VoxFlow

VoxFlow is a desktop voice-dictation app. Press your hotkey anywhere to record speech, transcribe it locally or via API, and paste the result into any focused window. Windows is the primary platform; X11 Linux is secondary.

## Features

- **Global hotkey** (default Ctrl+Shift+Space): hold to record, release to transcribe (push-to-talk); or tap for hands-free mode
- **Local transcription** via whisper.cpp with cached model contexts
- **Remote transcription** via OpenAI-compatible APIs (presets for OpenAI, Groq, self-hosted faster-whisper)
- **Automatic paste** into focused apps, with optional clipboard restoration
- **Live waveform** pill overlay showing recording levels
- **History** of transcriptions (last 200, searchable)
- **Settings window** with sections for hotkey, backend, model selection, input device, language, history
- **OS credential store** for API keys (Windows Credential Manager or Linux Secret Service)
- **Tray menu** with quick start/stop, copy last transcription

## Usage

**Default hotkey: Ctrl+Shift+Space**

- **Hold ≥350ms, then release** = stop recording and transcribe (push-to-talk)
- **Tap (<350ms)** = start hands-free recording; press again to stop
- **Esc** = cancel recording or transcription (while the pill is visible)

The pill overlay (bottom-center) shows recording state with a live waveform, transcribing state with a spinner, and briefly displays "Pasted" or error messages before hiding.

**First run:** If using Local backend, you'll need to download a model (default `base`; open Settings → Transcription). Remote backend requires an API key (saved securely in your OS keyring).

**Server presets:**
- **OpenAI:** `https://api.openai.com/v1`, models `whisper-1`, `gpt-4o-mini-transcribe`
- **Groq:** `https://api.groq.com/openai/v1`, model `whisper-large-v3-turbo`
- **Local server:** `http://localhost:8000/v1` (for speaches/faster-whisper-server)

## Build on Windows

**Prerequisites:**
1. **Rust MSVC toolchain** via rustup (`x86_64-pc-windows-msvc`)
2. **Visual Studio 2022 Build Tools** with "Desktop development with C++"
3. **CMake** (add to PATH)
4. **LLVM/clang** with libclang (download from LLVM.org, set `LIBCLANG_PATH` env var, **restart shell**)
5. **WebView2 runtime** (pre-installed on Windows 11)
6. **bun** package manager

```bash
bun install
bun tauri dev          # Run in development
bun tauri build        # Build production binaries → target/release/bundle/{nsis,msi}
```

**GPU acceleration:** Optional: change the `whisper-rs` line in `core/Cargo.toml` to `whisper-rs = { version = "0.16", optional = true, features = ["vulkan"] }` (requires the Vulkan SDK) for GPU-accelerated transcription. To build without local Whisper (remote-only), edit `src-tauri/Cargo.toml` to set `voxflow-core = { path = "../core", default-features = false }`.

## Build on Linux (X11)

**Prerequisites via apt:**
```bash
sudo apt install cmake clang libclang-dev libasound2-dev libwebkit2gtk-4.1-dev \
  libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev
```

**Global hotkeys and paste simulation require X11.** Wayland has no global-hotkey support; hotkey registration and simulated Ctrl+V paste may fail silently. Fallback: copy to clipboard only.

**No-root dev environment (for WSL or restricted systems):**
```bash
./scripts/bootstrap-sysroot.sh    # Downloads -dev packages locally
source scripts/linux-dev-env.sh   # Sets PKG_CONFIG_*, LIBCLANG_PATH, etc.
bun install && bun tauri build
```

## Development

```bash
bun test              # Run schema/zod tests (frontend)
cargo test --workspace  # Run core/app tests
bun run dev           # Browser preview (mock backend, no Tauri IPC)
```

## Project layout

- `src/` — React UI (Vite)
- `src-tauri/` — Tauri app shell, global hotkey, tray, IPC handlers
- `core/` — Cargo crate `voxflow-core`: audio capture, transcription backends, model catalog, settings/history persistence, clipboard/paste

## Data locations

- **Settings:** `$APP_CONFIG_DIR/settings.json` (hotkey, backend, language, etc.)
- **History & models:** `$APP_DATA_DIR/history.json`, `$APP_DATA_DIR/models/`
- **Bundle identifier:** `com.voxflow.app`
  - Windows: `%APPDATA%\com.voxflow.app`
  - Linux: `~/.local/share/com.voxflow.app` (data), `~/.config/com.voxflow.app` (config)
- **API keys:** OS keyring only (never JSON or logs)

## Known limitations

- **Unsigned binaries:** Windows SmartScreen may warn on first run
- **Wayland:** Global hotkeys do not work; Ctrl+V paste may fail (copy-to-clipboard fallback provided)
- **Modifier-only hotkeys:** Not supported (e.g., can't use Ctrl+Win with no letter; register shortcuts must include at least one non-modifier key)
- **Model checksums:** Downloads are pinned to a fixed whisper.cpp HuggingFace commit and verified by size and SHA-256 before use
