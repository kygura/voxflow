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

## Tasks

| ID | Task | Model | Depends | Status |
|----|------|-------|---------|--------|
| T0 | Scaffold workspace | haiku | — | done |
| T1 | voxflow-core: settings, history, audio capture+resample, wav, models catalog+download, local whisper, remote client, output (clipboard/paste) + tests | opus | T0 | frontier |
| T2 | Frontend: design tokens, pill window, settings window (all sections), zod IPC layer, schema tests | sonnet | T0, DESIGN | frontier |
| T3 | src-tauri shell: state machine, hotkey (hybrid/PTT/toggle, Esc), tray, windows/pill positioning, commands/events, keyring, single-instance, first-run | opus | T1 | blocked |
| T4 | README + Windows prereqs | haiku | T3 | blocked |
| T5 | Verification gate: review-risk, review-reliability, checker, ponytail-review, design drift, build/test | mixed | T2,T3 | blocked |
