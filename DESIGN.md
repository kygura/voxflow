# VoxFlow — Design Brief (v2)

Audience: the implementer. Plain CSS + custom properties, no Tailwind, no UI kit, icons are
inline SVG. Everything here is a decision. If something is missing, pick the option with fewer
pixels, fewer colors and straighter edges.

Identity in one line: **a black instrument, one signal color.** Near-black surfaces, near-white
type, one acid-lime signal, hard 1px lines, square corners, a grotesk for words and a mono for
anything the machine says (timers, keys, states, models, paths). Nothing glows, nothing is soft,
nothing is a gradient. Wispr Flow / Aqua Voice pill energy: a small dark slab that appears,
breathes with your voice, and leaves.

What v2 replaces: the v1 "studio hardware" graphite/amber look (warm neutrals, 8–12px radii,
blurred shadows, pulsing halos, shimmer text, green success color). None of that survives.

---

## 1. Tokens

### 1.1 Typography (bundled offline via fontsource)

| Role | Family | Weights | Package (exact) |
| --- | --- | --- | --- |
| UI text, section titles, snippets | **Archivo** | 400, 500, 700 | `@fontsource/archivo` — import `400.css`, `500.css`, `700.css` |
| Timer, key caps, state labels, model names, URLs, paths, timestamps, raw text | **JetBrains Mono** | 400, 500 | `@fontsource/jetbrains-mono` — import `400.css`, `500.css` |

Remove `@fontsource/ibm-plex-sans` and `@fontsource/ibm-plex-mono` from `package.json`.
Import the CSS files in both entries (`src/main.tsx` and `src/pill.tsx`); the pill only needs
Archivo 500 and JetBrains Mono 400/500.

```
--font-sans: "Archivo", "Segoe UI Variable", "Segoe UI", system-ui, sans-serif;
--font-mono: "JetBrains Mono", Consolas, "DejaVu Sans Mono", monospace;
```

Mono text always sets `font-variant-numeric: tabular-nums`. State labels and eyebrow labels are
mono, uppercase, `letter-spacing: 0.08em`. Sans text never uses letter-spacing.

Type scale (px / line-height / weight). Font sizes are written in px in tokens but applied via
`rem` (root 16px) so OS font scaling works: `--fs-md: 0.8125rem` etc. The px values below are
the intent.

| Token | Size | LH | Weight | Family | Use |
| --- | --- | --- | --- | --- | --- |
| `--fs-2xs` | 10 | 12 | 500 | mono | key caps, `ESC`, pill counters |
| `--fs-xs` | 11 | 16 | 500 | mono | state labels (uppercase), eyebrow labels, badges, timestamps |
| `--fs-sm` | 12 | 16 | 400 | sans or mono | helper copy, meta, raw-text peek (mono) |
| `--fs-md` | 13 | 18 | 400 | sans | body, inputs, buttons, nav, pill snippet |
| `--fs-lg` | 15 | 20 | 500 | sans | card titles |
| `--fs-xl` | 22 | 26 | 700 | sans | section title |
| `--fs-timer` | 12 | 16 | 500 | mono | pill timer `00:04` |

### 1.2 Color

`data-theme` on `<html>`: `dark` | `light` (`system` resolves in JS, both windows, existing
`applyTheme`). Dark is the identity; light is a real inversion, not a tint.

| Token | Dark | Light | Role |
| --- | --- | --- | --- |
| `--bg-0` | `#0A0A0A` | `#FFFFFF` | window / pill background |
| `--bg-1` | `#111111` | `#F5F5F5` | sidebar, boxes, textarea, raw-peek block |
| `--bg-2` | `#1A1A1A` | `#EBEBEB` | hover row, segmented track, key caps |
| `--bg-3` | `#262626` | `#DEDEDE` | pressed, disabled fill |
| `--text-0` | `#F5F5F5` | `#0A0A0A` | primary text, waveform bars, inverted fills |
| `--text-1` | `#A3A3A3` | `#525252` | secondary / helper |
| `--text-2` | `#7A7A7A` | `#6F6F6F` | meta, placeholder (still AA) |
| `--line` | `#2E2E2E` | `#D4D4D4` | hairlines, dividers, input borders at rest |
| `--line-strong` | `#666666` | `#8A8A8A` | control borders (buttons, inputs hover), pill edge in light |
| `--accent` | `#C8F542` | `#3E6B00` | the one signal: active nav bar, REC square, `PASTED`, links, focus ring, progress |
| `--accent-fill` | `#C8F542` | `#C8F542` | filled blocks: primary button, toggle-on track, done square |
| `--accent-text` | `#0A0A0A` | `#0A0A0A` | text on `--accent-fill` |
| `--accent-soft` | `rgba(200,245,66,.12)` | `rgba(62,107,0,.10)` | filter-match highlight only |
| `--err` | `#FF5C5C` | `#C4171C` | errors, danger, ERROR square |
| `--err-soft` | `rgba(255,92,92,.10)` | `rgba(196,23,28,.08)` | error banner bg |
| `--pill-bg` | `#0A0A0A` | `#FFFFFF` | pill surface, opaque (no blur, no alpha) |
| `--pill-line` | `rgba(255,255,255,.22)` | `#0A0A0A` | pill 1px edge |
| `--focus` | `var(--accent)` | `var(--accent)` | focus ring |

