# VoxFlow — Design Brief (v3)

Audience: the implementer. Plain CSS + custom properties, no Tailwind, no UI kit, icons are
inline SVG. Everything here is a decision. If something is missing, pick the option with fewer
colors, softer edges and larger type.

Identity in one line: **a dark floating capsule that listens, one lime signal, readable at a
glance.** Near-black surfaces, one accent, a real UI font at real sizes, full-radius capsule,
rounded controls, one soft shadow under anything that floats. Nothing glows, no gradients, no
uppercase-letterspaced body text, no condensed type.

What v3 replaces from v2: Archivo + mono everywhere (unreadable at 11–13px), square corners,
the 2px-bar waveform (too dense, not obviously live), the done snippet crammed into the pill's
top edge. What v3 keeps: the dark surface, the lime accent, the single-hue discipline, the
component set, the keyboard map, the sidebar layout.

---

## 1. Tokens

### 1.1 Typography (bundled offline via fontsource)

| Role | Family | Package (exact) | Import |
| --- | --- | --- | --- |
| Everything: UI text, pill, bubble, keycaps, timer, labels | **Inter** (variable) | `@fontsource-variable/inter` | `@fontsource-variable/inter/index.css` (CSS family `"Inter Variable"`, wght 100–900, latin + latin-ext) |
| URLs, model names, raw transcript, playground input, data folder path | **JetBrains Mono** 400 | `@fontsource/jetbrains-mono` (already installed) | `400.css` only |

Remove `@fontsource/archivo` from `package.json`. Drop the `500.css` mono import. The pill
imports only Inter (no mono in the pill at all; timer and `Esc` keycap are Inter with
`font-variant-numeric: tabular-nums`).

```
--font-sans: "Inter Variable", "Segoe UI Variable", "Segoe UI", system-ui, sans-serif;
--font-mono: "JetBrains Mono", Consolas, "DejaVu Sans Mono", monospace;
```

Global: `font-feature-settings: "cv11", "ss03"` off (defaults), `-webkit-font-smoothing:
antialiased` only on macOS (not our target, so omit). `letter-spacing: 0` everywhere. **No
`text-transform: uppercase` anywhere** except the 2-letter `EN` badge. Numbers that change
(timer, counters, percentages) set `font-variant-numeric: tabular-nums`.

Type scale (px / line-height / weight). Tokens hold `rem` (root 16px): `--fs-md: 0.9375rem`.

| Token | Size | LH | Weight | Use |
| --- | --- | --- | --- | --- |
| `--fs-xs` | 12 | 16 | 500 | keycaps, badges, timestamps, tiny counters |
| `--fs-sm` | 13 | 18 | 400 | helper copy, meta rows, box headings (500) |
| `--fs-md` | 15 | 22 | 400 | body, inputs, buttons, nav, field labels (500) |
| `--fs-lg` | 17 | 24 | 600 | empty-state titles, about values |
| `--fs-xl` | 24 | 30 | 600 | section title |
| `--fs-pill` | 16 | 22 | 500 | pill label / timer / state word |
| `--fs-bubble` | 16 | 22 | 400 | bubble transcript |

Minimum text size anywhere is 12px, and 12px is only for keycaps, badges and timestamps.

### 1.2 Color

`data-theme` on `<html>`: `dark` | `light` (`system` resolves in JS via existing `applyTheme`).
Dark is the identity; light is a real inversion.

| Token | Dark | Light | Role |
| --- | --- | --- | --- |
| `--bg-0` | `#0F0F10` | `#FFFFFF` | window background |
| `--bg-1` | `#161618` | `#F6F6F7` | sidebar, boxes, textarea, raw block |
| `--bg-2` | `#1E1E21` | `#ECECEE` | hover row, segmented track, keycap fill, active nav |
| `--bg-3` | `#2A2A2E` | `#DFDFE3` | pressed, disabled fill, toggle-off track |
| `--text-0` | `#F2F2F3` | `#111113` | primary text, waveform bars |
| `--text-1` | `#A6A6AD` | `#55555C` | secondary / helper |
| `--text-2` | `#85858D` | `#6E6E76` | meta, placeholder (AA at 13px+) |
| `--line` | `#2A2A2E` | `#DCDCE0` | hairlines, dividers, box borders, input rest |
| `--line-strong` | `#4A4A52` | `#9A9AA2` | control borders at hover, keycap border |
| `--accent` | `#C8F542` | `#3E6B00` | the signal: active nav index, recording dot, `Pasted`, links, focus ring, progress |
| `--accent-fill` | `#C8F542` | `#C8F542` | filled: primary button, toggle-on track, done dot |
| `--accent-text` | `#0F0F10` | `#0F0F10` | text on `--accent-fill` |
| `--accent-soft` | `rgba(200,245,66,.14)` | `rgba(62,107,0,.10)` | filter-match highlight, info banner bg |
| `--err` | `#FF6B6B` | `#C4171C` | errors, danger, error dot |
| `--err-soft` | `rgba(255,107,107,.12)` | `rgba(196,23,28,.08)` | error banner bg |
| `--pill-bg` | `#161618` | `#FFFFFF` | pill and bubble surface, **opaque** |
| `--pill-line` | `rgba(255,255,255,.14)` | `#DCDCE0` | pill and bubble 1px edge |
| `--shadow-float` | `0 8px 24px rgba(0,0,0,.45), 0 1px 2px rgba(0,0,0,.4)` | `0 8px 24px rgba(0,0,0,.14), 0 1px 2px rgba(0,0,0,.08)` | pill, bubble. The only shadow in the product. |
| `--focus` | `var(--accent)` | `var(--accent)` | focus ring |

Lime stays: on `#161618` it reads 14.3:1 and it is the one thing users recognized. No green,
amber, blue or coral. The only other hue is `--err`.

Contrast (WCAG 2.x, computed on the values above):

