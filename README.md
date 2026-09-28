# VoxFlow

VoxFlow is a desktop voice-dictation app. Press your hotkey anywhere to record speech, transcribe it locally or via API, and paste the result into any focused window. Windows is the primary platform; X11 Linux is secondary.

## Features

- **Global hotkey** (default Ctrl+Shift+Space): hold to record, release to transcribe (push-to-talk); or tap for hands-free mode
- **Local transcription** via whisper.cpp with cached model contexts
- **Remote transcription** via OpenAI-compatible APIs (presets for OpenAI, Groq, self-hosted faster-whisper)
- **Conscious editing** (cleanup modes: off/basic/ai) removes disfluencies (um, uh, eh, este, stutters) and repairs punctuation; AI mode via OpenAI-compatible endpoint with presets (Ollama, LM Studio, OpenAI, Groq, OpenRouter, Anthropic), own keyring key, falls back to basic on any error; history keeps both raw and cleaned text
- **Automatic paste** into focused apps, with optional clipboard restoration
- **Live waveform** pill overlay (brutalist dark capsule, acid-lime accent) showing recording state (listening/transcribing/cleaning/done/error)
- **History** of transcriptions (last 200, searchable, raw text peek)
- **Settings window** with sections for hotkey, backend, model selection, input device, language, cleanup, AI endpoint, history, and cleanup playground
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

**AI cleanup presets (optional):**
- **Ollama:** `http://localhost:11434/v1`, model `llama3.2`
- **LM Studio:** `http://localhost:1234/v1`
- **OpenAI:** `https://api.openai.com/v1`
- **Groq:** `https://api.groq.com/openai/v1`
- **OpenRouter:** `https://openrouter.ai/api/v1`
- **Anthropic:** `https://api.anthropic.com/v1`

## Testing without a microphone

**Preview overlay** (Settings button): drives the pill through a demo cycle with sample voice levels and text (recording → transcribing → cleaning → done), never touches clipboard or history.

**CLI flag** `--demo`: repeats the demo cycle 5 times with 1.5 s gaps after launch. Aborted by any real dictation.

**Transcribe file…** (Settings button): opens a file picker for wav/mp3/m4a/ogg/flac (max 10 minutes), decodes and transcribes, copies result to clipboard without auto-pasting.

**Cleanup playground** (Settings): paste raw text → see basic and AI cleanup outputs side by side.

Tauri dev with demo flag: `bun tauri dev -- -- --demo`

## Build on Windows (native, alternative)

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

## Cross-compile from WSL (recommended)

Build `VoxFlow.exe` from WSL/Linux without installing anything on Windows. Uses
[cargo-xwin](https://github.com/rust-cross/cargo-xwin) (clang-cl + lld-link; the MSVC CRT and
Windows SDK are downloaded automatically). No sudo needed.

**One-time toolchain setup:**
```bash
# LLVM 21 unpacked into ~/.local/xtool (no root)
mkdir -p ~/.local/xtool/debs && cd ~/.local/xtool/debs
apt-get download clang-21 lld-21 llvm-21 libclang-cpp21 libllvm21 llvm-21-linker-tools \
  libclang-common-21-dev libclang-rt-21-dev
for d in *.deb; do dpkg -x "$d" ~/.local/xtool; done
cd -

uv tool install ninja
cargo install --locked cargo-xwin
rustup target add x86_64-pc-windows-msvc
./scripts/bootstrap-sysroot.sh   # libclang for bindgen (whisper-rs), also used by Linux builds
```

**Build** (runs `bun run build`, then cargo-xwin; optional arg copies the exe there):
```bash
./scripts/build-windows.sh                              # → target/x86_64-pc-windows-msvc/release/voxflow.exe
./scripts/build-windows.sh /mnt/c/Users/<you>/Desktop   # also copies VoxFlow.exe (stops a running copy first)
```
Override tool locations with `XTOOL=` / `SYSROOT=` if you unpacked them elsewhere. The exe
needs only the VC++ runtime and WebView2, both present on Windows 11.

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