There is no green, no amber, no coral. Success uses `--accent`. Recording uses `--accent`.
Waveform bars are `--text-0`. The only other hue is `--err`.

Contrast (WCAG, computed on the values above):

| Pair | Dark | Light | Requirement |
| --- | --- | --- | --- |
| `--text-0` on `--bg-0` | 19.4:1 | 19.4:1 | ≥ 7 |
| `--text-1` on `--bg-0` | 8.0:1 | 7.9:1 | ≥ 4.5 |
| `--text-1` on `--bg-1` | 7.4:1 | 7.3:1 | ≥ 4.5 |
| `--text-2` on `--bg-0` | 4.7:1 | 5.0:1 | ≥ 4.5 |
| `--accent` on `--bg-0` | 15.7:1 | 6.4:1 | ≥ 4.5 |
| `--accent-text` on `--accent-fill` | 15.7:1 | 15.7:1 | ≥ 4.5 |
| `--err` on `--bg-0` | 6.5:1 | 6.0:1 | ≥ 4.5 |
| `--line-strong` on `--bg-0` | 3.5:1 | 3.4:1 | ≥ 3 (non-text) |
| `--bg-0` text on `--text-0` fill (inverted selected) | 19.4:1 | 19.4:1 | ≥ 7 |

`--text-2` is AA at 13px+ in both themes; still never the sole carrier of information.

### 1.3 Spacing, lines, radii

- Spacing (`--sp-1..8`): 2, 4, 8, 12, 16, 24, 32, 48. Grid is 8; inline gaps 4/8/12.
- Border widths: `--bw: 1px` (everything), `--bw-bar: 2px` (active-nav bar, banner edge,
  progress track), `--bw-focus: 2px`.
- Radii: **0** everywhere in the settings window (`--r-0: 0`). The pill body uses `--r-pill: 4px`.
  Nothing else is rounded: not toggles, not key caps, not badges, not inputs, not the REC square.
- Shadows: none. No `box-shadow` anywhere except the focus ring implementation if `outline`
  cannot follow a shape. Depth is expressed with 1px lines and inverted fills.

### 1.4 Motion

| Token | Value | Use |
| --- | --- | --- |
| `--dur-1` | 80ms | hover/press color, toggle knob |
| `--dur-2` | 160ms | pill show, pill height change, content swap, section switch |
| `--dur-3` | 240ms | banner enter, row delete collapse |
| `--ease-out` | `cubic-bezier(.2,.8,.2,1)` | entrances, growth |
| `--ease-in` | `cubic-bezier(.4,0,1,1)` | exits |
| `--ease-lin` | `linear` | sweeps, timers, waveform |

`prefers-reduced-motion: reduce`: `--dur-1/2/3` become 1ms; every `translate` is removed
(opacity only); the transcribing/cleaning sweep becomes a static 3-block stepper that changes
every 500ms with no tween; the REC square does not blink; the waveform still updates (it is
information) but without the sub-pixel slide (§2.5). The existing `useReducedMotion` hook in
`pill.tsx` stays and is passed down.

---

## 2. The pill (`pill.html`, `src/pill.tsx`, `src/styles/pill.css`)

### 2.1 Window

- Logical size **400 × 112** (was 360 × 104). Update `tauri.conf.json` and the
  `(360.0 * s, 104.0 * s)` in `src-tauri/src/dictation.rs`.
- Pill body: width **380**, height **64** (recording, transcribing, cleaning, error) or **92**
  (done with snippet). Body is horizontally centered and **anchored to the window bottom** with a
  10px bottom margin, so growth goes upward. Side margins 10px, top margin 10px at 92px height.
- Position: body bottom edge 24px above the monitor work area → window bottom = work area
  bottom − 14px. Fallback without work area: window bottom = monitor bottom − 62px. Recompute on
  every show.
- Window flags unchanged: transparent, undecorated, always-on-top, skip-taskbar, non-focusable,
  not click-through.
- `html, body { background: transparent; margin: 0; overflow: hidden; user-select: none; }`.

### 2.2 Anatomy (380 wide, 64 tall)

```
 ┌──────────────────────────────────────────────────────────────────────┐ 1px --pill-line, r=4
 │ ■  00:04   ▁▂▃▅▇▆▃▂▁▂▃▅▆▇▅▃▂▁▂▃▄▃▂▁▂▃▅▆▅▃▂▁▂▃▄▃▂▁▂▃         [ESC]   │
 └──────────────────────────────────────────────────────────────────────┘
  16  8   12          waveform 188 × 32 (flex 1)              12  cap  16
```

Left to right, vertically centered, horizontal padding 16px:

1. **Mark**: 8×8 square, no radius. Color per state.
2. **Label slot** (fixed 44px wide, mono): the timer while recording; the state word otherwise.
3. **Content slot** (flex 1, min-width 0, height 32): waveform canvas / sweep bar / text.
4. **Right slot**: the `ESC` key cap (a `<button>`, 22px tall, 32px hit area via padding), or a
   mono note in done/error.

