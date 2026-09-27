# VoxFlow — Specification

VoxFlow is a desktop voice-dictation app in the spirit of Wispr Flow: hold (or tap) a global
hotkey anywhere, speak, and the transcription is placed on the clipboard and pasted into
whatever app has focus. Windows is the primary target; Linux (X11) is secondary.

## Stack

- **Tauri v2** app shell (Rust) + **React + TypeScript** frontend built with **Vite**, managed
  with **bun**. **zod** validates every payload crossing the IPC boundary on the frontend side.
- Rust split into a Cargo workspace:
  - `core/` — crate `voxflow-core`: audio capture, resampling, WAV encoding, transcription
    backends, model catalog + downloader, settings + history persistence, clipboard/paste
    output. No Tauri dependency, so it is unit-testable anywhere.
  - `src-tauri/` — crate `voxflow`: the Tauri app (windows, tray, global hotkey, dictation state
    machine, IPC commands/events, keyring). Thin glue over `voxflow-core`.
- Frontend at repo root (`src/`, `index.html`, `pill.html`) — the standard Tauri layout, chosen
  over the usual `backend/`/`frontend/` split because the Tauri CLI and its docs assume it.
- Persistence: plain JSON files in the Tauri app config dir (`settings.json`) and app data dir
  (`history.json`, `models/`). API key in the OS keyring only (Windows Credential Manager /
  Secret Service), never in JSON, never in logs.
- Versions: see `docs/RESEARCH.md` (tauri 2.12, global-shortcut plugin 2.4, whisper-rs 0.16,
  cpal 0.18, enigo, arboard, keyring 4.x with explicit store features, reqwest with rustls).

## Core user flows

1. **Dictate (hybrid hotkey, default).** User presses the dictation hotkey
   (default `CommandOrControl+Shift+Space`). Recording starts immediately and the pill overlay
   appears bottom-center showing a live audio-level waveform.
   - If the key is **held** ≥ 350 ms and then released → recording stops (push-to-talk).
   - If the key is **tapped** (< 350 ms) → recording continues hands-free; the next press stops it.
   - While recording, **Esc** cancels (audio discarded, pill hides). Esc is registered as a global
     shortcut only while recording/transcribing so it is never swallowed otherwise.
   - Hotkey mode setting: `hybrid` (default), `push_to_talk` (release always stops), `toggle`
     (press starts/stops; release ignored).
2. **Transcribe.** Pill switches to a "transcribing" state. Audio (16 kHz mono f32) goes to the
   selected backend:
   - **Local**: whisper.cpp via whisper-rs with the selected ggml model. The loaded context is
     cached in memory and reused until the model setting changes.
   - **Remote**: OpenAI-compatible `POST {baseUrl}/audio/transcriptions` (multipart: `file`
     WAV, `model`, optional `language`, `response_format=json`), `Authorization: Bearer <key>`
     when a key is set (the key is only sent over https or to localhost). Presets: OpenAI (`https://api.openai.com/v1`, `whisper-1` /
     `gpt-4o-mini-transcribe`), Groq (`https://api.groq.com/openai/v1`,
     `whisper-large-v3-turbo`), Local server (speaches/faster-whisper-server,
     `http://localhost:8000/v1`). Timeout 60 s.
   - Recordings shorter than 0.3 s or with no speech-level audio are discarded silently.
     Recordings auto-stop at 10 minutes.
3. **Output.** Trimmed text is written to the clipboard. If *auto-paste* is on, VoxFlow
   simulates Ctrl+V into the focused app (the pill never takes focus), then, if *restore
   clipboard* is on, restores the previous clipboard text after ~200 ms. If paste simulation
   fails (e.g. Wayland), the text stays on the clipboard and the pill says "Copied". The pill
   briefly shows a success state, then hides. The entry is appended to history.
4. **Errors.** Missing model, network/HTTP error, bad key, no microphone → pill shows a short
   error for ~3 s; the full message is available in the main window (last error banner) and
   in history is not recorded.
