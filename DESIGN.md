# VoxFlow — Design Brief

Audience: the implementer. Plain CSS + custom properties, no Tailwind, no UI kit. Everything
here is a decision, not a suggestion; if something is missing, pick the boring option that
matches the tokens below.

Identity in one line: **a small piece of studio hardware.** Warm graphite surfaces, a single amber
"signal" accent, coral for recording, mono type for anything the keyboard touches. Calm at rest,
alive only while you speak.

---

## 1. Visual identity

### 1.1 Name treatment

- Wordmark: `VoxFlow` in IBM Plex Sans 600, letter-spacing `-0.01em`, no icon inside the
  wordmark. In the sidebar it sits next to the app icon (20px) at 15px size.
- Never split into "Vox" + "Flow" colors. Never a gradient.

### 1.2 Typography (bundled, offline)

| Role | Family | Weights | Package |
| --- | --- | --- | --- |
| UI text | IBM Plex Sans | 400, 500, 600 | `@fontsource/ibm-plex-sans` (import 400/500/600 css files only) |
| Keys, paths, sizes, timestamps, model names | IBM Plex Mono | 400, 500 | `@fontsource/ibm-plex-mono` |

Fallback stack: `"IBM Plex Sans", "Segoe UI Variable", "Segoe UI", system-ui, sans-serif` and
`"IBM Plex Mono", Consolas, "DejaVu Sans Mono", monospace`. Import the fontsource CSS in the app
entry so Vite bundles the woff2 files; no runtime network.

Type scale (px / line-height / weight):

| Token | Size | LH | Weight | Use |
| --- | --- | --- | --- | --- |
| `--fs-xs` | 11 | 16 | 500 | badges, key caps, eyebrow labels |
| `--fs-sm` | 12.5 | 18 | 400 | helper copy, timestamps, table meta |
| `--fs-md` | 14 | 20 | 400 | body, inputs, buttons, nav |
| `--fs-lg` | 16 | 22 | 600 | card/field group titles |
| `--fs-xl` | 20 | 26 | 600 | section header (page title) |

Pill uses `--fs-md` 500 for status text, `--fs-xs` mono for the hint.

### 1.3 Color tokens

Dark is the default identity; light is a true equivalent, not an afterthought. `data-theme`
attribute on `<html>`: `dark` | `light`; `system` resolves via `prefers-color-scheme` in JS and
sets the attribute (both windows).

| Token | Dark | Light | Role |
| --- | --- | --- | --- |
| `--bg-0` | `#151412` | `#F3F0EA` | window background |
| `--bg-1` | `#1D1B18` | `#FBFAF7` | sidebar, cards, inputs at rest |
| `--bg-2` | `#26231F` | `#ECE8E1` | hover, selected row, segmented track |
| `--bg-3` | `#312D27` | `#E0DBD2` | active/pressed, key caps |
| `--text-0` | `#F2EDE4` | `#1C1A17` | primary text |
| `--text-1` | `#B3ACA0` | `#5D584F` | secondary / helper |
| `--text-2` | `#7A736A` | `#8C857A` | placeholder, disabled, meta |
| `--border` | `#332F29` | `#D9D3C8` | hairlines, input borders |
| `--border-strong` | `#4A443C` | `#B9B2A5` | hover borders, dividers on bg-2 |
| `--accent` | `#E2A63A` | `#B8741A` | amber signal: primary button, active nav, links |
| `--accent-text` | `#1A1408` | `#FFFFFF` | text on `--accent` |
| `--accent-soft` | `rgba(226,166,58,.14)` | `rgba(184,116,26,.12)` | selected-row tint, badges |
| `--rec` | `#F06A5A` | `#D64B3B` | recording dot, waveform bars, stop hover |
| `--rec-soft` | `rgba(240,106,90,.18)` | `rgba(214,75,59,.14)` | rec halo |
| `--ok` | `#6FBF8A` | `#2E8B57` | success, "Pasted", downloaded check |
| `--err` | `#E5655A` | `#C0392B` | errors, destructive |
| `--err-soft` | `rgba(229,101,90,.14)` | `rgba(192,57,43,.10)` | error banner bg |
| `--focus` | `#7CC4FF` | `#1A73E8` | focus ring (cool blue on purpose: never confused with amber/coral) |
| `--pill-bg` | `rgba(24,22,19,.92)` | `rgba(251,250,247,.94)` | pill surface (blur behind if available) |
| `--pill-border` | `rgba(255,255,255,.10)` | `rgba(0,0,0,.10)` | pill hairline |