Colors: body `--pill-bg`, edge `1px solid --pill-line`, text `--text-0`. Cursor `default` on
body, `pointer` on the cap and (while recording) on the body.

### 2.3 States

| State | Mark | Label slot (mono xs uppercase unless noted) | Content slot | Right slot | Shown for |
| --- | --- | --- | --- | --- | --- |
| idle | — | — | — | — | hidden |
| recording, hands-free (toggle / hybrid tapped) | `--accent` filled, steady | timer `00:04` (`--fs-timer`, `--text-1`, tabular) | Waveform (§2.5) | `ESC` cap | until stop |
| recording, push-to-talk (key held) | `--accent` filled, blinking: opacity 1 ↔ 0.35, `steps(1)`, 1.0s period (500ms each) | timer | Waveform | `ESC` cap | until release |
| transcribing | `--accent` 1px outlined square (hollow) | `TRANSCRIBING` in `--text-1` | Sweep (§2.6) | `ESC` cap | until backend |
| cleaning | same hollow square | `CLEANING` in `--text-1` | Sweep | `ESC` cap | until backend |
| done: Pasted | `--accent-fill` filled | `PASTED` in `--accent` | row 2: snippet (§2.7) | `−4 FILLERS` / `EDITED` / `RAW` counter (§2.7) | 1600ms |
| done: Copied | `--accent-fill` filled | `COPIED` in `--accent` | row 2: snippet | same counter | 2000ms |
| done with AI fallback note | same | same | row 2: snippet | `AI FAILED · BASIC` in `--err` (replaces counter) | 2400ms |
| error | `--err` filled | `ERROR` in `--err` | message, sans `--fs-md` `--text-0`, one line, ellipsis, max 48 chars | `SEE VOXFLOW` mono xs `--text-2` | 3000ms |

Label slot width is fixed at 44px for the timer; state words are wider, so the label slot is
`min-width: 44px; width: auto` and the content slot takes what is left.

Recording mode (`mode` on `dictation://state`): `push_to_talk` → blinking mark; `toggle` or
absent → steady. Hybrid: opens blinking, and when the backend reports the tap it re-sends the
state with `mode: "toggle"` and the blink stops. Nothing else changes between modes; there is no
"release to stop" text (the timer and the blink are the affordance).

Timer: starts at the first `recording` event, `mm:ss`, updates every 1000ms via `setInterval`
aligned to the start timestamp (no drift), stops at the first non-recording state. Never shown
outside recording.

Screen reader text (`role="status" aria-live="polite"`, visually hidden span inside the content
slot): `Recording`, `Transcribing`, `Cleaning up`, `Pasted`, `Copied to clipboard`,
`Error: <message>`.

### 2.4 Copy (exact)

| Where | Copy |
| --- | --- |
| Transcribing label | `TRANSCRIBING` |
| Cleaning label | `CLEANING` |
| Done labels | `PASTED` / `COPIED` |
| Removed-count note | `−N FILLERS` (N ≥ 1, U+2212 minus), or `EDITED` when raw differs but N ≤ 0, nothing when raw is absent |
| AI fallback note | `AI FAILED · BASIC` (shown when `message` contains "AI cleanup failed") |
| Error label | `ERROR` |
| Error right note | `SEE VOXFLOW` |
| Cancel cap | `ESC` |

Everything in the label and right slots is uppercase mono with `letter-spacing: .08em`. The
snippet and the error message are sentence-case sans, as delivered.

### 2.5 Waveform (recording)

**Rendering: one `<canvas>`**, 188 × 32 CSS px (the content slot width; the canvas reads its
`clientWidth` on mount and on resize), backing store scaled by `devicePixelRatio`, redrawn every
`requestAnimationFrame` while recording. No DOM bars, no CSS transitions. It replaces
`src/components/Waveform.tsx` entirely (same file name, new implementation).

Geometry:

- Bar width **2px**, gap **2px**, pitch 4px → `N = floor((W + 2) / 4)` bars = **47** at 188px.
- Bar height range **2px (floor) to 32px (full)**, vertically centered. Ends are square.
- Color `--text-0` (read from `getComputedStyle` once per theme change), full opacity, uniform.
  No left-to-right fade, no gradients, no glow.

Signal:

- Input: `dictation://level` `{ level }` at ~30 Hz, stored in `levelRef` (already exists).
- Gain: `v = clamp(level * GAIN, 0, 1)` with `GAIN = 1.4`
  (`// ponytail: tune GAIN against real mic RMS; 1.4 assumed peak speech ≈ 0.7`).
- Envelope, updated every rAF (not per event) so it stays smooth between 30 Hz samples:
  `env += (v - env) * (v > env ? 0.55 : 0.12)`. Attack ≈ 2 frames, release ≈ 8 frames at 60 Hz.
  Under reduced motion use the same envelope (it is a filter, not an animation).
- Sample ring: every **33.3ms** of elapsed time (`accumulator` on `performance.now()`), push
  `env` into a ring buffer of `N` values. Newest is at the **right**; the buffer starts filled
  with 0 so the pill opens with a flat dotted baseline.

Draw (per rAF):