| Pair | Dark | Light | Requirement |
| --- | --- | --- | --- |
| `--text-0` on `--bg-0` | 17.6:1 | 18.1:1 | ≥ 7 |
| `--text-0` on `--pill-bg` | 15.6:1 | 18.1:1 | ≥ 7 |
| `--text-1` on `--bg-0` | 8.1:1 | 7.2:1 | ≥ 4.5 |
| `--text-1` on `--bg-1` / `--pill-bg` | 7.5:1 | 6.7:1 | ≥ 4.5 |
| `--text-2` on `--bg-0` | 5.2:1 | 5.0:1 | ≥ 4.5 |
| `--text-2` on `--bg-1` / `--pill-bg` | 4.9:1 | 4.7:1 | ≥ 4.5 |
| `--accent` on `--pill-bg` | 14.3:1 | 6.3:1 | ≥ 4.5 |
| `--accent-text` on `--accent-fill` | 15.9:1 | 15.9:1 | ≥ 4.5 |
| `--err` on `--pill-bg` | 6.8:1 | 5.9:1 | ≥ 4.5 |
| `--line-strong` on `--bg-0` | 3.1:1 | 3.0:1 | ≥ 3 (non-text) |

`--text-2` is never the sole carrier of information.

### 1.3 Spacing, lines, radii, depth

- Spacing (`--sp-1..8`): 2, 4, 8, 12, 16, 24, 32, 48. Grid is 8.
- Border widths: `--bw: 1px`, `--bw-focus: 2px`.
- Radii scale — every rounded thing uses one of these, nothing else:

| Token | Value | Use |
| --- | --- | --- |
| `--r-1` | 6px | keycaps, badges, inline tags, skeleton blocks |
| `--r-2` | 10px | buttons, inputs, select, textarea, nav rows, hotkey recorder |
| `--r-3` | 14px | boxes, banner, raw block, playground columns |
| `--r-4` | 18px | transcript bubble |
| `--r-full` | 999px | pill capsule, toggle, segmented track + options, progress bar, dots |

- Depth: `--shadow-float` on the pill and bubble only. The settings window has **no shadows**;
  boxes are `--bg-1` fill + 1px `--line`. No inset shadows, no glows, no gradients, no
  backdrop-filter.

### 1.4 Motion

| Token | Value | Use |
| --- | --- | --- |
| `--dur-1` | 100ms | hover/press color, toggle knob |
| `--dur-2` | 200ms | pill show/hide, content swap, section switch |
| `--dur-3` | 320ms | bubble enter, banner enter, row delete collapse |
| `--ease-out` | `cubic-bezier(.22, 1, .36, 1)` | entrances, growth |
| `--ease-in` | `cubic-bezier(.4, 0, 1, 1)` | exits |
| `--ease-spring` | `cubic-bezier(.34, 1.3, .64, 1)` | bubble entrance only (one small overshoot) |
| `--ease-lin` | `linear` | sweeps, timers, waveform tape |

`prefers-reduced-motion: reduce`: `--dur-1/2/3` become 1ms; every `translate`/`scale` is
removed (opacity only); the sweep becomes a static 3-dot stepper changing every 500ms with no
tween; the recording dot does not pulse; warm-up dots do not pulse (steady at 60% opacity); the
waveform still updates (it is information) but bars jump per sample instead of sliding. The
existing `useReducedMotion` hook in `pill.tsx` stays and is passed down.

---

## 2. The pill (`pill.html`, `src/pill.tsx`, `src/styles/pill.css`)

### 2.1 Window

- Logical size **440 × 220**. Update `tauri.conf.json` (`width: 440, height: 220`) and the
  `(400.0 * s, 112.0 * s)` in `src-tauri/src/dictation.rs` to `(440.0 * s, 220.0 * s)`.
- Layout inside the window, bottom-anchored (growth goes upward):

```
 y=0   ┌──────────────────────────── 440 ────────────────────────────┐
       │                (empty, transparent)                         │
       │        ┌──────────────── bubble ≤ 400 ────────────────┐     │  bubble bottom = pill top − 10
       │        │  transcript, ≤ 4 lines                       │     │
       │        │  −4 fillers                   Click to copy  │     │
       │        └───────────────────────────────────────────────┘     │
       │             ╭──────────── pill 360 × 56 ───────────╮         │  pill bottom = window bottom − 12
 y=220 └─────────────╰──────────────────────────────────────╯─────────┘
```

  Pill: **360 × 56**, horizontally centered, `bottom: 12px`. Bubble: centered, `max-width:
  400px`, `bottom: 78px` (12 + 56 + 10). Vertical budget: 12 + 56 + 10 + bubble max ~134
  (see §2.7) = 212 ≤ 220, leaving 8px for the shadow. Shadow is clipped at the window edge
  on the sides by design (12px of 24px blur reaches the edge only at the widest bubble; that
  is acceptable, do not widen the window).
- Position: pill bottom edge 24px above the monitor work area → **window bottom = work area
  bottom − 12px**. Fallback without work area: window bottom = monitor bottom − 60px.
  Recompute on every show.
- Window flags unchanged: transparent, undecorated, always-on-top, skip-taskbar,
  **non-focusable**, not click-through. The window receives mouse events but never keyboard
  focus; every click handler must not rely on focus.
- `html, body { background: transparent; margin: 0; overflow: hidden; user-select: none; }`.
  The empty area of the window is transparent and (unavoidably) catches clicks; keep the
  window this tight for that reason.

### 2.2 Pill anatomy (360 × 56)

```
  ╭────────────────────────────────────────────────────────────────╮  r=full, 1px --pill-line, --shadow-float
  │  ●   00:04    ▂▄▆█▆▃▂▁▂▄▇█▆▄▂▁▁▂▄▆▅▃▂▁▂▃▅▆▄▂          ⎡Esc⎤     │
  ╰────────────────────────────────────────────────────────────────╯
    20  10   12               waveform (flex 1) 28 tall     12  cap  16
```

Left to right, vertically centered, padding `0 16px 0 20px`:

1. **Dot**: 10×10, `--r-full`. Color/shape per state.
2. **Label slot** (`min-width: 52px; width: auto`, Inter `--fs-pill`, tabular): timer while
   recording; state word otherwise.
3. **Content slot** (flex 1, min-width 0, height 28): waveform / warm-up dots / sweep / text.
4. **Right slot**: the `Esc` keycap (a `<button>`), or a short note.

Colors: body `--pill-bg`, edge `1px solid --pill-line`, `box-shadow: var(--shadow-float)`,
text `--text-0`. Cursor `default` on body, `pointer` on the cap and (while recording) on the
body.

Keycap (`.pill-cap`): height 24, padding `0 8px`, `--r-1`, border 1px `--line-strong`, bg
`--bg-2` (dark) / `--bg-1` (light), Inter `--fs-xs` 500 `--text-1`, label `Esc`. Hover: border
and text `--text-0`. Hit area 32×32 via padding on a transparent wrapper.