Contrast: `--text-0`/`--bg-0` ≥ 12:1 both themes; `--text-1`/`--bg-1` ≥ 5:1; `--accent-text` on
`--accent` ≥ 7:1. `--text-2` is decorative-only (never sole carrier of information).

### 1.4 Spacing, radii, shadows

- Spacing scale (`--sp-*`): 2, 4, 8, 12, 16, 24, 32, 48. Content grid uses 8; inline gaps 4/8/12.
- Radii: `--r-sm` 4 (key caps, badges), `--r-md` 8 (inputs, buttons, rows), `--r-lg` 12 (cards,
  banners), `--r-pill` 999.
- Shadows (dark / light):
  - `--sh-1` `0 1px 2px rgba(0,0,0,.4)` / `0 1px 2px rgba(0,0,0,.08)` — buttons, inputs focus
  - `--sh-2` `0 8px 24px rgba(0,0,0,.45)` / `0 8px 24px rgba(0,0,0,.12)` — popovers, confirm dialogs
  - `--sh-pill` `0 10px 30px rgba(0,0,0,.55), 0 0 0 1px var(--pill-border)` / `0 10px 30px rgba(0,0,0,.18), 0 0 0 1px var(--pill-border)`

### 1.5 Motion

| Token | Value | Use |
| --- | --- | --- |
| `--dur-fast` | 120ms | hover, focus, toggle knob |
| `--dur-base` | 200ms | pill show/hide, section switch, banner |
| `--dur-slow` | 320ms | progress bar width, done-state settle |
| `--ease-out` | `cubic-bezier(.2,.8,.2,1)` | entrances |
| `--ease-in` | `cubic-bezier(.4,0,1,1)` | exits |
| `--ease-std` | `cubic-bezier(.4,0,.2,1)` | everything else |

Reduced motion (`prefers-reduced-motion: reduce`): all durations become 1ms, the pill fades only
(no translate), the waveform still animates (it is information, not decoration) but bars change
height without transition, the transcribing shimmer becomes a static three-dot "…" that swaps
opacity every 500ms, and spinners stop rotating (show a static ring at 25% arc).

---

## 2. The pill overlay (`pill.html`)

### 2.1 Window

- Logical size **360 × 104**. Pill body is **300 × 56** centered; the remaining 30px sides / 24px
  top+bottom are transparent margin for `--sh-pill`.
- `html, body { background: transparent; margin: 0; overflow: hidden; }` (WebView2 flash fix).
- Placement: horizontally centered on the primary monitor; bottom edge of the *pill body* 24px
  above the monitor work area (above the taskbar). If work area is unavailable, 72px above the
  monitor bottom. Recompute on every show (monitor may change).
- Window is `transparent / undecorated / always-on-top / skip-taskbar / non-focusable`. It is NOT
  click-through: clicks arrive without focusing.
- Cursor over the pill body: `default`; over buttons: `pointer`. User-select none everywhere.

### 2.2 Layout

```
 ┌──────────────────────────────────────────────────────┐  56px, radius 999
 │ ●  ▁▂▃▅▇▅▃▂▁▂▃▅▆▅▃▂▁▂▃▄▃▂   Esc to cancel        ✕  │
 └──────────────────────────────────────────────────────┘
   │  │ waveform 118px            │ hint (mono xs)  │ 32px hit
   16 12                          12                12
```

Left cluster (16px inset): status glyph 10px. Middle: content zone (waveform / spinner / text).
Right: mono hint text in `--text-1`, then optional 32×32 cancel button (icon 14px "×"), 12px inset.

### 2.3 States