- Height `h = 2 + 30 * sqrt(sample)`; `y = (32 - h) / 2`.
- **Tape slide**: the whole row is offset by `-(elapsedSinceLastPush / 33.3) * 4` px so bars
  travel continuously left at 4px per 33.3ms instead of jumping once per sample. Clip to the
  canvas (bars leaving on the left are cut, a partial bar enters from the right). Under
  reduced motion the offset is 0 (bars jump per sample).
- The rightmost (newest) bar is drawn with the **live `env`** rather than the last pushed sample,
  so the front of the tape tracks the voice at display rate.
- Silence: all bars at 2px → a dotted 2×2 rule across the slot. That is the "listening" look;
  do not add a placeholder.
- Peaks: `sqrt` mapping already lifts quiet speech; values ≥ 1 clamp to 32px. No peak-hold, no
  clipping color.

Bookkeeping: cancel the rAF on unmount and when `state` leaves recording; reset `env`, the
ring and the accumulator on every entry to recording. Theme color is re-read when
`data-theme` changes (a `MutationObserver` on `<html>` attributes, or re-read on each rAF —
either is acceptable; the latter is simpler and cheap).

### 2.6 Sweep (transcribing, cleaning)

Content slot shows a 188 × 2 track in `--line` with a **40px `--accent` segment** moving
left→right over **1100ms linear, infinite** (`transform: translateX(0 → 148px)`), restarting
hard (no yoyo). Vertically centered in the 32px slot. Reduced motion: replace with three 8×2
blocks (gap 4) at the left of the track; blocks fill in sequence (1, 2, 3, none, 1 …) every
500ms via `steps(1)`.

### 2.7 Done row 2 (snippet + counter)

When `state === "done"` and `text` is non-empty the body grows to 92px (`height` transition
`--dur-2 --ease-out`). Row 1 is the 64px anatomy above (mark, label, empty content, right
note). Row 2 sits in the top 28px that appeared: padding `0 16px 8px 40px` (left-aligned with
the label slot), the snippet in sans `--fs-md` `--text-0`, single line, `text-overflow: ellipsis`.

Counter (computed in the pill from the payload, frontend only):

```
words = (s) => s.trim().split(/\s+/).filter(Boolean).length
if (!raw || raw === text)         -> no note
n = words(raw) - words(text)
n >= 1                            -> `−${n} FILLERS`   (mono xs, --text-1)
otherwise                         -> `EDITED`         (mono xs, --text-1)
message includes "AI cleanup failed" -> `AI FAILED · BASIC` (mono xs, --err) instead
```

When `text` is empty (should not happen, but defensive) the body stays 64px and the content
slot shows nothing.

### 2.8 Transitions

- hidden → visible: window shown at final position; body `opacity 0→1`, `translateY(6px→0)`,
  `--dur-2 --ease-out`.
- visible → hidden: `opacity 1→0`, `translateY(0→4px)`, `--dur-2 --ease-in`, then hide the
  window (existing `visible` state pattern in `pill.tsx`; keep `AUTO_HIDE_MS` but with the
  durations from §2.3 and a `done:ai-fallback` key).
- Between visible states: mark, label and right slot swap instantly (they are text); the
  content slot crossfades `--dur-2` (old opacity 1→0 over the first 80ms, new 0→1 over the
  last 80ms, absolute-stacked). Width never changes (380). Height changes only for done row 2.
- Reduced motion: opacity only, 1ms.

### 2.9 Clicks

- Click on the body while recording → `stopDictation`.
- `ESC` cap click → `cancelDictation` (recording, transcribing, cleaning). Hover: cap border
  `--text-0`, text `--text-0`. There is no separate ✕ button; delete `.pill-cancel`.
- Done / error: clicks ignored.

---

## 3. Settings window (`index.html`, `src/App.tsx`)

### 3.1 Window and shell

- Default **920 × 660**, min **760 × 540**. Native decorations (unchanged). Title `VoxFlow`.
- Shell: sidebar **200px** with `border-right: 1px solid --line`, content column with
  **32px padding**, content max-width **640px**, left-aligned. Content scrolls; sidebar does not.

```
┌──────────────┬────────────────────────────────────────────────┐
│ VOXFLOW      │  General                                  SAVED │  ← fs-xl 700 / mono note
│              │  Hotkey and behaviour.                          │  ← fs-sm text-1
│ 1 General    │ ────────────────────────────────────────────── │  ← 1px --line
│ 2 Transcript.│  [Banner]                                       │
│ 3 Cleanup    │  ┌ HOTKEY ──────────────────────────────────┐  │  ← Box with eyebrow
│ 4 Playground │  │ Dictation hotkey        [Ctrl][Shift][Space]│  │
│ 5 History    │  │ ─────────────────────────────────────────── │  │
│ 6 About      │  │ Hotkey mode             [Hybrid|PTT|Toggle] │  │
│              │  └─────────────────────────────────────────────┘  │
│ ────────────  │                                                  │
│ [Transcribe   │                                                  │
│  file…]       │                                                  │
│ [Preview      │                                                  │
│  overlay]     │                                                  │
│ ────────────  │                                                  │
│ ■ IDLE        │                                                  │
│ Ctrl+Shift+Sp │                                                  │
└──────────────┴────────────────────────────────────────────────┘
```