5. **Settings window** (opened from tray, second launch, or first run). Sections:
   - **General**: hotkey (recorder: press a combo to capture it; validates it has a non-modifier
     key; re-registers live), hotkey mode, microphone device (default or by name), language
     (auto or ISO code), auto-paste toggle, restore-clipboard toggle, save-history toggle,
     theme (system/dark/light).
   - **Transcription**: backend selector (Local / Server).
     Local: model list (tiny, tiny.en, base, base.en, small, small.en, medium,
     large-v3-turbo, large-v3-turbo-q5_0) with size, download button + progress + cancel,
     delete, select-active. Server: preset picker, base URL, model name, API key field
     (write-only: shows "saved" state, never echoes the key back), "Test" button.
   - **History**: recent transcriptions (newest first, capped at 200), copy, delete one,
     clear all, text filter.
   - **About**: version, data folder, shortcuts cheat-sheet.
   Closing the window hides it to the tray. Keyboard-first: Ctrl+1..4 switch sections,
   Ctrl+F focuses history filter, all controls reachable by Tab with visible focus.
6. **Tray**: Open VoxFlow, Start/Stop dictation, Copy last transcription, Quit.
7. **First run**: if backend is Local and the selected model isn't downloaded, the settings
   window opens on Transcription so the user can download a model (default selection
   `base`).
8. **Single instance**: launching again focuses the existing settings window.

## Settings (settings.json, camelCase)

```
hotkey: string               "CommandOrControl+Shift+Space"
hotkeyMode: "hybrid" | "push_to_talk" | "toggle"
backend: "local" | "remote"
localModel: string            "base"
remote: { baseUrl: string, model: string }   API key lives in the keyring only
language: string              "auto" or ISO-639-1 code
inputDevice: string | null    null = system default
autoPaste: bool               true
restoreClipboard: bool        true
saveHistory: bool             true
theme: "system" | "dark" | "light"
```
Unknown/missing fields fall back to defaults (serde `default`); a corrupt file is renamed to
`settings.json.bak` and defaults are used. Writes are atomic (temp file + rename).

## IPC surface (src-tauri commands / events)

Commands: `get_settings`, `save_settings(settings)`, `set_api_key(key)`, `clear_api_key`,
`list_models` (catalog + downloaded flag + size), `download_model(name)`,
`cancel_download(name)`, `delete_model(name)`, `list_input_devices`, `test_remote`,
`get_history`, `delete_history_entry(id)`, `clear_history`, `copy_text(text)`,
`start_dictation`, `stop_dictation`, `cancel_dictation`, `get_status`, `open_data_dir`.
Events: `dictation://state` `{ state: "idle"|"recording"|"transcribing"|"done"|"error",
message? }`, `dictation://level` `{ level: 0..1 }` (~30 Hz while recording),
`models://progress` `{ name, downloaded, total }`, `models://done` `{ name, error? }`,
`history://changed`, `settings://changed` (no payload, after a successful save).

## Out of scope (v1)

LLM post-processing/formatting, custom vocabulary, streaming partial transcripts, macOS,
Wayland global hotkeys, auto-start at login, auto-update, code signing.

## Done means

- `cargo test -p voxflow-core` passes (settings defaults/round-trip/corrupt-file recovery,
  resampler, WAV encoding, model catalog/paths, remote request against a local mock HTTP
  server, history cap).
- `cargo check -p voxflow` (and ideally `cargo build`) passes on Linux using
  `scripts/linux-dev-env.sh`.
- `bun run build` (tsc + vite) passes; `bun test` passes for schema tests.
- README documents Windows prerequisites and `bun install && bun tauri dev` /
  `bun tauri build`. The Windows installer build itself can only be produced on Windows.

## IPC payload shapes (authoritative; Rust serde uses camelCase)

```
ModelInfo      { name: string, sizeMb: number, englishOnly: boolean, downloaded: boolean }
HistoryEntry   { id: string, text: string, createdAt: number /* unix ms */, backend: "local"|"remote", model: string, durationMs: number }
Status         { state: "idle"|"recording"|"transcribing"|"done"|"error", message?: string, lastError?: string, hasApiKey: boolean }
DictationState event payload = { state, message? }  (message: "Pasted" | "Copied" | error text)
DownloadProgress { name: string, downloaded: number, total: number }   bytes
DownloadDone     { name: string, error?: string }   error "cancelled" when cancelled
test_remote -> Ok(string) on success (e.g. "Connected"), Err(string) on failure
All command errors are returned as plain strings.
```