| State | Glyph | Content zone | Hint | Right button | Auto-hide |
| --- | --- | --- | --- | --- | --- |
| hidden | — | — | — | — | — |
| recording (push-to-talk, key held) | solid `--rec` dot 10px with `--rec-soft` 6px halo, halo pulses 1.6s | Waveform | `release to stop` | ✕ cancel | no |
| recording (hands-free / toggle) | same dot, no pulse (steady) | Waveform | `Esc to cancel` | ✕ cancel | no |
| transcribing | 10px ring spinner in `--accent` (1px stroke, 0.9s linear) | text `Transcribing…` in `--text-0` 500 + shimmer sweep | `Esc to cancel` | ✕ cancel | no |
| done: pasted | check-circle 14px in `--ok` | `Pasted` | — | — | 900ms |
| done: copied | clipboard icon 14px in `--ok` | `Copied to clipboard` | — | — | 1400ms |
| error | alert-circle 14px in `--err` | error text, ≤ 36 chars, one line, ellipsis; `--text-0` | `details in VoxFlow` | — | 3000ms |

Mode difference is only the hint text and the halo pulse. Hybrid mode: pill opens as
push-to-talk visuals; when the backend reports the hold turned into a tap (≥350ms not held), the
hint swaps to `Esc to cancel` and the pulse stops. Backend drives this via `dictation://state`
plus a `mode` hint field if available; otherwise the pill infers from time-since-press.

Recording duration: not shown. Keep the pill quiet.

### 2.4 Waveform (recording)

- 24 bars, 3px wide, 2px gap, `--r-sm` on bar ends, `--rec` color, container 118 × 28.
- Rolling history, newest at the **right**. Every `dictation://level` event (~30 Hz): shift the
  array left, push the new value. Not mirrored, not symmetric — it reads like tape passing.
- Smoothing before push: `v = max(level, prev * 0.82)` (instant attack, ~6-frame decay).
- Height mapping: `h = 4 + 24 * sqrt(clamp(v, 0, 1))` px. Bars are vertically centered. Silence
  shows a flat row of 4px dots, which is the "listening" affordance.
- Bars have `transition: height 60ms linear` (none under reduced motion). Rendering via 24 divs
  is fine; no canvas needed.
- Older bars fade: opacity from 1.0 at the right to 0.35 at the left (linear across bars).

Transcribing transition: bars ease to 4px over `--dur-base`, then the content zone crossfades to
the `Transcribing…` text with a left→right shimmer (`--text-0` → `--accent` → `--text-0`, 1.4s
loop, background-clip text).

### 2.5 Transitions

- hidden → recording: window shown at final position; body animates `opacity 0→1` and
  `translateY(8px→0)` over `--dur-base --ease-out`.
- → hidden: `opacity 1→0`, `translateY(0→6px)`, `--dur-base --ease-in`, then hide the window.
- Between visible states: content zone crossfade 120ms; the pill width stays 300 (no resize
  animations).

### 2.6 Clicks

- Click anywhere on the pill body while **recording** = stop (same as hotkey stop).
- ✕ button = cancel (recording or transcribing). Hover: `--bg-3` circle, icon `--text-0`.
- Done/error states: clicks ignored.

### 2.7 Accessibility

The pill is non-focusable, but the content zone is `role="status" aria-live="polite"` so screen
readers announce `Recording`, `Transcribing`, `Pasted`, and errors. Never rely on color alone:
each state has a glyph and text.

---

## 3. Main settings window

### 3.1 Window

- Default **880 × 620**, min **720 × 480**. Native decorations (see §5). Title: `VoxFlow`.
- Layout: left **Sidebar** 208px fixed, right content column with 32px padding, content
  max-width 600px (left-aligned, not centered).

```
┌────────────┬──────────────────────────────────────────┐
│ ◉ VoxFlow  │  General                                 │  ← SectionHeader (xl)
│            │  Dictation hotkey and behaviour.         │  ← text-1 sm
│ General  ⌃1│ ──────────────────────────────────────── │
│ Transcr. ⌃2│  [Banner: last error]  (only if present) │
│ History  ⌃3│                                          │
│ About    ⌃4│  Field  Field  Field …                   │
│            │                                          │
│ ● Idle     │                                          │
└────────────┴──────────────────────────────────────────┘
```

Sidebar: `--bg-1` with right `--border`. Nav rows 36px tall, radius `--r-md`, label `--fs-md`
500, right-aligned `KeyCombo` (`Ctrl 1`) in `--text-2` shown always (this is the keyboard app;
we advertise it). Active row: `--accent-soft` bg, `--accent` 3px left bar, label `--text-0`.
Hover: `--bg-2`. Footer: status dot (`--text-2` idle, `--rec` recording, `--accent` transcribing)
+ label, plus the current hotkey as `KeyCombo` underneath (`Ctrl Shift Space`).