### 2.3 States

| State | Dot | Label (Inter 16/500) | Content slot | Right slot | Shown for |
| --- | --- | --- | --- | --- | --- |
| idle | — | — | — | — | hidden |
| recording · warm-up (no level event yet) | `--accent` filled, steady | `Listening…` in `--text-1` | Warm-up dots (§2.5) | `Esc` | until first `dictation://level` (backend fails the session at 1500ms) |
| recording · live, hands-free | `--accent` filled, steady | timer `00:04` in `--text-0` | Waveform (§2.6) | `Esc` | until stop |
| recording · live, push-to-talk (key held) | `--accent` filled, **pulse**: opacity 1 → .45 → 1, 1200ms `ease-in-out` infinite | timer | Waveform | `Esc` | until release |
| transcribing | ring: transparent fill, `2px solid --accent` | `Transcribing…` in `--text-0` | Sweep (§2.8) | `Esc` | until backend |
| cleaning | same ring | `Cleaning up…` | Sweep | `Esc` | until backend |
| done: Pasted | `--accent-fill` filled | `Pasted` in `--accent`, weight 600 | empty | note (§2.7) | 2200ms |
| done: Copied | same | `Copied` in `--accent` 600 | empty | note | 2600ms |
| done with AI fallback | same | `Pasted` / `Copied` | empty | `AI failed · basic` in `--err` | 3000ms |
| done · paste-last flash (text, no raw) | same | `Pasted` / `Copied` | empty | nothing | 2200ms |
| done · after bubble click | same | `Copied` swaps in for 1000ms then reverts | empty | note | dismissal paused during the 1000ms |
| error | `--err` filled | `Error` in `--err` 600 | message, Inter `--fs-md` `--text-0`, one line, ellipsis, ≤ 56 chars | `Open VoxFlow` `--fs-sm` `--text-2` | 3500ms |

Recording mode (`mode` on `dictation://state`): `push_to_talk` → pulsing dot; `toggle` or
absent → steady. Hybrid opens pulsing; when the backend re-sends `mode: "toggle"` the pulse
stops (transition over `--dur-2`, not a hard cut). No "release to stop" text.

Warm-up → live is a content-slot crossfade (`--dur-2`); the label swaps `Listening…` → timer at
the same moment. The timer starts counting at the first `recording` event (so it can read
`00:01` when it appears); it is simply hidden during warm-up.

Timer: `mm:ss`, updates every 1000ms aligned to the start timestamp (existing self-correcting
`setTimeout` chain), stops at the first non-recording state.

Screen reader text (`role="status" aria-live="polite"`, visually hidden span in the content
slot): `Listening`, `Recording`, `Transcribing`, `Cleaning up`, `Pasted`, `Copied to
clipboard`, `Error: <message>`.

### 2.4 Copy (exact)

| Where | Copy |
| --- | --- |
| Warm-up label | `Listening…` |
| Transcribing / cleaning labels | `Transcribing…` / `Cleaning up…` |
| Done labels | `Pasted` / `Copied` |
| Removed-count note (bubble footer and pill right slot) | `−N fillers` (N ≥ 1, U+2212 minus), or `Edited` when raw differs but N ≤ 0, nothing when raw is absent |
| AI fallback note | `AI failed · basic` (shown when `message` contains "AI cleanup failed") |
| Bubble hint | `Click to copy` → `Copied` for 1000ms after click |
| Error label / right note | `Error` / `Open VoxFlow` |
| Cancel cap | `Esc` |

Sentence case everywhere. No uppercase, no letter-spacing.

### 2.5 Warm-up dots (recording, before the first level event)

Three 6×6 `--r-full` dots in `--text-1`, gap 6, left-aligned in the content slot, vertically
centered. Animation: each dot `opacity .35 → 1 → .35`, `transform: scale(.85 → 1 → .85)`,
900ms `ease-in-out` infinite, delays 0 / 150 / 300ms. Reduced motion: steady at opacity .6,
no scale. This is the "mic is opening" cue. It never shows once a level event has arrived,
even if levels drop to 0 afterwards.

### 2.6 Waveform (recording, live)

**Rendering: one `<canvas>`** filling the content slot (width read from `clientWidth` on mount
and on `ResizeObserver`; at 360px pill it is ~208px), height **28**, backing store scaled by
`devicePixelRatio`, redrawn every `requestAnimationFrame` while recording. Replaces the current
`src/components/Waveform.tsx` internals; props `{ levelRef, reducedMotion }` unchanged.

Geometry:

- Bar width **3px**, gap **2px**, pitch 5px → `N = floor((W + 2) / 5)` = **42** bars at 208px.
- Bars are **rounded**: `ctx.roundRect(x, y, 3, h, 1.5)` (WebView2 supports it; fallback to
  `fillRect` if `roundRect` is undefined).
- Height range **4px (floor) to 28px (full)**, **mirrored around the vertical center** (a bar of
  height `h` spans `y = (28 − h) / 2` to `(28 + h) / 2`). This is what makes it read as audio,
  not a bar chart.
- Color `--text-0` for bars, uniform. Read via `getComputedStyle` each frame (cheap) so theme
  switches apply live.

Signal (input is already perceptual 0..1, speech ≈ 0.5–0.8, one event per 25ms):

- `v = clamp(level * GAIN, 0, 1)`, **`GAIN = 1.0`**
  (`// ponytail: level is already dB-mapped 0..1; raise GAIN only if real speech peaks under 0.6`).
- Envelope per rAF: `env += (v − env) * (v > env ? 0.6 : 0.15)`. Attack ≈ 1–2 frames, release
  ≈ 6–7 frames at 60Hz (~110ms) so consonants show and pauses decay visibly but not
  instantly. Same under reduced motion (it is a filter).
- Sample ring: every **25ms** of elapsed time (`accumulator` on `performance.now()`), push `env`
  into a ring of `N` values. Newest at the **right**; ring starts filled with 0.

Draw (per rAF):

- `h = 4 + 24 * sqrt(sample)`, mirrored as above. `sqrt` lifts quiet speech.
- **Tape slide**: offset the whole row by `−(elapsedSinceLastPush / 25) * 5` px so bars travel
  continuously left at 5px per 25ms. Clip to the canvas. Reduced motion: offset 0.
