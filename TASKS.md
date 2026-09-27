# VoxFlow build map

**Destination:** Tauri v2 + React dictation app (hotkey → record → local whisper or OpenAI-compatible server → clipboard + auto-paste), Windows-first, verified per SPEC.md "Done means".

Tracker: local markdown (this file). Status: done / frontier / blocked.

## Decisions so far

- Research → docs/RESEARCH.md (tauri 2.12, global-shortcut 2.4, whisper-rs 0.16, cpal 0.18, keyring 4.x, reqwest rustls). Wayland: no global hotkeys, paste may fail → clipboard fallback.
- Linux verification without sudo: user-local sysroot (`scripts/bootstrap-sysroot.sh`, `scripts/linux-dev-env.sh`); whisper-rs + cpal build/run, webkit pkg-config probes OK.
- Workspace split: `core/` (voxflow-core, no Tauri, unit-tested) + `src-tauri/` (glue). Frontend at root (Tauri standard layout).
- Hotkey default `CommandOrControl+Shift+Space`, hybrid mode (hold ≥350ms = PTT, tap = hands-free). Modifier-only chords impossible with global-shortcut plugin.
- Design pass (Fable, run by planner instead of frontend-work human checkpoint because user asked for full autonomy) → DESIGN.md: graphite/amber identity, IBM Plex bundled, 360×104 pill window, sidebar settings.
- T0 scaffold (Haiku): workspace + dual Vite entries + tauri.conf windows; build + cargo check green.
- T1 core (Opus): settings/history atomic JSON, cpal recorder on own thread, linear resample, WAV, HF model catalog+download, whisper-rs LocalEngine (feature `local-whisper`), OpenAI-compatible client, arboard+enigo output. 20 tests.
- T2 frontend (Sonnet): tokens, sidebar settings (4 sections), pill with rolling waveform, zod IPC, browser mock for previews. Screenshot-checked vs DESIGN.
- T3 shell (Opus): single worker thread owns state machine (plugin handler only queues events; avoids global-shortcut lock deadlock), Esc registered only while active, keyring v1 feature, tray, first run opens ?section=transcription. `decide()` table test.
- T4 README (Haiku).
- T5 gate: review-risk (8), review-reliability (7), checker (5), ponytail (3), drift (5), standards/spec (3). Loop 1 fixed: key only over https/localhost, URL userinfo rejected, paste text sanitized, models pinned to HF commit + sha256, per-read timeout, text/image clipboard restore guarded, key masked before truncate, all sample formats, Esc+modifiers, refuse deleting active model, settings://changed, UI error handling, reduced motion, dead code. Loop 2: emoji icons → inline SVG. Deferred: dictation step() extraction for stale-generation tests, per-window capability manifest, golden JSON contract tests.

## Tasks

| ID | Task | Model | Depends | Status |
|----|------|-------|---------|--------|
| T0 | Scaffold workspace | haiku | — | done |
| T1 | voxflow-core: settings, history, audio capture+resample, wav, models catalog+download, local whisper, remote client, output (clipboard/paste) + tests | opus | T0 | done |
| T2 | Frontend: design tokens, pill window, settings window (all sections), zod IPC layer, schema tests | sonnet | T0, DESIGN | done |
| T3 | src-tauri shell: state machine, hotkey (hybrid/PTT/toggle, Esc), tray, windows/pill positioning, commands/events, keyring, single-instance, first-run | opus | T1 | done |
| T4 | README + Windows prereqs | haiku | T3 | done |
| T5 | Verification gate: review-risk, review-reliability, checker, ponytail-review, design drift, build/test | mixed | T2,T3 | done |