Content area scrolls independently; sidebar does not.

### 3.2 Field pattern

Every setting is a **Field**: horizontal row, label column 220px (label `--fs-md` 500 `--text-0`,
helper `--fs-sm` `--text-1` underneath), control on the right, row padding 12px 0, hairline
`--border` between rows. Fields group into a **Card** (`--bg-1`, `--border`, `--r-lg`, padding
4px 16px) with an optional **CardTitle** (`--fs-lg`) above.

Controls save immediately on change (no Save button). A 1.2s transient `Saved` in `--ok` `--fs-sm`
appears right of the section header when a save round-trips. Failed save → Banner (error).

### 3.3 General

| Field | Control | Helper copy |
| --- | --- | --- |
| Dictation hotkey | HotkeyRecorder | `Press the combo you want. Needs at least one non-modifier key.` |
| Hotkey mode | Segmented: `Hybrid` / `Push to talk` / `Toggle` | Hybrid: `Hold to talk, or tap to start and tap again to stop.` PTT: `Recording stops when you release the keys.` Toggle: `Press once to start, again to stop.` (helper changes with selection) |
| Microphone | Select: `System default` + device names | `Devices are listed when the app starts. Plug in, then reopen this window.` |
| Language | Select: `Auto-detect` + list of ~20 common languages `English (en)` … | `Auto-detect works well for local models. Server models may need a fixed language.` |
| Paste automatically | Toggle | `Types Ctrl+V into the focused app after transcribing. Off: text is only copied.` |
| Restore clipboard | Toggle (disabled when Paste automatically is off) | `Put your previous clipboard back after pasting.` |
| Save history | Toggle | `Keep the last 200 transcriptions on this device.` |
| Theme | Segmented: `System` / `Dark` / `Light` | — |

Card titles: `Hotkey` (first two), `Input` (mic, language), `Output` (paste, restore, history),
`Appearance` (theme).

### 3.4 HotkeyRecorder (detailed)

Rendered as a 36px-tall button-like box, mono, showing the current combo as **KeyCombo** caps
(`Ctrl` `Shift` `Space`, each cap `--bg-3`, `--r-sm`, 1px `--border-strong` bottom edge 2px for a
"key" feel, `--fs-xs` 500). Right side: a `Change` text button.

States:

| State | Visual | Behaviour |
| --- | --- | --- |
| idle | caps + `Change` | Click box, `Change`, or Enter/Space when focused → listening |
| listening | box border `--accent`, 2px `--accent-soft` outer ring; caps replaced by `Press keys…` in `--text-1` italic; `Change` becomes `Esc to cancel` | Captures the first keydown that includes a non-modifier key. Modifier-only keydowns render live as greyed caps (`Ctrl` `Shift` `…`) so the user sees progress. Esc aborts (restores previous combo). Blur aborts. |
| captured | caps update, border flashes `--ok` for 600ms, helper shows `Saved` | Backend re-registers; on failure → invalid state with backend message |
| invalid | border `--err`, message under the box in `--err` `--fs-sm`: `Needs a non-modifier key, e.g. Ctrl+Shift+Space.` or backend text (`That combo is already in use.`) | Stays listening for another 5s, then reverts to idle with the old combo |

Caps order: `Ctrl` `Alt` `Shift` `Win` then the key (`Space`, `F9`, `A`…). Display `Win` on
Windows, `Super` on Linux.

### 3.5 Transcription

Top: Segmented `Local` / `Server` (label `Backend`). Below it, only the active panel.

**Local panel** — Card titled `Models`, helper `Downloaded to <data dir>/models. Larger is
more accurate and slower.` Then a list of **ModelRow** (no card padding, rows are 52px):

```
 ○  base.en   [English only]   142 MB          [Download]
 ●  base                       142 MB          [Active ✓]
 ○  small     [English only]   466 MB   ▓▓▓▓░░ 61%   [Cancel]
 ○  medium                     1.5 GB          [Use]  [🗑]
```

- Left: radio-style dot (`--accent` filled when active; `--text-2` hollow when downloaded but not
  active; hidden when not downloaded).
- Name in mono `--fs-md` 500. Badge `English only` (`--fs-xs`, `--accent-soft` bg, `--accent`
  text, `--r-sm`) for `.en` models. Size in mono `--text-1` right-aligned in a 72px column.