- The rightmost bar draws the **live `env`** rather than the last pushed sample.
- Silence: all bars at 4px → a row of small rounded 3×4 dots. That is the "listening, quiet"
  look. No placeholder text.
- Values ≥ 1 clamp to 28px. No peak-hold, no clipping color, no left-to-right fade.

Bookkeeping: cancel the rAF on unmount and when `state` leaves recording; reset `env`, ring and
accumulator on each entry to recording.

### 2.7 Transcript bubble (done state)

A rounded card floating above the pill, shown whenever `state === "done"` and `text` is
non-empty (real dictation, transcribe-file, and the paste-last flash which has `text` but no
`raw`). New component `src/components/TranscriptBubble.tsx`, rendered by `pill.tsx` as a
sibling of the pill body (not inside it).

```
 ╭────────────────────────────────────────────────────────╮  r=18, --pill-bg, 1px --pill-line, --shadow-float
 │ So I think we should ship the new build on Friday,     │  padding 14px 16px 12px
 │ no wait, Monday. Let me check with the team first      │  Inter 16/22 --text-0, ≤ 4 lines
 │ and get back to you about the timeline for the…        │
 │                                                        │
 │ −4 fillers                              Click to copy  │  footer row, Inter 13 --text-2, margin-top 8
 ╰────────────────────────────────────────────────────────╯
```

- Box: `max-width: 400px; min-width: 240px; width: max-content` (so short transcripts get a
  small bubble), centered over the pill, `bottom: 78px`. `--r-4`, bg `--pill-bg`, border 1px
  `--pill-line`, `box-shadow: var(--shadow-float)`. Padding `14px 16px 12px`.
- Text: Inter `--fs-bubble` (16/22) `--text-0`, `white-space: pre-wrap`, `overflow-wrap:
  anywhere`, clamped to **4 lines** with `display: -webkit-box; -webkit-line-clamp: 4;
  -webkit-box-orient: vertical; overflow: hidden` (ellipsis on the 4th line). Additionally a
  12px-tall bottom fade is **not** used — the ellipsis is enough and a fade over opaque text is
  a gradient. Max content height = 88px.
- Footer row (only rendered when it has something): `display: flex; justify-content:
  space-between; margin-top: 8px`, Inter `--fs-sm` `--text-2`. Left: the removed-count note
  (`−4 fillers` / `Edited`, or `AI failed · basic` in `--err`), or empty. Right: `Click to
  copy`; after a click it reads `Copied` in `--accent` for 1000ms. For the paste-last flash the
  left is empty and the right still shows `Click to copy`.
- Bubble max height: 14 + 88 + 8 + 18 + 12 = **140px** (the §2.1 budget rounds this to 134 +
  shadow; 12 + 56 + 10 + 140 = 218 ≤ 220, fine).
- The pill's right slot still shows the note (so the state is understandable if the bubble is
  glanced past); the bubble footer repeats it. No note in the pill during the paste-last flash.
- **Click** anywhere on the bubble → `copy_text(text)`; footer swaps to `Copied`, pill label
  swaps to `Copied` (§2.3); dismissal timer pauses for the 1000ms feedback, then resumes with
  the remaining time (minimum 800ms). Cursor `pointer` on the bubble.
- **Hover pauses dismissal**: `mouseenter` clears the auto-hide timer; `mouseleave` restarts it
  at **1200ms**. This works because the window is non-focusable but receives mouse events.
  Maximum total on-screen time is not capped (the user is hovering on purpose).
- Entrance: `opacity 0 → 1`, `transform: translateY(8px) scale(.98) → none`, `--dur-3
  --ease-spring`, starting **60ms after** the pill's done state (the pill label changes first,
  then the bubble pops). Exit: `opacity 1 → 0`, `translateY(0 → 4px)`, `--dur-2 --ease-in`,
  simultaneous with the pill hide. Reduced motion: opacity only, 1ms.
- The bubble is `aria-hidden` (the pill's live region already announces the state; the
  transcript itself is not read aloud, it was just pasted).

### 2.8 Sweep (transcribing, cleaning)

Content slot shows a `100% × 4px` track, `--r-full`, bg `--line`, overflow hidden, with a
**48px `--accent` segment** (also `--r-full`) moving left→right over **1100ms `--ease-lin`,
infinite**, restarting hard. Vertically centered. Reduced motion: three 6×6 `--r-full` dots
(gap 6) at the left of the slot, in `--line-strong`; dots fill `--accent` in sequence (1, 2, 3,
none, 1 …) every 500ms via `steps(1)`. The existing `.sweep` / `.sweep-reduced` classes stay;
only the sizes and radii change.

### 2.9 Transitions

- hidden → visible: window shown at final position; pill `opacity 0 → 1`, `translateY(8px → 0)`,
  `--dur-2 --ease-out`.
- visible → hidden: pill and bubble `opacity 1 → 0`, `translateY(0 → 4px)`, `--dur-2
  --ease-in`, then hide the window (existing `visible` state in `pill.tsx`; `AUTO_HIDE_MS` keys
  `done:pasted` 2200, `done:copied` 2600, `done:ai-fallback` 3000, `error` 3500).
- Between visible states: dot color/shape and label transition `color`/`border-color`/
  `background-color` over `--dur-1`; the content slot crossfades over `--dur-2`
  (absolute-stacked old/new). Width and height of the pill **never change** (360 × 56 in every
  state). The bubble is the only thing that grows the composition.
- Reduced motion: opacity only, 1ms.

### 2.10 Clicks

- Click on the pill body while recording → `stopDictation`.
- `Esc` cap click → `cancelDictation` (recording, transcribing, cleaning).
- Click on the bubble → copy (§2.7). Click on the pill in done/error: ignored.

---

## 3. Settings window (`index.html`, `src/App.tsx`)

### 3.1 Window and shell

- Default **960 × 700**, min **800 × 580**. Native decorations. Title `VoxFlow`.
- Shell: sidebar **224px**, `--bg-1`, `border-right: 1px solid --line`; content column with
  **32px 40px** padding, content max-width **680px**, left-aligned. Content scrolls; sidebar
  does not.