**Sidebar** (`--bg-1`):

- Wordmark: `VOXFLOW` mono `--fs-xs` uppercase `letter-spacing .12em` `--text-0`, 16px inset,
  48px tall row, `border-bottom: 1px solid --line`. No icon next to it (the app icon lives in the
  title bar and tray).
- Nav rows: 36px tall, padding `0 16px`, label sans `--fs-md` 500 `--text-1`; left of the label a
  mono `--fs-xs` index `1`…`6` in `--text-2` (28px column). Hover: bg `--bg-2`. Active: label
  `--text-0`, index `--accent`, and a **2px `--accent` bar** on the left edge (`box-shadow:
  inset 2px 0 0 var(--accent)` is acceptable here; it is a line, not a shadow). No fill.
- The index doubles as the shortcut hint: `Ctrl+N`. Drop the `Ctrl 1` key-combo on the right.
- **Tools block** (below nav, above the footer, separated by 1px `--line` top and bottom, 12px
  padding): two full-width secondary buttons stacked with 8px gap: `Transcribe file…` and
  `Preview overlay`. `Transcribe file…` calls `transcribe_file`; while it runs the button shows
  `Transcribing…` disabled. `Preview overlay` calls `preview_overlay` and is disabled while
  the status is not idle. These live here so they are reachable from every section.
- **Footer** (16px padding): status line mono `--fs-xs` uppercase: 8×8 square + `IDLE` /
  `RECORDING` / `TRANSCRIBING` / `CLEANING` (square `--text-2` idle, `--accent` recording,
  `--accent` outlined for transcribing/cleaning) and under it the current hotkey as `KeyCombo`
  xs.

**SectionHeader**: title `--fs-xl` 700 `--text-0` (`tabindex=-1`, focus target), subtitle
`--fs-sm` `--text-1`, right slot for `SAVED` (mono xs `--accent`, 1.2s, existing
`useSavedFlash`) or the history filter. `border-bottom: 1px solid --line`, 24px bottom margin.

### 3.2 Box and Field (replaces Card)

**Box**: `border: 1px solid --line`, radius 0, no fill (`--bg-0`), padding `0 16px`.
**Eyebrow** (replaces CardTitle): mono `--fs-xs` uppercase `--text-2`, sits **on** the top
border: `position: relative; top: -8px; background: --bg-0; padding: 0 6px; margin-left: -6px`.
Keep the React names `Card` / `CardTitle` if renaming churns too much; the CSS classes become
`.box` / `.box-eyebrow`.

**Field**: horizontal row, label column 220px (label `--fs-md` 500 `--text-0`, helper `--fs-sm`
`--text-1` under it), control right-aligned, padding `12px 0`, `border-top: 1px solid --line`
between rows (first row none). Disabled: label `--text-2`, control 50% opacity. Error: message
under the control in `--err` `--fs-sm`.

Controls save on change; `SAVED` flashes in the header. Failed save → error Banner.

### 3.3 General (unchanged content, new skin)

Boxes `HOTKEY` (hotkey, mode), `INPUT` (microphone, language), `OUTPUT` (paste, restore
clipboard, save history), `APPEARANCE` (theme). Helper copy unchanged from v1. Theme segmented
`System` / `Dark` / `Light`.

HotkeyRecorder: 32px-tall box with `1px solid --line-strong`, key caps inside, right text button
`Change`. Listening: border `--accent`, caps replaced by mono `PRESS KEYS…` in `--text-1`,
`Change` becomes `Esc to cancel`. Captured: border flashes `--accent` 600ms. Invalid: border
`--err` + message. Behaviour as v1.

### 3.4 Transcription (unchanged content, new skin)

Segmented `Local` / `Server`. Local: Box `MODELS` with `ModelRow`s (48px, mono name, size mono
`--text-1`, `EN` badge for `.en` models, status column: `Download` secondary / progress + `61%`
+ `Cancel` ghost / `Use` secondary + trash icon / `ACTIVE` badge). Delete = inline confirm.
Server: Box `SERVER` with preset Select (`OpenAI`, `Groq`, `Local server`, `Custom`), Base URL
(mono input), Model (mono input), `ApiKeyField`, `Test connection` + inline result (`CONNECTED
412 MS` mono `--accent` / `FAILED: 401` mono `--err`).

`ApiKeyField` moves from `Transcription.tsx` into `src/components/ui.tsx` (it is now used by
Cleanup too) with props `{ saved: boolean; onSave(key): Promise<void>; onClear(): Promise<void> }`.

### 3.5 Cleanup (new, `src/sections/Cleanup.tsx`)

Title `Cleanup`, subtitle `What happens to the transcript before it is pasted.`

Box `MODE`:

| Field | Control | Helper |
| --- | --- | --- |
| Cleanup | Segmented `Off` / `Basic` / `AI` | Off: `Raw transcript, trimmed.` Basic: `Removes fillers and stutters, fixes spacing and capitalization. Runs locally, instantly.` AI: `Sends the transcript to a chat model to remove disfluencies and apply self-corrections. Falls back to Basic on any failure.` (helper follows selection) |