- Status column (right, 200px):
  - not downloaded → secondary Button `Download`
  - downloading → ProgressBar (120px, 4px, `--accent` on `--bg-3`) + `61%` mono + ghost `Cancel`
  - downloaded, not active → secondary `Use` + icon-button trash
  - active → `Active` badge in `--ok-soft`-like (`rgba(111,191,138,.16)`) with check, no delete
- Delete: inline confirm replaces the status column: `Delete 466 MB?  [Delete] [Keep]`, Delete is
  danger variant; Esc = Keep. No modal.
- Download error → row helper line in `--err`: `Download failed: <short reason>. [Retry]`.
- If backend is Local and no model is downloaded: row list shows normally plus a **Banner** (info
  variant, `--accent-soft`): `Pick a model to download. base is a good start.`

**Server panel** — Card `Server`:

| Field | Control | Notes |
| --- | --- | --- |
| Preset | Segmented `OpenAI` / `Groq` / `Local server` / `Custom` | Choosing a preset fills URL + model; editing either field switches Preset to `Custom` |
| Base URL | Input (mono) placeholder `https://api.openai.com/v1` | validate `http(s)://` on blur; error under field |
| Model | Input (mono) placeholder `whisper-1` | — |
| API key | ApiKeyField | see below |
| — | Button `Test connection` + inline result | result right of the button: spinner `Testing…` → `Connected (412 ms)` in `--ok` or `Failed: 401 Unauthorized` in `--err`, truncated to one line, full text on hover title |

ApiKeyField states:
- none: password input placeholder `sk-…`, `Save` primary button (disabled while empty). Enter saves.
- saved: input replaced by a static box `•••••••• Saved ✓` (`--ok` check), buttons `Replace`
  (secondary) and `Remove` (ghost, `--err` on hover). `Replace` returns to the input state with
  focus; Esc returns to saved.
- helper: `Stored in the system keyring, never in files or logs.`

### 3.6 History

Header row: SectionHeader `History` + right-aligned FilterInput (search icon, placeholder
`Filter… (Ctrl+F)`, 240px, clear-× when non-empty) and ghost `Clear all`.

**HistoryRow** (list, no card, rows separated by hairline, padding 12px 8px, radius `--r-md` on
hover `--bg-2`):

```
 The quick brown fox jumped over the lazy dog and kept going for…      2 min ago
                                                             [Copy] [🗑]  (hover/focus only)
```

- Text: `--fs-md` `--text-0`, clamp 2 lines, full text on expand (Enter toggles expand; expanded
  rows show full text in a `--bg-1` block).
- Timestamp mono `--fs-sm` `--text-2`: `just now`, `4 min ago`, `2 h ago`, `Yesterday 14:02`,
  `12 Mar 09:41`. Title attribute has the full ISO date.
- Actions: icon buttons appear on hover or when the row has focus. Copy → button label swaps to
  `Copied` in `--ok` for 1.2s. Delete → row fades out (`--dur-base`), no confirm.
- Clear all → inline confirm bar under the header: `Delete all 47 entries? This cannot be undone.
  [Delete all] [Cancel]`. Delete all is danger. Esc cancels.
- Filter: case-insensitive substring, applied on input (debounce 120ms), matches highlighted
  with `--accent-soft` background.

Empty states (icon 32px `--text-2`, title `--fs-lg`, body `--fs-sm` `--text-1`, centered, 64px top):
- no history: `Nothing yet` / `Press Ctrl+Shift+Space anywhere and start talking.` (uses the real
  hotkey)
- filter no match: `No matches` / `Try a shorter word.`
- history disabled: `History is off` / `Turn on "Save history" in General to keep transcriptions.`
  with a link-button to General.

Loading: 4 skeleton rows (`--bg-2` blocks, 60%/40% widths, shimmer 1.2s) for the first load only.

### 3.7 About

Card-less, two-column definition list (`--text-1` label 160px, value `--text-0`, mono for values):

- `Version` `0.1.0`
- `Data folder` `C:\Users\…\voxflow` + ghost `Open folder`
- `Models` `3 downloaded · 1.9 GB`
- `Last error` full message of the most recent error, mono, wrap, or `None` — this is the
  "details in VoxFlow" landing spot