```
┌────────────────┬──────────────────────────────────────────────────┐
│ VoxFlow        │  General                                   Saved │  ← fs-xl 600 / fs-sm accent
│                │  Dictation hotkey and behaviour.                 │  ← fs-sm text-1
│ 1  General     │                                                  │
│ 2  Transcript. │  ╭ Hotkey ──────────────────────────────────────╮ │  ← Box r-14, bg-1, heading inside
│ 3  Cleanup     │  │ Dictation hotkey       [Ctrl][Shift][Space]  │ │
│ 4  Dictionary  │  │ Paste last transcript  [Alt][Shift][Z]  Off  │ │
│ 5  Playground  │  │ Hotkey mode           ( Hybrid | PTT | Tog.) │ │
│ 6  History     │  ╰──────────────────────────────────────────────╯ │
│ 7  About       │                                                  │
│                │                                                  │
│ ─────────────  │                                                  │
│ [Transcribe    │                                                  │
│  file…]        │                                                  │
│ [Preview       │                                                  │
│  overlay]      │                                                  │
│ ─────────────  │                                                  │
│ ● Idle         │                                                  │
│ Ctrl Shift Spc │                                                  │
└────────────────┴──────────────────────────────────────────────────┘
```

**Sidebar**:

- Wordmark: `VoxFlow` Inter `--fs-md` 600 `--text-0`, 20px inset, 56px tall row, no border
  (the first nav row starts 8px below it). No icon.
- Nav rows: 40px tall, margin `0 12px`, padding `0 12px`, `--r-2`, label Inter `--fs-md` 500
  `--text-1`; left of the label an index `1`…`7` Inter `--fs-xs` 500 `--text-2` in a 24px
  column, tabular. Hover: bg `--bg-2`. Active: **bg `--bg-2`**, label `--text-0`, index
  `--accent`. No left bar (the rounded fill is the marker now). The index doubles as the
  shortcut hint `Ctrl+N`.
- **Tools block** (below nav, above footer, `border-top: 1px solid --line`, padding 12px):
  two full-width secondary buttons stacked, gap 8: `Transcribe file…` and `Preview overlay`
  (behaviour unchanged).
- **Footer** (`border-top: 1px solid --line`, padding 16px 20px): status line Inter `--fs-sm`
  500: 8×8 `--r-full` dot + `Idle` / `Recording` / `Transcribing` / `Cleaning` (dot `--text-2`
  idle, `--accent` recording, ring for transcribing/cleaning), and under it the current hotkey
  as `KeyCombo` xs.

**SectionHeader**: title `--fs-xl` 600 `--text-0` (`tabindex=-1`, focus target), subtitle
`--fs-sm` `--text-1` 4px below, right slot for `Saved` (Inter `--fs-sm` 500 `--accent`, 1.2s,
existing `useSavedFlash`) or the history filter. No bottom border; **28px bottom margin**.

### 3.2 Box and Field

**Box** (`.box`): `--bg-1`, `border: 1px solid --line`, `--r-3`, padding `4px 20px 4px`,
`margin-bottom: 20px`. **Heading** (`.box-heading`, replaces the on-border eyebrow): Inter
`--fs-sm` 500 `--text-2`, sentence case, padding `14px 0 2px`. Keep React names `Card` /
`CardTitle`.

**Field**: horizontal row, label column **240px** (label `--fs-md` 500 `--text-0`, helper
`--fs-sm` `--text-1` 2px under it), control right-aligned with `min-width: 0`, padding
`14px 0`, `border-top: 1px solid --line` between rows (first row none). Disabled: label
`--text-2`, control 50% opacity. Error: message under the control in `--err` `--fs-sm`.
Controls save on change; `Saved` flashes in the header.

### 3.3 General

Boxes and fields (new items marked ★):

| Box | Field | Control | Helper |
| --- | --- | --- | --- |
| Hotkey | Dictation hotkey | `HotkeyRecorder` | `Press the combo you want. Needs at least one non-modifier key.` |
| Hotkey | ★ Paste last transcript | `HotkeyRecorder` with `allowEmpty` (see below) | `Pastes the most recent transcript again, wherever the cursor is.` |
| Hotkey | Hotkey mode | Segmented `Hybrid` / `Push to talk` / `Toggle` | existing per-mode helper |
| Input | Microphone | Select | unchanged |
| Input | Language | Select | unchanged |
| Output | Paste automatically | Toggle | unchanged |
| Output | Restore clipboard | Toggle | unchanged |
| Output | ★ Sound cues | Toggle (`sounds`) | `Short tones when recording starts and stops. Nothing on cancel or error.` |
| Output | Save history | Toggle | unchanged |
| Appearance | Theme | Segmented `System` / `Dark` / `Light` | — |

**HotkeyRecorder** (restyled + `allowEmpty` prop): a 36px-tall `<button>` box, `--r-2`,
`border: 1px solid --line`, bg `--bg-0`, padding `0 10px`, `KeyCombo` inside, right text
`Change` in `--fs-sm` 500 `--accent`. Listening: border `--accent`, caps replaced by `Press
keys…` in `--text-1`, right text `Esc to cancel`. Captured: border flashes `--accent` 600ms.
Invalid: border `--err` + message under the field. With `allowEmpty`: when the value is `""`
the box shows a `Off` badge (muted) and the right text is `Set`; when set, a ghost `Clear`
button (28px, `--fs-sm`) sits **outside** the box to its right and saves `""`. Saving a paste-
last combo equal to the dictation hotkey is rejected with `Same as the dictation hotkey.`

### 3.4 Transcription (unchanged content, new skin)

Segmented `Local` / `Server`. Local: Box `Models` with `ModelRow`s (52px tall, name Inter
`--fs-md` 500, size `--fs-sm` `--text-1`, `EN` badge, status column: `Download` secondary /
progress + `61%` + `Cancel` ghost / `Use` secondary + trash icon / `Active` badge accent). Delete
= inline confirm. Server: Box `Server` with preset Select, Base URL (mono input), Model (mono
input), `ApiKeyField`, `Test connection` + inline result (`Connected · 412 ms` `--accent` /
`Failed: 401` `--err`, both Inter `--fs-sm` 500).

### 3.5 Cleanup (unchanged content, new skin)

Box `Mode`: Segmented `Off` / `Basic` / `AI` with the existing per-mode helper. Box `AI
provider`: Preset Select (Ollama, LM Studio, OpenAI, Groq, OpenRouter, Anthropic, Custom), Base
URL mono, Model mono, `ApiKeyField`, `Test` + inline result. Fields disabled when mode ≠ `ai`.
Helper on the box heading row is a `--fs-sm` `--text-2` line under the heading: `Dictionary
replacements run before cleanup.` with a link-styled `Open dictionary` (`--accent`, goes to
section 4).