Box `AI PROVIDER` (rendered always; fields disabled when mode ≠ `ai`, so the user can configure
before switching):

| Field | Control | Notes |
| --- | --- | --- |
| Preset | Select: `Ollama`, `LM Studio`, `OpenAI`, `Groq`, `OpenRouter`, `Anthropic`, `Custom` | Selecting fills URL + model (`llama3.2`, `local-model`, `gpt-4o-mini`, `llama-3.1-8b-instant`, `openai/gpt-4o-mini`, `claude-3-5-haiku-latest`); editing either field flips to `Custom`. Six presets is too many for a segmented control, hence Select. |
| Base URL | Input mono, placeholder `http://localhost:11434/v1` | validate `http(s)://` on blur |
| Model | Input mono, placeholder `llama3.2` | — |
| API key | `ApiKeyField` (uses `set_ai_key` / `clear_ai_key`, `hasAiKey`) | helper `Stored in the system keyring. Local servers usually need none.` |
| — | Button `Test` secondary + inline mono result (`CONNECTED` / `FAILED: <reason>`) | calls `test_ai` |

### 3.6 Playground (new, `src/sections/Playground.tsx`)

Title `Playground`, subtitle `Paste a raw transcript and compare cleanup outputs.`

Layout, top to bottom:

1. `Textarea` mono `--fs-sm`, 120px tall, full width, placeholder
   `um so I I think we should, uh, ship it on on friday`. Below it, right-aligned: mono hint
   `CTRL+ENTER` key cap + primary Button `Run`. Disabled while empty or running (label `Running…`).
2. Two columns, 50/50, gap 16px, each a Box with eyebrow `BASIC` / `AI`. Body: sans `--fs-md`
   `--text-0`, `white-space: pre-wrap`, min-height 96px, padding 12px 0. A small ghost `Copy`
   icon button at the top-right of each box.
   - Before the first run both bodies show `—` in `--text-2`.
   - AI column when `aiError` is set: eyebrow becomes `AI · FAILED` in `--err`, body first line
     is the error in mono `--fs-sm` `--err`, second line sans `--text-1`: `Basic output would be
     used.` When cleanup mode is not `ai` and there is no key/URL, the backend still returns
     `aiError`; render it the same way (no special-casing).
   - Under each body a mono `--fs-xs` `--text-2` counter: `−N WORDS` / `EDITED` / `UNCHANGED`
     computed as in §2.7.

### 3.7 History

Header: title `History` + right slot: `FilterInput` (240px, placeholder `Filter  Ctrl+F`, clear
×) and ghost `Clear all`.

`HistoryRow` (list, hairline dividers, padding `12px 8px`, hover `--bg-2`, focus ring inside):

```
 So I think we should ship it on Friday.                                    2 MIN AGO
 −4 FILLERS  RAW                                          [Copy] [Delete]   (hover/focus)
```

- Line 1: cleaned `text`, sans `--fs-md`, clamp 2 lines; Enter toggles full text.
- Line 2 (meta row, mono `--fs-xs` `--text-2`): removed-count (`−4 FILLERS` / `EDITED`, only when
  `raw` exists) and a `RAW` toggle (ghost xs button with `aria-pressed`) that reveals the raw
  transcript underneath in a `--bg-1` block, `1px solid --line`, mono `--fs-sm` `--text-1`,
  padding 8px 12px, eyebrow `RAW`. `R` key on a focused row toggles it. Entries without `raw`
  show no toggle.
- Timestamp mono `--fs-xs` `--text-2` uppercase: `JUST NOW`, `4 MIN AGO`, `2 H AGO`,
  `YESTERDAY 14:02`, `12 MAR 09:41`; title = ISO.
- Actions on hover/focus: `Copy` (swaps to `COPIED` in `--accent` for 1.2s), `Delete` (row
  collapses `--dur-3`, no confirm). Clear all → `InlineConfirm` under the header.
- Filter: substring, debounce 120ms, matches highlighted with `--accent-soft` bg (no radius).
- Empty states unchanged in copy; icon 24px `--text-2`, title `--fs-lg`, body `--fs-sm`.

### 3.8 About

Definition list (label mono `--fs-xs` uppercase `--text-2` 160px, value sans/mono `--text-0`):
`VERSION`, `DATA FOLDER` (+ ghost `Open folder`), `MODELS`, `CLEANUP` (`Basic` / `AI · llama3.2
@ localhost:11434`), `LAST ERROR` (mono, wrap, or `None`). Then Box `SHORTCUTS` with the key
table (§4).

### 3.9 Banner

Top of the content column. `border: 1px solid --err`, `border-left-width: 2px`, bg `--err-soft`,
padding `12px 16px`, icon 16px, title sans `--fs-md` 500, body `--fs-sm` one line ellipsis,
right ghost `Dismiss`. Info variant: `--accent` border, `--accent-soft` bg. Enter: opacity +
`translateY(-4px→0)` `--dur-3`. Dismiss: opacity `--dur-2`.

---

## 4. Keyboard map