Then CardTitle `Shortcuts` with a two-column key table (KeyCombo caps left, description right):

```
 Ctrl Shift Space   Start / stop dictation (anywhere)     ← reflects current hotkey
 Esc                Cancel while recording or transcribing (anywhere)
 Ctrl 1 … Ctrl 4    Switch section
 Ctrl F             Filter history
 Ctrl W             Hide window to tray
 Enter              Expand history row / activate control
 Delete             Delete focused history row
```

### 3.8 Banner (last error)

Sits at the top of the content column, above fields, every section, while the last error is
unacknowledged. `--err-soft` bg, `--err` left bar 3px, `--r-lg`, padding 12px 16px. Icon
alert-circle 16px, title `--fs-md` 500 (`Transcription failed`), body `--fs-sm` (short message,
one line, ellipsis; full in About), right: ghost `Dismiss` (×). Info variant uses
`--accent-soft` / `--accent`. Enters with `--dur-base` fade+slide 4px; dismiss fades.

---

## 4. Keyboard map

| Keys | Where | Action |
| --- | --- | --- |
| `Ctrl+1` … `Ctrl+4` | window | Go to General / Transcription / History / About; focus moves to the section header (tabindex -1) |
| `Ctrl+F` | window | Go to History and focus the filter input, selecting its text |
| `Ctrl+W` | window | Hide to tray (same as close) |
| `Esc` | filter input | Clear filter; if already empty, blur |
| `Esc` | HotkeyRecorder listening | Abort capture |
| `Esc` | inline confirm (delete model / clear all / replace key) | Cancel confirm |
| `Esc` | expanded history row | Collapse |
| `Enter` / `Space` | history row | Toggle expand |
| `Ctrl+C` | focused history row | Copy that entry (shows `Copied`) |
| `Delete` | focused history row | Delete entry |
| `↑` / `↓` | history list, model list | Move focus between rows (roving tabindex; Home/End too) |
| `←` / `→` | Segmented | Change value (radio-group semantics) |
| `Tab` | everywhere | Native order |

Focus order per section: sidebar nav (one tab stop, arrow keys move inside) → banner dismiss →
fields top-to-bottom → in History: filter → Clear all → rows. Lists are single tab stops.

Focus-visible: `outline: 2px solid var(--focus); outline-offset: 2px; border-radius: inherit`.
Only on `:focus-visible`, never on mouse focus. Rows use `outline-offset: -2px` so the ring stays
inside the scroll container.

---

## 5. Title bar

**Native decorations.** Reasons: Win11 snap layouts, Aero shake, drag/resize and the close
button behave without custom drag regions; Linux WMs vary wildly; this is a tray utility opened
for a minute, not a brand surface. The window close button hides to tray (spec). Set the
title-bar theme to follow `data-theme` where Tauri exposes it (`theme` on the window), otherwise
accept the OS default.

---

## 6. Tray and icons

Tray menu (top to bottom):

1. `Open VoxFlow` (bold/default item)
2. separator
3. `Start dictation` — becomes `Stop dictation` while recording, `Cancel transcription` while transcribing
4. `Copy last transcription` — disabled when history is empty
5. separator
6. `Quit VoxFlow`

Tray icon: a 16px glyph, monochrome for Windows (white on dark taskbar via template-style
rendering; ship a light and a dark PNG and pick by system theme). Glyph: **five vertical bars**
of heights 6/10/14/10/6 px (1.5px wide, rounded ends, 1px gaps) — the same silhouette as the pill
waveform, centered. Recording variant: same bars in `--rec` coral, plus a 4px filled dot at the
top-right corner. Transcribing: bars in amber. Swap the tray icon on state change; if theming per
state is unreliable on a platform, fall back to the idle icon and rely on the menu label.

App icon (SVG, 1024 viewBox, must survive at 16px): rounded square (radius 22%) filled
`#1D1B18`, a 1px inner hairline `rgba(255,255,255,.08)`, and the five-bar waveform in `#E2A63A`
amber occupying 56% width and 48% height, centered, bar width 9%, gap 4%, corner radius = bar
width. No text, no mic silhouette, no gradient. Light-mode variant not needed (icon has its own
background).

---

## 7. Component inventory

Naming is the React component name; CSS class is the kebab form (`.hotkey-recorder`). States
are the `data-state` / modifier classes to implement.