### 3.6 Dictionary (new, `src/sections/Dictionary.tsx`) — section 4

Own section, not a box inside Cleanup: it is a list that can hold 200 rows and needs its own
header actions. Title `Dictionary`, subtitle `Words VoxFlow always gets wrong, and what to
write instead. Applied to the raw transcript before cleanup. Whole words, case-insensitive.`

Layout, top to bottom:

1. **Add row** (`.dict-add`): `display: grid; grid-template-columns: 1fr 24px 1fr auto; gap:
   8px; align-items: center`. Input `Heard as` (placeholder `vox flow`), an arrow glyph `→` in
   `--text-2` `--fs-md` centered, Input `Write` (placeholder `VoxFlow`), primary Button `Add`.
   Enter in either input = Add. Both inputs Inter (not mono), 36px, `--r-2`. Disabled Add when
   `from` is empty (trimmed). Validation inline under the row (`--err` `--fs-sm`): `Already in
   the dictionary.` (case-insensitive duplicate `from`), `Dictionary is full (200).`
2. **Count line** right-aligned under the add row: `12 of 200` Inter `--fs-sm` `--text-2`,
   tabular. At ≥ 190 it turns `--err`.
3. **List** (`.dict-list`): a Box (`--bg-1`, `--r-3`) with rows 48px tall, padding `0 16px`,
   hairline dividers. Row: `grid-template-columns: 1fr 24px 1fr 32px`: `from` in Inter
   `--fs-md` `--text-1`, arrow `→` `--text-2`, `to` in Inter `--fs-md` 500 `--text-0`, and an
   icon Button (trash, 28×28, ghost, visible on hover/focus, `aria-label="Remove <from>"`).
   Rows are **editable in place**: clicking `from` or `to` turns it into an Input (same cell,
   no layout shift: the Input is 32px, `--r-1`, bg `--bg-0`); blur or Enter saves, Esc reverts.
   Newest entry first. Delete: row collapses `--dur-3`, no confirm.
4. **Empty state**: icon `Book` 28px `--text-2`, title `No entries yet`, body `Add a word that
   keeps coming out wrong, and what it should be.`

Saving: every add/remove/edit calls `save_settings` with the full `dictionary` array; `Saved`
flashes in the header. `from` is trimmed and stored as typed (matching is case-insensitive in
Rust); `to` may be empty (that means "delete the word").

### 3.7 Playground (unchanged content, new skin) — section 5

Textarea mono `--fs-sm` (13px is the floor for mono; keep it), 140px tall, `--r-2`. Under it,
right-aligned: `Ctrl` `Enter` keycaps + primary `Run`. Two columns 50/50, gap 16, each a Box
with heading `Basic` / `AI`; body Inter `--fs-md` `--text-0`, `pre-wrap`, min-height 96. AI
error: heading `AI · failed` in `--err`, body first line the error in mono `--fs-sm` `--err`,
second `Basic output would be used.` in `--text-1`. Counter under each body `−N words` /
`Edited` / `Unchanged` in `--fs-sm` `--text-2`.

### 3.8 History — section 6

Header right slot: `FilterInput` (260px, placeholder `Filter`, `Ctrl` `F` keycaps inside on
the right when empty, clear ×) and ghost `Clear all`.

`HistoryRow` (list inside a Box, hairline dividers, padding `14px 16px`, hover `--bg-2` with
`--r-2` on the row, focus ring inside):

```
 So I think we should ship it on Friday.                                   2 min ago
 −4 fillers   [Raw]                                          [Copy] [Delete]  (hover/focus)
```

- Line 1: cleaned `text`, Inter `--fs-md` `--text-0`, clamp 2 lines; Enter toggles full text.
- Line 2 (meta row, `--fs-sm` `--text-2`, margin-top 6): removed-count (`−4 fillers` /
  `Edited`, only when `raw` exists) and a `Raw` toggle (ghost xs button, `--r-1`,
  `aria-pressed`) revealing the raw transcript underneath in a `--bg-0` block, `1px solid
  --line`, `--r-2`, mono `--fs-sm` `--text-1`, padding 10px 12px, heading `Raw` `--fs-xs`
  `--text-2`. `R` key on a focused row toggles it.
- Timestamp `--fs-xs` 500 `--text-2`, sentence case: `Just now`, `4 min ago`, `2 h ago`,
  `Yesterday 14:02`, `12 Mar 09:41`; `title` = ISO.
- Actions on hover/focus: `Copy` (label swaps to `Copied` in `--accent` for 1.2s), `Delete`
  (row collapses `--dur-3`). Clear all → `InlineConfirm` under the header.
- Filter: substring, debounce 120ms, matches highlighted with `--accent-soft` bg, `--r-1`.

### 3.9 About — section 7

Definition list (label `--fs-sm` 500 `--text-2` 160px, value Inter `--fs-md` `--text-0`, mono
for paths and model ids): `Version`, `Data folder` (+ ghost `Open folder`), `Models`,
`Cleanup`, `Dictionary` (`12 entries`), `Last error` (mono, wrap, or `None`). Then Box
`Shortcuts` with the key table (§4).

### 3.10 Banner

Top of the content column, `margin-bottom: 20px`. `--r-3`, `border: 1px solid --err`, bg
`--err-soft`, padding `12px 16px`, icon 18px, title `--fs-md` 500, body `--fs-sm` one line
ellipsis, right ghost `Dismiss`. Info variant: `--accent` border, `--accent-soft` bg. Enter:
opacity + `translateY(−4px → 0)` `--dur-3`. Dismiss: opacity `--dur-2`.

---

## 4. Keyboard map

| Keys | Where | Action |
| --- | --- | --- |
| `Ctrl+1` … `Ctrl+7` | window | General / Transcription / Cleanup / Dictionary / Playground / History / About; focus the section title. Update `SECTIONS` and the key check in `App.tsx` to `["1".."7"]`. |
| `Ctrl+F` | window | History + focus filter |
| `Ctrl+W` | window | Hide to tray |
| `Ctrl+Enter` | Playground textarea | Run |
| `Enter` | Dictionary add-row inputs / editing cell | Add / save |
| `Esc` | filter / recorder / inline confirm / expanded row / raw peek / editing cell | clear / abort / cancel / collapse / revert |
| `Enter` / `Space` | history row | toggle expand |
| `R` | focused history row | toggle raw peek |
| `Ctrl+C` / `Delete` | focused history / dictionary row | copy / delete |
| `↑` `↓` `Home` `End` | lists | roving focus |
| `←` `→` | Segmented | change value |