| Keys | Where | Action |
| --- | --- | --- |
| `Ctrl+1` … `Ctrl+6` | window | General / Transcription / Cleanup / Playground / History / About; focus the section title. Update `SECTIONS` and the key check in `App.tsx` to `["1".."6"]`. |
| `Ctrl+F` | window | History + focus filter |
| `Ctrl+W` | window | Hide to tray |
| `Ctrl+Enter` | Playground textarea | Run |
| `Esc` | filter / recorder / inline confirm / expanded row / raw peek | clear / abort / cancel / collapse |
| `Enter` / `Space` | history row | toggle expand |
| `R` | focused history row | toggle raw peek |
| `Ctrl+C` / `Delete` | focused history row | copy / delete |
| `↑` `↓` `Home` `End` | lists | roving focus |
| `←` `→` | Segmented | change value |

Focus ring, everywhere, only on `:focus-visible`:
`outline: 2px solid var(--focus); outline-offset: 2px;` rows and segmented options use
`outline-offset: -2px`. Never `outline: none` without this replacement.

---

## 5. Component inventory

React name → CSS class (kebab). Sizes are fixed; deviation is drift.

| Component | Spec |
| --- | --- |
| `Button` | height 32, padding `0 12px`, radius 0, sans `--fs-md` 500, min-width 64. `primary`: bg `--accent-fill`, text `--accent-text`, border 1px `--accent-fill`; hover bg `--text-0` (dark) / stays (light) — simpler: hover `filter: brightness(.92)`; active `.85`. `secondary`: transparent, border 1px `--line-strong`, text `--text-0`; hover border `--text-0`; active bg `--bg-2`. `ghost`: no border, text `--text-1`; hover text `--text-0` bg `--bg-2`. `danger`: transparent, border 1px `--err`, text `--err`; hover bg `--err` text `#FFFFFF`. `icon`: 28×28 ghost. Disabled: 40% opacity, no hover. Loading: 12px stepper (§2.6 reduced variant) replaces the icon. |
| `Input` / `Textarea` | height 32 (textarea auto), padding `0 10px`, bg `--bg-0`, border 1px `--line`, radius 0, sans `--fs-md`; `.input--mono` uses mono `--fs-sm`. Hover border `--line-strong`; focus border `--text-0` + focus ring; invalid border `--err`; placeholder `--text-2`. |
| `Segmented` | `role=radiogroup`; options are adjoining 28px-tall buttons with 1px `--line-strong` borders (shared borders collapse via `margin-left: -1px`), sans `--fs-md` 500 `--text-1`, padding `0 12px`. Selected: **inverted** — bg `--text-0`, text `--bg-0`. Hover unselected: bg `--bg-2`. |
| `Toggle` | `<button role=switch>` 36×20 rectangle, border 1px `--line-strong`, knob 14×14 square inset 2px. Off: knob `--text-1`, track transparent. On: track `--accent-fill`, border `--accent-fill`, knob `--accent-text`. Knob slides 16px in `--dur-1`. |
| `Select` | native `<select>`, `appearance: none`, same box as Input, chevron 12px inline SVG right 10px. |
| `FilterInput` | Input with 12px search icon left (padding-left 30) and clear × button right. |
| `KeyCombo` / key cap | each cap: mono `--fs-2xs` uppercase, padding `2px 6px`, border 1px `--line-strong`, radius 0, bg `--bg-2` (settings) or transparent (pill), `--text-1`; gap 4. Caps order `Ctrl` `Alt` `Shift` `Win/Super` key. |
| `Badge` | mono `--fs-2xs` uppercase, padding `1px 6px`, border 1px currentColor, radius 0, transparent bg. Tones: `accent` (text `--accent`), `muted` (`--text-2`), `err`. `ACTIVE`, `EN`, `−4 FILLERS`. |
| `ListRow` (ModelRow, HistoryRow) | min-height 48 / 44, `border-top: 1px solid --line`, hover `--bg-2`, focus ring inset. |
| `ProgressBar` | 2px track `--line`, fill `--accent`, width transition `--dur-3 linear`; indeterminate = §2.6 sweep at 120px. |
| `Banner` | §3.9 |
| `EmptyState` | centered, 64px top margin, icon 24 `--text-2`, title `--fs-lg`, body `--fs-sm` `--text-1`, optional ghost action. |
| `InlineConfirm` | row: text `--fs-sm` + `danger` + `ghost` buttons; Esc cancels; first button focused on open. |
| `Skeleton` | `--bg-2` blocks 12px tall, 60%/40%, opacity 1 ↔ .5 `steps(1)` 800ms (no shimmer). |
| `Stepper` (replaces `Spinner`) | three 4×8 blocks, gap 2, currentColor, fill sequence every 250ms `steps(1)` (500ms under reduced motion). Used in buttons and `Testing…`. |
| `Pill` | root of `pill.tsx`; states `recording` (`data-mode`), `transcribing`, `cleaning`, `done` (`data-note`), `error`. |
| `Waveform` | canvas, §2.5. |
| `Sweep` | §2.6, used by pill and indeterminate progress. |
| `ApiKeyField` | none / saving / saved (`•••••••• SAVED` mono, `Replace` secondary, `Remove` ghost→err on hover) / replacing / error. |

Transitions only on `background-color, border-color, color, opacity, transform, height, width`.
Never `transition: all`. Every interactive element ≥ 28×28 hit area, rows ≥ 44px.

