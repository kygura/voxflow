# Recording Ergonomics Research

Survey of concrete recording-interaction patterns in dictation apps, for VoxFlow (Tauri, Windows-primary desktop app). Focus: hotkey mechanics, idle/active UI states, text delivery, cancel/undo, and error handling — things an implementer can copy.

## 1. Per-product feature notes

### Wispr Flow

- **Hotkey modes**: hold-to-talk (press, speak, release) and hands-free (double-tap within ~0.5s to toggle on, speak freely, stop by pressing again or clicking the stop icon). A third rapid tap (or a second hands-free press within the 0.5s window) **cancels** instead of pasting. Default: `Fn` (Mac) / `Ctrl+Win` (Windows) for push-to-talk; `Fn+Space` / `Ctrl+Win+Space` for hands-free. [Use Flow hands-free](https://docs.wisprflow.ai/articles/6391241694-use-flow-hands-free), [Keyboard shortcuts](https://docs.wisprflow.ai/articles/2612050838-supported-unsupported-keyboard-hotkey-shortcuts)
- **Hands-free lock**: a second press inside the double-tap window locks the session open (Mac/Windows/Android only); a later press stops it. [Use Flow hands-free](https://docs.wisprflow.ai/articles/6391241694-use-flow-hands-free)
- **Auto-stop safety net**: warns at 19 min, force-stops at 20 min of continuous recording. [Use Flow hands-free](https://docs.wisprflow.ai/articles/6391241694-use-flow-hands-free)
- **Flow Bar states**: idle = 38×10px black sliver; hover = 64×22px peek showing dim resting dots; recording = grows to 84×30px with a light sweep across the dots. Stays always-on-top; can be dragged/docked to another screen edge; a "Show Flow Bar at all times" toggle and a "Hide for 1 hour" snooze control visibility. [Move and dock the Flow Bar](https://docs.wisprflow.ai/articles/1790396454-move-and-dock-the-flow-bar-on-desktop), [Troubleshooting the Flow Bar](https://docs.wisprflow.ai/articles/5002934560-why-is-the-wispr-bar-is-not-appearing-or-disappearing)
- **Text delivery**: transcript is typed/pasted at the cursor in the active app once recording stops (hands-free) or on release (push-to-talk); a wand icon appears on hover over selected text for one-off "Transforms." [Move and dock the Flow Bar](https://docs.wisprflow.ai/articles/1790396454-move-and-dock-the-flow-bar-on-desktop)
- **Cancel**: `Esc` or click the X in the bar, discards the in-progress recording. [Use Flow hands-free](https://docs.wisprflow.ai/articles/6391241694-use-flow-hands-free)
- **Paste/copy last**: dedicated global hotkeys re-emit the previous transcript — `Cmd+Ctrl+V` / `Shift+Alt+Z` (paste last), `Cmd+Ctrl+C` / `Shift+Alt+X` (copy last) — independent of the app that currently has focus. [Keyboard shortcuts](https://docs.wisprflow.ai/articles/2612050838-supported-unsupported-keyboard-hotkey-shortcuts)
- **Command Mode**: separate hold-to-talk hotkey (`Fn+Ctrl` / `Ctrl+Win+Alt`) for spoken editing/automation commands instead of dictating prose; requires existing/selected text for edit commands; paid-plan and English-only. [How to use Command Mode](https://docs.wisprflow.ai/articles/4816967992-how-to-use-command-mode)
- **Personal dictionary**: user-added words/corrections (60-char cap), matched whole-word case-insensitively, applied globally across all dictation (not per-app); syncs across devices. [Teach Flow your words](https://docs.wisprflow.ai/articles/4052411709-teach-flow-your-words-with-the-dictionary)
- **Snippets**: spoken trigger phrase (≤60 chars) expands to saved text (≤4000 chars) inline during dictation; trigger matched standalone or mid-sentence, longest match wins. [Create and use snippets](https://docs.wisprflow.ai/articles/5784437944-create-and-use-snippets)
- **Per-app context/tone**: active app is bucketed into Email / Work messaging / Personal messaging / Other and formatting/register adapts (formal in Gmail, casual in Slack, code-aware in editors); a 2026 "Personalized Style" setting lets users pick a tone (Very Casual→Formal) per app category. [Context Awareness](https://docs.wisprflow.ai/articles/4678293671-feature-context-awareness), [Personalized style](https://wisprflow.ai/post/personalized-style)
- **Mute-media-while-dictating** (macOS): when enabled, Flow mutes the system's default output device the instant it detects other audio playing, and restores the previous volume/mute state when dictation ends; works at the OS-output level, not per-app. [Auto-mute music while dictating](https://docs.wisprflow.ai/articles/7231650589-auto-mute-music-while-dictating-on-macos-how-audio-detection-works)
- **Sound cues**: a ping plays when a recording starts; interaction sounds toggle in Settings → System → Sound (desktop) / Settings → Audio (iOS). [Use Flow hands-free](https://docs.wisprflow.ai/articles/6391241694-use-flow-hands-free), [Sound effects](https://docs.wisprflow.ai/articles/3941699399-keyboard-and-screen-reader-accessibility-in-wispr-flow)
- **Error handling**: offline before starting → bar/bubble grays out and blocks dictation with a "No internet. Try again later." message; connection lost mid-recording → audio is buffered locally and transcribed automatically once reconnected (no data loss). [Fix "No Internet Connection" issues](https://docs.wisprflow.ai/articles/5094956927-fix-no-internet-connection-issues)

### Aqua Voice

- **Hotkey flow**: press hotkey → speak → live-updating transcript appears in a floating window → second keypress commits/pastes into the focused app. Reported cold-start <50ms, paste latency ~450ms–1s. [Aqua Voice + Hotkeys](https://paulkarayan.com/blog/aqua-hotkeys-and-loom/), [Aqua Voice site](https://aquavoice.com/)
- **Natural-language formatting**: no memorized command syntax — user says "put that into bullet points" etc. and the model applies it. [Aqua Voice review](https://www.softorbits.net/how-to/aqua-voice-review.html)
- **Screen/app context awareness**: reads on-screen context to bias formatting/vocabulary toward the active app. [Aqua Voice review](https://www.softorbits.net/how-to/aqua-voice-review.html)
- **Custom dictionary**: user-added niche vocabulary/names for accuracy. [Aqua Voice review](https://www.softorbits.net/how-to/aqua-voice-review.html)
- **Limitation**: cloud-only, no offline mode. [Aqua Voice review](https://www.softorbits.net/how-to/aqua-voice-review.html)

### Superwhisper

- **Recording modes**: Toggle (press to start/stop) and Push-to-Talk (hold to record, release to stop; a quick tap on the PTT key acts as a toggle instead). A separate "Change Mode" hold opens a mode switcher (tap the key or use arrows to cycle profiles) usable before or during a recording. [Essential Settings](https://superwhisper.com/docs/get-started/settings-shortcuts)
- **Per-mode shortcuts**: each configured "mode" (profile) can have its own dedicated hotkey that starts recording directly in that mode. [Essential Settings](https://superwhisper.com/docs/get-started/settings-shortcuts)
- **Silence removal**: on by default; strips silence from the input to reduce hallucinated text; toggle in Sound settings — not an auto-stop, a pre-processing filter. [Changelog](https://superwhisper.com/changelog)
- **Mini recording window**: small floating window, right-click for quick settings; shows active mode name (click to switch, or hold `Option+Shift+K`). [Recording Window](https://superwhisper.com/docs/get-started/interface-rec-window)
- **Cancel**: dedicated "Cancel Recording" action discards without transcribing; confirms before discarding long recordings.

### MacWhisper (Global dictation feature)

- **Hotkey**: user-set global shortcut; supports both push-to-talk (release to transcribe) and toggle mode, switchable in settings. Default gesture example: double-tap `Option`. [Dictation feature](https://docs.macwhisper.com/article/14-how-to-use-the-dictation-feature)
- **Text delivery**: transcript goes to the system clipboard (optional "Auto copy"); user pastes manually, or MacWhisper types it inline depending on mode. [Global feature](https://docs.macwhisper.com/article/16-global)
- **Overlay**: "Global overlay" appears while active; "Always on Top" toggle controls whether it stays visible across app switches; "Auto Start" begins recording the instant the overlay opens. [Global feature](https://docs.macwhisper.com/article/16-global)
- **Per-app AI prompts**: optional AI cleanup/rephrase prompt can be configured differently per active application. [MacWhisper alternative guide](https://www.fluidvox.com/macwhisper-alternative)

### Windows-native Voice Typing (Win+H)

- **Trigger**: `Win+H` in any focused text field opens a small floating dictation toolbar; on touch devices, the mic button on the on-screen keyboard. [Use voice typing](https://support.microsoft.com/en-us/accessibility/windows/use-voice-typing-to-talk-instead-of-type-on-your-pc)
- **"Listening…" state**: toolbar shows a "Listening…" indicator before it starts reliably capturing speech — the UI explicitly tells the user when it's actually hot. [Use voice typing](https://support.microsoft.com/en-us/accessibility/windows/use-voice-typing-to-talk-instead-of-type-on-your-pc)
- **Auto-punctuation**: off by default; toggled from a gear icon on the toolbar; when on, sentence-final pauses insert periods/commas/question marks automatically. [Use voice typing](https://support.microsoft.com/en-us/accessibility/windows/use-voice-typing-to-talk-instead-of-type-on-your-pc)
- **Voice commands**: "delete that," "select that," "stop listening" — spoken commands mixed into normal dictation for light editing, no separate mode switch needed. [Use voice typing](https://support.microsoft.com/en-us/accessibility/windows/use-voice-typing-to-talk-instead-of-type-on-your-pc)
- **Secure-field guard**: auto-disables over password/PIN fields. [Use voice typing](https://support.microsoft.com/en-us/accessibility/windows/use-voice-typing-to-talk-instead-of-type-on-your-pc)
- **Requires internet** (Azure Speech backend), no offline mode. [Use voice typing](https://support.microsoft.com/en-us/accessibility/windows/use-voice-typing-to-talk-instead-of-type-on-your-pc)

## 2. Ranked table of ergonomic features

| Feature | Who does it | User value | Effort for us | Fit |
|---|---|---|---|---|
| Paste-last / copy-last hotkeys | Wispr Flow | Recover a transcript after accidental focus loss/paste failure without re-dictating | S | High — we already have history + tray "copy last"; add global hotkeys |
| "Listening…" / warm-up state before hot | Windows Voice Typing | User doesn't talk over a mic that isn't capturing yet | S | High — cheap pill-state addition, fixes a real race with our current instant-show |
| Cancel via Esc with clear no-op guarantee | Wispr Flow, Superwhisper | Confidence to abort without leaving stray text/clipboard changes | S | High — we have Esc already; just needs explicit state/visual confirmation |
| Auto-stop safety net (warn then force-stop) | Wispr Flow | Prevents runaway recordings from long silence/left-open hotkey | S | High — simple timer, avoids surprise huge transcripts |
| Triple-tap / extra-press = cancel (not toggle) | Wispr Flow | Escape hatch when hotkey is fumbled, without a separate key | S | Medium — nice but adds a timing-sensitive edge case to our hybrid hotkey |
| Auto-mute other audio while dictating | Wispr Flow | Cleaner mic input, no music bleeding into transcript | M | High — Windows has per-session volume control APIs; clear differentiator |
| Sound cue on start/stop (toggleable) | Wispr Flow, Windows Voice Typing | Non-visual confirmation state changed, useful when pill is glanced past | S | High — one sound asset + a settings toggle |
| Personal dictionary (manual add + corrections) | Wispr Flow, Aqua Voice | Fixes recurring mis-transcriptions of names/jargon | M | High — fits our existing cleanup step, storable in same JSON/SQLite as history |
| Snippets (spoken trigger → expansion) | Wispr Flow | Fast boilerplate insertion by voice | M | Medium — useful but scope creep beyond core dictation loop |
| Per-app tone/formatting buckets | Wispr Flow | Output register matches Slack vs. email vs. code without manual toggling | M/L | Medium — valuable, but needs an app-context detector we don't have yet |
| Command Mode (separate hotkey, spoken edits) | Wispr Flow | Voice-only text editing/automation | L | Low — big scope, own hotkey, own NLU; not core to "dictate → paste" |
| Hands-free lock (double-press to lock open) | Wispr Flow | Long-form dictation without holding a key | S | Already covered — our tap = hands-free is equivalent, no separate lock needed |
| Live/streaming partial transcript in UI | Aqua Voice, Superwhisper | Visual feedback that speech is being captured while still talking | L | Deferred — explicitly out of scope (no streaming partials) |
| Voice-spoken light-edit commands ("delete that") | Windows Voice Typing | Micro-corrections without touching keyboard | M | Low — needs command grammar + selection tracking, real scope increase |
| Flow Bar precise pixel-state choreography (sliver→hover→active) | Wispr Flow | Polished, unobtrusive idle presence | M | Medium — good visual language reference, but our "hidden when idle" is already a stronger version |
| Mode-switcher while recording (cycle profiles) | Superwhisper | Swap prompt/model mid-flow | M | Low — we have one active backend at a time, not multi-profile yet |
| Auto-disable over secure/password fields | Windows Voice Typing | Prevents dictating into sensitive fields | M | Deferred — needs OS-level field-type detection, high effort for edge case |

## 3. Adopt now (4-6 items, precise behavior spec)

### 3.1 Warm-up "Listening…" sub-state on the pill

- On hotkey press (both PTT-hold and tap-to-start), pill appears immediately in its current "recording" visual, but the waveform area shows a static three-dot pulse (not live waveform) labeled implicitly by animation only — no text label, keep it iconographic to match existing minimal pill.
- Switch from pulse to live waveform the moment the first audio frame/chunk from the mic stream arrives (i.e., when the capture backend confirms it's receiving samples), not on hotkey press.
- Timeout: if no audio frame arrives within 1500ms of hotkey press, show a small inline error glyph (mic-muted icon) in the pill and auto-cancel the session after 3000ms total with no frames — do not silently hang.
- Rationale: avoids the user talking into a mic that Windows hasn't actually opened yet (a real race on cold hotkey press), and matches Windows Voice Typing's explicit "Listening…" cue without adding new copy/localization.

### 3.2 Recording auto-stop safety net

- Hard cap: force-stop and transcribe-what-you-have at 5 minutes of continuous recording (shorter than Wispr's 20 min — VoxFlow's use case is short dictations, not meeting transcription; keep it conservative to avoid huge accidental captures from a stuck hotkey).
- Warning cue at 4:30 (30s before cutoff): pill briefly flashes/pulses its border color once (reuse existing "error" accent color at 60% opacity, 300ms fade in/out) — no sound, no text.
- At 5:00: stop capture exactly as if the user pressed stop, run normal transcribe→cleanup→paste pipeline on whatever was captured.
- Silence-only guard: if the capture backend reports RMS below a fixed floor (silence) for 20 consecutive seconds during hands-free mode, auto-stop and transcribe (protects against hands-free left on with no one talking); push-to-talk mode is exempt since the user is physically holding the key.

### 3.3 Cancel confirmation + guaranteed no-op

- On `Esc`: stop capture immediately, discard the audio buffer, skip transcribe/cleanup/paste entirely, restore clipboard to pre-session state if anything was already speculatively written (should be a no-op today since we paste only after transcription, but assert this invariant explicitly in code/tests).
- Pill plays a brief "cancel" visual (fade out over 150ms, no waveform freeze-frame) then hides — distinct from the "success" hide (which can show a 400ms checkmark/flash first per existing behavior if any).
- Do not write anything to history or "copy last" tray item on cancel — cancelled sessions must not appear in history at all.

### 3.4 Paste-last / copy-last global hotkeys

- Add two new global hotkeys (user-configurable, defaulting to unbound to avoid clashing with existing Ctrl+Shift+Space): e.g. `Ctrl+Shift+V` = paste last transcript at cursor, `Ctrl+Shift+C` = copy last transcript to clipboard only (no paste).
- Both act on the most recent successful (non-cancelled) transcription in history, regardless of which app currently has focus — same target-injection path already used for auto-paste.
- If history is empty, hotkey is a no-op (optionally a single short error sound if sounds are enabled — see 3.5).
- Tray menu's existing "copy last" item stays as-is; these hotkeys are the keyboard-reachable equivalent, not a replacement.

### 3.5 Toggleable start/stop sound cues

- Two short sounds (existing asset pipeline or two new small .wav/.ogg, <200ms each): one on capture start (after the warm-up gate in 3.1 passes, i.e., when waveform goes live), one on successful stop+paste.
- Settings toggle: single boolean "Play sound on start/stop" (default off, since VoxFlow's pill already gives strong visual feedback and many users dictate in shared spaces — Wispr defaults this on, but we should default conservatively given Windows-desktop office-use context).
- No sound on cancel (silence is the cancel cue — pairs with 3.3's fade-out) and no sound on the 4:30 warning (visual-only, per 3.2).
- Use OS default output device at system volume; do not implement the auto-mute-other-audio feature as part of this — that's the deferred item below, sound cues are independent and much cheaper.

### 3.6 Personal dictionary (manual entries, applied at cleanup step)

- New settings page: simple list UI, add/edit/delete entries, each entry = `{ wrong: string, correct: string }` or a "known term" bare-word entry (up to 100 chars, generous vs. Wispr's 60 since we're not also syncing to mobile).
- Storage: plain JSON file alongside existing history storage (no new DB) — ponytail: flat list is fine at expected scale (tens to low hundreds of entries), move to SQLite only if it's already needed for history at that point.
- Apply as a post-transcription, pre-paste text-replacement pass: case-insensitive whole-word match against `wrong`/bare terms, replace with saved `correct` casing — run this in the existing cleanup step (basic or AI), before the AI cleanup call if AI cleanup is enabled, so the corrected terms are available as context for the AI pass too.
- No auto-learning from user edits in this iteration (Wispr's auto-learn needs an edit-tracking hook we don't have) — pure manual list, add when there's a request for it.

## 4. Deferred

- **Live/streaming partial transcripts** — explicitly out of scope per current architecture (no streaming partials); revisit only if a streaming-capable local/API backend becomes the default.
- **Snippets (voice-triggered text expansion)** — real value but separate feature surface (its own trigger-matching engine, storage, and UI) rather than a "recording ergonomics" fix; treat as its own future proposal.
- **Per-app tone/formatting buckets** — needs an active-window/app-context detector VoxFlow doesn't have; worth doing once cleanup profiles exist, not before.
- **Command Mode (spoken text editing)** — large scope (own hotkey, own NLU/grammar, selection tracking); not needed for the core dictate→paste loop.
- **Auto-mute other system audio while dictating** — genuinely valuable but a distinct OS-integration project (per-session volume control via Windows Core Audio APIs); worth a dedicated follow-up, not bundled into this ergonomics pass.
- **Hands-free lock as a separate gesture** — our existing tap-to-start/tap-to-stop hybrid already covers "hands-free until stopped"; a third gesture would add complexity without adding capability.
- **Mode-switcher mid-recording (Superwhisper-style profiles)** — we have one active transcription backend/cleanup mode at a time by design; multi-profile switching is a bigger feature, not an ergonomics tweak.
- **Voice-spoken light-edit commands ("delete that")** — needs a command grammar and text-selection tracking; real scope increase, not a small ergonomics add.
- **Secure-field auto-disable** — needs OS-level focused-control-type detection; low payoff for the engineering cost at this stage.