Focus ring, everywhere, only on `:focus-visible`: `outline: 2px solid var(--focus);
outline-offset: 2px; border-radius: inherit` (rounded rings follow rounded controls). Rows and
segmented options use `outline-offset: −2px`. Never `outline: none` without this replacement.

---

## 5. Component inventory

React name → CSS class (kebab). Sizes are fixed; deviation is drift.

| Component | Spec |
| --- | --- |
| `Button` | height **36**, padding `0 14px`, `--r-2`, Inter `--fs-md` 500, min-width 72, gap 8 with icon. `primary`: bg `--accent-fill`, text `--accent-text`, no border; hover `filter: brightness(.94)`; active `.88`. `secondary`: bg `--bg-0` (dark) / `#FFFFFF` (light), border 1px `--line`, text `--text-0`; hover border `--line-strong` bg `--bg-2`. `ghost`: no border, transparent, text `--text-1`; hover text `--text-0` bg `--bg-2`. `danger`: transparent, border 1px `--err`, text `--err`; hover bg `--err` text `#FFFFFF`. `icon`: 28×28 ghost, `--r-1`. `xs`: height 28, padding `0 10px`, `--fs-sm`. Disabled: 45% opacity, no hover. Loading: `Stepper` replaces the icon. Transition `background-color, border-color, color, filter` `--dur-1`. |
| `Input` / `Textarea` | height **36** (textarea auto, min 96), padding `0 12px`, bg `--bg-0` (dark) / `#FFFFFF` (light), border 1px `--line`, `--r-2`, Inter `--fs-md`; `.input--mono` uses mono `--fs-sm`. Hover border `--line-strong`; focus border `--accent` + focus ring; invalid border `--err`; placeholder `--text-2`. |
| `Segmented` | `role=radiogroup`; track bg `--bg-2`, `--r-full`, padding 3px, height **34**; options are 28px buttons, `--r-full`, padding `0 14px`, Inter `--fs-md` 500 `--text-1`, no borders. Selected: bg `--bg-0` (dark) / `#FFFFFF` (light), text `--text-0`, plus `box-shadow: 0 1px 2px rgba(0,0,0,.25)` in dark / `.10` light (allowed: it is the one place a raised chip needs it — implement as `--shadow-chip` token). Hover unselected: text `--text-0`. |
| `Toggle` | `<button role=switch>` **40×22**, `--r-full`, no border. Off: track `--bg-3`, knob 18×18 `--r-full` `--text-1` inset 2px. On: track `--accent-fill`, knob `--accent-text`. Knob slides 18px in `--dur-1 --ease-out`. |
| `Select` | native `<select>`, `appearance: none`, same box as Input, chevron 14px inline SVG at right 12px. |
| `FilterInput` | Input with 14px search icon left (padding-left 34) and clear × button right. |
| `KeyCombo` / key cap | each cap: Inter `--fs-xs` 500, padding `2px 7px`, min-width 24, border 1px `--line-strong`, `--r-1`, bg `--bg-2`, `--text-1`, `line-height: 16px`; gap 4. Labels sentence case: `Ctrl` `Alt` `Shift` `Win` `Space` `Z`. In the pill, the cap uses the §2.2 spec. |
| `Badge` | Inter `--fs-xs` 500, padding `2px 8px`, `--r-1`, bg `--bg-2`, no border. Tones: `accent` (text `--accent`, bg `--accent-soft`), `muted` (`--text-2`), `err` (`--err`, bg `--err-soft`). Labels: `Active`, `EN`, `Off`. |
| `ListRow` (ModelRow, HistoryRow, DictRow) | min-height 52 / 48 / 48, `border-top: 1px solid --line`, hover `--bg-2` with `--r-2`, focus ring inset. |
| `ProgressBar` | 4px track `--line` `--r-full`, fill `--accent` `--r-full`, width transition `--dur-3 linear`; indeterminate = §2.8 sweep at 140px. |
| `Banner` | §3.10 |
| `EmptyState` | centered, 56px top margin, icon 28 `--text-2`, title `--fs-lg` 600, body `--fs-sm` `--text-1`, optional ghost action. |
| `InlineConfirm` | row: text `--fs-md` + `danger` + `ghost` buttons; Esc cancels; first button focused on open. |
| `Skeleton` | `--bg-2` blocks 14px tall `--r-1`, 60%/40%, opacity 1 ↔ .5 `steps(1)` 800ms. |
| `Stepper` (loading) | three 6×6 `--r-full` dots, gap 4, currentColor, opacity sequence every 250ms `steps(1)` (500ms under reduced motion). |
| `Pill` | root of `pill.tsx`; states `recording` (`data-mode`, `data-warmup`), `transcribing`, `cleaning`, `done` (`data-note`), `error`. |
| `TranscriptBubble` | §2.7. Props `{ text, note?: { label, err? }, onCopy, onHoverChange }`. |
| `Waveform` | canvas, §2.6. |
| `WarmupDots` | §2.5, in `pill.tsx` (three spans, CSS animation). |
| `Sweep` | §2.8, used by pill and indeterminate progress. |
| `HotkeyRecorder` | §3.3, adds `allowEmpty?: boolean` and `onClear?`. |
| `ApiKeyField` | none / saving / saved (`•••••••• Saved` Inter `--fs-sm` `--text-1`, `Replace` secondary, `Remove` ghost→err on hover) / replacing / error. |

Transitions only on `background-color, border-color, color, opacity, transform, filter, height,
width`. Never `transition: all`. Every interactive element ≥ 28×28 hit area, rows ≥ 44px.

---

## 6. File boundaries