---

## 6. File boundaries

| File | Owns |
| --- | --- |
| `src/styles/tokens.css` | §1 only: both theme blocks, type scale, spacing, borders, radii, motion, reduced-motion overrides. |
| `src/styles/pill.css` | §2 only. Classes: `.pill-root`, `.pill-body[data-state][data-mode]`, `.pill-mark`, `.pill-label`, `.pill-content`, `.pill-snippet`, `.pill-note`, `.pill-cap`, `.sweep`, `.stepper`. |
| `src/styles/app.css` | §3–5 settings window. Rename `.card`→`.box`, `.card-title`→`.box-eyebrow`; add `.tools`, `.playground`, `.playground-columns`, `.history-row-meta`, `.raw-peek`. |
| `src/pill.tsx` | Pill state machine, timer, auto-hide, done counter (§2.7), snippet. Reads `text`/`raw` from the event. |
| `src/components/Waveform.tsx` | Canvas waveform (§2.5). Props `{ levelRef, reducedMotion }` unchanged. |
| `src/components/ui.tsx` | Everything in §5 except Waveform/Pill: add `Textarea`, `Stepper`, `Sweep`, `ApiKeyField` (moved), `Box`/`Eyebrow` (or keep `Card`/`CardTitle` names). |
| `src/components/icons.tsx` | Inline SVG, 1.5px stroke, square caps and joins (`stroke-linecap: square`). Add `Play`, `File`, `Eye`. |
| `src/sections/Cleanup.tsx` | §3.5 |
| `src/sections/Playground.tsx` | §3.6 |
| `src/sections/History.tsx` | §3.7 (raw peek, counter) |
| `src/App.tsx` | six sections, `Ctrl+1..6`, sidebar tools wiring (`transcribe_file`, `preview_overlay`). |
| `src/lib/ipc.ts` | schema additions: `cleanup`, `ai`, `hasAiKey`, `raw?`, state `cleaning`, event `text?`/`raw?`, new commands. |

Demo: keep the `?demo&state=` query support in `pill.tsx` and extend it with `cleaning`,
`done-pasted` (with a sample `text`/`raw` pair, e.g. raw `um so I I think we should, uh, ship it
on on friday` → text `So I think we should ship it on Friday.`), `done-ai-fallback`, and a
`recording` variant that feeds a synthetic level envelope to `levelRef` at 30 Hz so the
waveform can be inspected in a plain browser.

---

## 7. Drift checklist (verify against screenshots)

1. No element in either window has a border-radius other than 0, except the pill body at 4px.
2. No `box-shadow` with blur anywhere; no gradients; no translucent surfaces (pill bg is opaque).
3. Exactly three hues exist: `#C8F542` (or `#3E6B00` in light), `--err` red, and grays. No green,
   amber, coral or blue.
4. Pill is 380 × 64 (92 when done with text), 1px edge, opaque `#0A0A0A` in dark / `#FFFFFF` in light.
5. Recording pill: 8×8 accent square, `00:00`-style mono timer, canvas waveform, `ESC` cap;
   no "Recording" word, no ✕ button.
6. Waveform: 2px bars, 2px gaps, ~47 bars across 188px, uniform `--text-0` color, silence is a
   flat dotted line at 2px, bars slide continuously left (not jumping) at 60 Hz.
7. Push-to-talk: the square blinks with hard steps (no fade); hands-free: steady.
8. Transcribing/cleaning: hollow accent square, uppercase mono label, 40px accent segment
   sweeping a 2px track.
9. Done: filled accent square, `PASTED`/`COPIED` in accent, snippet on a second line in sans,
   and a `−N FILLERS` / `EDITED` mono note on the right when raw differs.
10. Error: red square, `ERROR`, message in sans, `SEE VOXFLOW` at the right; gone after 3s.
11. Settings sidebar: `VOXFLOW` mono uppercase wordmark, numbered nav 1–6, active item marked by
    a 2px accent bar and accent index only (no filled background), tools block with
    `Transcribe file…` and `Preview overlay`, footer status in uppercase mono.
12. Segmented selected option is inverted (white block, black text in dark theme).
13. Primary button is a lime block with black text; secondary is an outlined transparent box;
    toggles are rectangles with square knobs.
14. Boxes have 1px borders with the eyebrow label sitting on the top border in uppercase mono.
15. Cleanup section has the Off/Basic/AI segmented control and a provider box with a preset
    Select listing Ollama, LM Studio, OpenAI, Groq, OpenRouter, Anthropic, Custom.
16. Playground shows two side-by-side boxes labelled `BASIC` and `AI`; the AI box shows a red
    `AI · FAILED` eyebrow and the error text when the backend reports `aiError`.
17. History rows show cleaned text, a `RAW` toggle only on entries that have raw, and the raw
    text appears in a bordered mono block below.
18. Focus ring is a 2px lime outline on every focusable element when tabbing; none on mouse click.
19. Fonts render as Archivo and JetBrains Mono with the network disabled.
20. With `prefers-reduced-motion`, the pill only fades, the square does not blink, the sweep is
    a stepping 3-block indicator, and the waveform still moves but jumps per sample.
