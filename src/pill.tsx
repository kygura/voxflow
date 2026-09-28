import "@fontsource-variable/inter/index.css";
import "./styles/tokens.css";
import "./styles/pill.css";

import React, { useCallback, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import { api, events, isTauri } from "./lib/api";
import type { DictationStateEvent, DictationStateName } from "./lib/ipc";
import { forceDictationState, startDemoLoop } from "./lib/mock";
import { Waveform } from "./components/Waveform";
import { TranscriptBubble } from "./components/TranscriptBubble";
import { Sweep } from "./components/ui";
import { applyTheme } from "./lib/theme";
import { diffLabel } from "./lib/text";

// DESIGN.md §2.3/§2.9 auto-hide durations, keyed by state + done/error variant.
const AUTO_HIDE_MS: Record<string, number> = {
  "done:pasted": 2200,
  "done:copied": 2600,
  "done:ai-fallback": 3000,
  error: 3500,
};

function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/** DESIGN.md §2.4/§2.7 — removed-count note computed from raw vs cleaned text.
 * Returns null for the paste-last flash (no `raw`) unless it's an AI-fallback note. */
function doneNote(
  raw: string | undefined,
  text: string | undefined,
  message: string | undefined,
): { label: string; err?: boolean } | null {
  if (message?.includes("AI cleanup failed")) return { label: "AI failed · basic", err: true };
  if (!raw) return null;
  const label = diffLabel(raw, text ?? "", "fillers");
  return label ? { label } : null;
}

function ellipsize(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + "…" : s;
}

function formatTimer(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function Pill() {
  const [state, setState] = useState<DictationStateName>("idle");
  const [message, setMessage] = useState<string | undefined>();
  const [text, setText] = useState<string | undefined>();
  const [raw, setRaw] = useState<string | undefined>();
  const [mode, setMode] = useState<DictationStateEvent["mode"]>();
  const [visible, setVisible] = useState(false);
  const [hiding, setHiding] = useState(false);
  const [hasLevel, setHasLevel] = useState(false);
  const [copyFlash, setCopyFlash] = useState(false);
  const [timerText, setTimerText] = useState("00:00");
  const levelRef = useRef(0);
  const hasLevelRef = useRef(false);
  const recordingStart = useRef<number | null>(null);
  const reducedMotion = useReducedMotion();

  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideDeadline = useRef(0);
  const copyFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Schedules the pill+bubble fade-out `ms` from now. */
  const scheduleHide = useCallback((ms: number) => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideDeadline.current = Date.now() + ms;
    hideTimer.current = setTimeout(() => {
      setHiding(true);
      setTimeout(() => setVisible(false), 200);
    }, ms);
  }, []);

  /** Cancels the pending auto-hide without touching `hideDeadline` (so the
   * remaining time can still be read for a click-to-copy resume). */
  const pauseHide = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, []);

  useEffect(() => {
    api.getSettings().then((s) => applyTheme(s.theme));
    let unlistenSettings: (() => void) | undefined;
    events
      .onSettingsChanged(() => {
        api.getSettings().then((s) => applyTheme(s.theme));
      })
      .then((u) => (unlistenSettings = u));
    return () => unlistenSettings?.();
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let unlistenLevel: (() => void) | undefined;
    events
      .onDictationState((e) => {
        setState(e.state);
        setMessage(e.message);
        setMode(e.mode);
        setText(e.text);
        setRaw(e.raw);
        if (e.state === "recording") {
          // DESIGN.md §2.5: warm-up resets on every entry into recording, even
          // if a previous session already saw levels.
          hasLevelRef.current = false;
          setHasLevel(false);
        }
      })
      .then((u) => (unlisten = u));
    events
      .onDictationLevel((e) => {
        levelRef.current = e.level;
        if (!hasLevelRef.current) {
          hasLevelRef.current = true;
          setHasLevel(true);
        }
      })
      .then((u) => (unlistenLevel = u));
    return () => {
      unlisten?.();
      unlistenLevel?.();
    };
  }, []);

  // Headless verification only: pill.html?state=X freezes a state, ?demo=1 loops
  // the full recording→idle sequence with synthetic levels (DESIGN.md §6).
  useEffect(() => {
    if (isTauri()) return;
    const params = new URLSearchParams(window.location.search);
    if (params.has("demo")) {
      startDemoLoop();
      return;
    }
    const forced = params.get("state");
    if (forced === "recording" || forced === "transcribing" || forced === "cleaning" || forced === "done" || forced === "error") {
      const warmup = params.get("warmup") === "1";
      const long = params.get("long") === "1";
      const flash = params.get("flash") === "1";
      forceDictationState(
        forced,
        forced === "error" ? "Microphone not responding" : forced === "done" ? "Pasted" : undefined,
        forced === "recording" ? "toggle" : undefined,
        { warmup, long, flash },
      );
    }
  }, []);

  // Timer: starts at first recording event, stops at the first non-recording state.
  // Self-correcting setTimeout chain (rather than a plain setInterval) so each tick
  // lands on a whole second relative to `start` instead of drifting over time.
  useEffect(() => {
    if (state !== "recording") {
      recordingStart.current = null;
      return;
    }
    if (recordingStart.current === null) recordingStart.current = Date.now();
    const start = recordingStart.current;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const elapsed = Date.now() - start;
      setTimerText(formatTimer(elapsed));
      timer = setTimeout(tick, 1000 - (elapsed % 1000));
    };
    tick();
    return () => clearTimeout(timer);
  }, [state]);

  // Show / hide the window-level fade. `idle` hides immediately; `done`/`error`
  // get their auto-hide duration scheduled by the effect below.
  useEffect(() => {
    if (state === "idle") {
      pauseHide();
      setHiding(true);
      const t = setTimeout(() => setVisible(false), 200);
      return () => clearTimeout(t);
    }
    setHiding(false);
    setVisible(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  useEffect(() => {
    if (state !== "done" && state !== "error") return;
    const note = doneNote(raw, text, message);
    const key =
      state === "error"
        ? "error"
        : note?.err
          ? "done:ai-fallback"
          : `done:${message === "Copied" ? "copied" : "pasted"}`;
    scheduleHide(AUTO_HIDE_MS[key] ?? 2200);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, message, text, raw]);

  const handleBubbleHover = useCallback(
    (hovering: boolean) => {
      if (hovering) pauseHide();
      else scheduleHide(1200);
    },
    [pauseHide, scheduleHide],
  );

  const handleBubbleCopy = useCallback(() => {
    const remaining = Math.max(0, hideDeadline.current - Date.now());
    pauseHide();
    setCopyFlash(true);
    if (copyFlashTimer.current) clearTimeout(copyFlashTimer.current);
    copyFlashTimer.current = setTimeout(() => {
      setCopyFlash(false);
      scheduleHide(Math.max(remaining, 800));
    }, 1000);
  }, [pauseHide, scheduleHide]);

  if (!visible) {
    return <div className="pill-root pill-root--hidden" />;
  }

  const isRecording = state === "recording";
  const isWarmup = isRecording && !hasLevel;
  const isTranscribing = state === "transcribing";
  const isCleaning = state === "cleaning";
  const isDone = state === "done";
  const isError = state === "error";
  const hasCap = isRecording || isTranscribing || isCleaning;

  const rawDoneLabel = message?.toLowerCase().startsWith("copied") ? "Copied" : "Pasted";
  const doneLabel = copyFlash ? "Copied" : rawDoneLabel;
  const note = isDone ? doneNote(raw, text, message) : null;
  const showBubble = isDone && !!text;

  const srText = isWarmup
    ? "Listening"
    : isRecording
      ? "Recording"
      : isTranscribing
        ? "Transcribing"
        : isCleaning
          ? "Cleaning up"
          : isDone
            ? doneLabel === "Copied"
              ? "Copied to clipboard"
              : "Pasted"
            : isError
              ? `Error: ${message ?? "Something went wrong"}`
              : "";

  return (
    <div className={`pill-root pill-root--visible${hiding ? " pill-root--hiding" : ""}`}>
      <div
        className="pill-body"
        data-state={state}
        data-mode={mode}
        data-warmup={isWarmup || undefined}
        onClick={() => isRecording && api.stopDictation()}
      >
        <span className="pill-dot" data-state={state} aria-hidden="true" />

        <span className="pill-label" data-tone={isDone ? "accent" : isError ? "err" : undefined}>
          {isWarmup
            ? "Listening…"
            : isRecording
              ? timerText
              : isTranscribing
                ? "Transcribing…"
                : isCleaning
                  ? "Cleaning up…"
                  : isDone
                    ? doneLabel
                    : isError
                      ? "Error"
                      : ""}
        </span>

        <div className="pill-content" key={`${state}${isWarmup ? "-warmup" : ""}`}>
          {isWarmup && <WarmupDots />}
          {isRecording && !isWarmup && <Waveform levelRef={levelRef} reducedMotion={reducedMotion} />}
          {(isTranscribing || isCleaning) && <Sweep />}
          {isError && <span className="pill-error-text">{ellipsize(message ?? "Something went wrong", 56)}</span>}
          <span role="status" aria-live="polite" className="sr-only">
            {srText}
          </span>
        </div>

        {hasCap && (
          <button
            type="button"
            className="pill-cap"
            onClick={(e) => {
              e.stopPropagation();
              api.cancelDictation();
            }}
          >
            <span className="pill-cap-inner">Esc</span>
          </button>
        )}
        {isDone && note && <span className={`pill-note${note.err ? " pill-note--err" : ""}`}>{note.label}</span>}
        {isError && <span className="pill-note pill-note--muted">Open VoxFlow</span>}
      </div>

      {showBubble && (
        <TranscriptBubble text={text!} note={note} onCopy={handleBubbleCopy} onHoverChange={handleBubbleHover} />
      )}
    </div>
  );
}

/** DESIGN.md §2.5 — three pulsing dots shown before the first level event. */
function WarmupDots() {
  return (
    <span className="warmup" aria-hidden="true">
      <span className="warmup-dot" />
      <span className="warmup-dot" />
      <span className="warmup-dot" />
    </span>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Pill />
  </React.StrictMode>,
);