| File | Owns |
| --- | --- |
| `package.json` | add `@fontsource-variable/inter`; remove `@fontsource/archivo`. |
| `src/main.tsx`, `src/pill.tsx` | font imports: Inter variable in both; `jetbrains-mono/400.css` in `main.tsx` only. |
| `src/styles/tokens.css` | §1 only: both theme blocks, type scale, spacing, radii scale, `--shadow-float`, `--shadow-chip`, motion, reduced-motion overrides. |
| `src/styles/pill.css` | §2 only. Classes: `.pill-root`, `.pill-body[data-state][data-mode][data-warmup]`, `.pill-dot`, `.pill-label`, `.pill-content`, `.pill-note`, `.pill-cap`, `.warmup`, `.warmup-dot`, `.bubble`, `.bubble-text`, `.bubble-footer`, `.bubble-note`, `.bubble-hint`, `.sweep`, `.stepper`. Delete `.pill-row1`, `.pill-row2`, `.pill-snippet`, `.pill-body--tall`, `.pill-mark*`. |
| `src/styles/app.css` | §3–5 settings window. Rename `.box-eyebrow` → `.box-heading`; add `.dict-add`, `.dict-count`, `.dict-list`, `.dict-row`, `.dict-cell`, `.dict-cell--editing`, `.hotkey-recorder--empty`, `.hotkey-recorder-clear`. Remove every `text-transform: uppercase` and `letter-spacing` except on `.badge--en`. |
| `src/pill.tsx` | Pill state machine, timer, warm-up flag (`hasLevel`, set on the first level event, reset on each recording entry), auto-hide with hover-pause and copy-pause, done note (§2.4), renders `TranscriptBubble`. |
| `src/components/TranscriptBubble.tsx` | §2.7. Copy via `api.copyText`. |
| `src/components/Waveform.tsx` | Canvas waveform (§2.6). Props unchanged. |
| `src/components/HotkeyRecorder.tsx` | §3.3 `allowEmpty` + `Clear`. |
| `src/components/ui.tsx` | Everything in §5 except Waveform/Pill/Bubble/HotkeyRecorder. |
| `src/components/icons.tsx` | Inline SVG, 1.75px stroke, **round** caps and joins (`stroke-linecap: round; stroke-linejoin: round`). Add `Book`, `ArrowRight`. |
| `src/sections/General.tsx` | §3.3: paste-last recorder, sound cues toggle. |
| `src/sections/Dictionary.tsx` | §3.6. |
| `src/sections/Cleanup.tsx` | §3.5 heading helper + `Open dictionary` link. |
| `src/sections/About.tsx` | §3.9 `Dictionary` row. |
| `src/App.tsx` | seven sections, `Ctrl+1..7`, section order General, Transcription, Cleanup, Dictionary, Playground, History, About. |
| `src/lib/ipc.ts` | schema additions: `pasteLastHotkey: string`, `dictionary: {from,to}[]`, `sounds: boolean`. |
| `src-tauri/tauri.conf.json`, `src-tauri/src/dictation.rs` | pill window 440 × 220; position rule §2.1. |

Demo: keep the `?state=` support in `pill.tsx` and add `?state=recording&warmup=1` (never
receives a level), `?state=done&long=1` (a 6-line sample text to verify the 4-line clamp),
`?state=done&flash=1` (text, no raw: the paste-last flash). The `?demo=1` loop feeds real
levels from the bundled clip via the existing mock path (docs/ASSETS.md).

---

## 7. Drift checklist (verify against screenshots)

1. Body text in the settings window is 15px Inter; nothing below 12px; no uppercase or
   letter-spaced labels anywhere except the `EN` badge; no Archivo, no condensed type.
2. The pill is a full-radius capsule 360 × 56 in every state (it never grows), opaque
   `#161618` dark / `#FFFFFF` light, 1px edge, one soft shadow beneath it.
3. Pill label text is 16px Inter 500 and readable from arm's length: `Listening…`, `00:04`,
   `Transcribing…`, `Cleaning up…`, `Pasted`, `Copied`, `Error`.
4. Recording before audio: three pulsing dots and `Listening…`; the moment audio arrives the
   dots crossfade into the waveform and the label becomes the timer.
5. Waveform: 3px rounded bars, 2px gaps, ~42 bars, mirrored around the center, 4px dots in
   silence, bars slide continuously left; speech clearly moves it (peaks reach 20–28px), pauses
   decay in ~100ms, it is unmistakably live audio.
6. Push-to-talk dot pulses softly (no hard blink); hands-free dot is steady.
7. Transcribing/cleaning: hollow accent ring, sentence-case label, 48px accent segment on a
   4px rounded track.
8. Done: a rounded bubble (r=18, same surface and shadow as the pill) floats 10px above the
   pill, centered, ≤ 400px wide, transcript at 16px wrapping to ≤ 4 lines with an ellipsis,
   footer `−N fillers` left and `Click to copy` right; it pops in with a small overshoot 60ms
   after the pill turns `Pasted`.
9. Hovering the bubble keeps it on screen; clicking it copies and both the footer and the
   pill label read `Copied` for a second.
10. Paste-last flash shows the bubble with the text and no fillers note.
11. Error: red dot, `Error`, message in 15px, `Open VoxFlow` at the right; gone after 3.5s.
12. Pill window is 440 × 220 with nothing visible outside the capsule and bubble; the pill
    bottom sits 24px above the taskbar.
13. Settings sidebar: `VoxFlow` wordmark in sentence case, numbered nav 1–7 with rounded
    `--bg-2` active fill and lime index, tools block, footer status `Idle` with a round dot.
14. Boxes are `--bg-1` cards with r=14, a 13px muted heading inside (not on the border), and
    hairline field dividers; buttons/inputs are 36px tall with r=10; toggles are 40×22 pills;
    the segmented control is a pill track with a raised selected chip.
15. General shows `Paste last transcript` with `Alt` `Shift` `Z` caps and a `Clear` button
    (or `Off` badge + `Set` when cleared), and a `Sound cues` toggle under Output.
16. Dictionary is section 4 (Ctrl+4): add row `Heard as → Write [Add]`, `N of 200` counter,
    editable rows with a trash icon on hover, empty state with `No entries yet`.
17. Cleanup shows `Dictionary replacements run before cleanup. Open dictionary` under the AI
    provider heading.
18. Light theme: white surfaces, `#3E6B00` accent for text/ring, lime fills with black text,
    the pill and bubble are white with a `#DCDCE0` edge and a lighter shadow.
19. Fonts render as Inter and JetBrains Mono with the network disabled; Segoe UI Variable is
    the fallback if the bundled font fails to load.
20. With `prefers-reduced-motion`: pill and bubble only fade, no pulse on the dot or warm-up
    dots, the sweep is a stepping 3-dot indicator, the waveform jumps per sample but still
    reflects audio.