| Component | Purpose | States / variants |
| --- | --- | --- |
| `Sidebar` | nav + wordmark + status footer | items: idle, hover, active, focus-visible; footer status: idle/recording/transcribing |
| `SectionHeader` | title + subtitle + right slot (`Saved`, filter) | with/without right slot |
| `Card`, `CardTitle` | grouping | — |
| `Field` | label + helper + control row | default, disabled (label `--text-2`, control 50% opacity), error (message in `--err`) |
| `Button` | actions | variants: `primary` (accent bg, accent-text), `secondary` (`--bg-2` bg, `--border`, text-0), `ghost` (transparent, text-1, hover bg-2), `danger` (err bg, white text), `icon` (32×32, ghost). States: hover, active (`--bg-3` / darken 6%), disabled (50% opacity, no hover), loading (spinner 14px replaces icon, label stays). Height 32, padding 0 12, `--r-md`, `--fs-md` 500 |
| `Toggle` | boolean | off (track `--bg-3`, knob `--text-1`), on (track `--accent`, knob `--accent-text`), disabled, focus-visible. 36×20, knob 16, slide 120ms |
| `Segmented` | 2–4 exclusive options | option: idle, hover, selected (`--bg-1` card on `--bg-2` track with `--sh-1`, text-0 500), focus-visible on the group; arrows move selection |
| `Select` | native `<select>` styled | idle, hover (`--border-strong`), focus, disabled. Chevron icon 14px absolutely positioned, `appearance: none` |
| `Input` | text/password/url | idle, hover, focus (border `--accent`, ring `--accent-soft` 3px), invalid (border `--err`), disabled, mono variant |
| `FilterInput` | search input with clear | empty, filled (× visible), focus |
| `KeyCombo` | row of key caps | size: xs (sidebar), md (recorder/About); tone: default, muted (`--text-2` caps for listening preview) |
| `HotkeyRecorder` | capture a combo | idle, listening, captured, invalid (§3.4) |
| `ApiKeyField` | write-only secret | none, saving, saved, replacing, error |
| `ModelRow` | catalog entry | not-downloaded, downloading (progress), downloaded, active, confirm-delete, error |
| `ProgressBar` | determinate 4px | value 0–100, indeterminate (sliding 30% chunk, 1.2s) |
| `HistoryRow` | one transcription | idle, hover, focus, expanded, copied, deleting |
| `InlineConfirm` | destructive confirm in place | default; Esc cancels; first button gets focus on open |
| `Banner` | persistent notice | `error`, `info`; dismissible |
| `EmptyState` | icon + title + body + optional action | — |
| `Skeleton` | loading rows | — |
| `Spinner` | 14/10px ring | default; reduced-motion static |
| `Badge` | small label | `accent` (English only), `ok` (Active), `muted` |
| `Pill` | overlay root (pill window) | hidden, recording-ptt, recording-free, transcribing, done-pasted, done-copied, error |
| `Waveform` | 24-bar history | live, collapsing |

All interactive elements: min hit size 32×32 (icon buttons), 36px tall rows; text buttons min
width 64. Transitions only on `background-color, border-color, color, opacity, transform,
height` (never `all`).

---

## 8. Accessibility

- Contrast: body text ≥ 7:1, secondary ≥ 4.5:1, UI borders ≥ 3:1 against their surface, in both
  themes (tokens above are chosen for this; keep them).
- Focus ring on `:focus-visible` everywhere, including rows, segmented groups and toggles; never
  `outline: none` without a replacement.
- Toggle = `<button role="switch" aria-checked>`; Segmented = `role="radiogroup"` with radios;
  HotkeyRecorder = button with `aria-live="polite"` message region for `Press keys…` / errors;
  ProgressBar = `role="progressbar"` with `aria-valuenow`; Banner error = `role="alert"`; lists
  use `role="list"` / `listitem` with roving tabindex.
- Pill: `role="status" aria-live="polite"` content (§2.7). No focus, so no traps.
- Hit sizes: icon buttons 32×32, toggles 36×20 with 8px padded hit area, rows 36px+.
- Every icon-only button has `aria-label` (`Copy`, `Delete`, `Cancel download`, `Dismiss`).
- Never color-only: recording dot + text, badges have text, progress has a percentage.
- Text scales with OS font size (use rem for font sizes; layout widths in px are fine).
