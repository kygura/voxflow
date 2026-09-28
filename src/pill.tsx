import "@fontsource/archivo/500.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "./styles/tokens.css";
import "./styles/pill.css";

import React, { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import { api, events, isTauri } from "./lib/api";
import type { DictationStateEvent, DictationStateName } from "./lib/ipc";
import { forceDictationState, startDemoLoop } from "./lib/mock";
import { Waveform } from "./components/Waveform";
import { Sweep } from "./components/ui";
import { applyTheme } from "./lib/theme";

// DESIGN.md §2.3/§2.8 auto-hide durations, keyed by state + done/error variant.
const AUTO_HIDE_MS: Record<string, number> = {
  "done:pasted": 1600,
  "done:copied": 2000,
  "done:ai-fallback": 2400,
  error: 3000,
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

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

/** DESIGN.md §2.7 — removed-count note computed from raw vs cleaned text. */
function doneNote(
  raw: string | undefined,
  text: string | undefined,
  message: string | undefined,
): { label: string; err?: boolean } | null {
  if (message?.includes("AI cleanup failed")) return { label: "AI FAILED · BASIC", err: true };
  if (!raw || raw === text) return null;
  const n = wordCount(raw) - wordCount(text ?? "");
  return n >= 1 ? { label: `−${n} FILLERS` } : { label: "EDITED" };
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
  const [timerText, setTimerText] = useState("00:00");
  const levelRef = useRef(0);
  const recordingStart = useRef<number | null>(null);
  const reducedMotion = useReducedMotion();

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
      })
      .then((u) => (unlisten = u));
    events
      .onDictationLevel((e) => {
        levelRef.current = e.level;
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
      forceDictationState(
        forced,
        forced === "error" ? "Network request failed" : forced === "done" ? "Pasted" : undefined,
        forced === "recording" ? "toggle" : undefined,
      );
    }
  }, []);

  // Timer: starts at first recording event, stops at the first non-recording state.
  useEffect(() => {
    if (state === "recording") {
      if (recordingStart.current === null) recordingStart.current = Date.now();
      const start = recordingStart.current;
      setTimerText(formatTimer(Date.now() - start));
      const id = setInterval(() => setTimerText(formatTimer(Date.now() - start)), 1000);
      return () => clearInterval(id);
    }
    recordingStart.current = null;
  }, [state]);

  useEffect(() => {
    setVisible(state !== "idle");
    if (state !== "done" && state !== "error") return;
    const note = doneNote(raw, text, message);
    const key =
      state === "error"
        ? "error"
        : note?.err
          ? "done:ai-fallback"
          : `done:${message === "Copied" ? "copied" : "pasted"}`;
    const ms = AUTO_HIDE_MS[key] ?? 1600;
    const t = setTimeout(() => setVisible(false), ms);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, message, text, raw]);

  if (!visible) {
    return <div className="pill-root pill-root--hidden" />;
  }

  const isRecording = state === "recording";
  const isTranscribing = state === "transcribing";
  const isCleaning = state === "cleaning";
  const isDone = state === "done";
  const isError = state === "error";
  const isPtt = mode === "push_to_talk";
  const hasCap = isRecording || isTranscribing || isCleaning;

  const doneLabel = message?.toLowerCase().startsWith("copied") ? "COPIED" : "PASTED";
  const note = isDone ? doneNote(raw, text, message) : null;
  const showSnippet = isDone && !!text;

  const srText = isRecording
    ? "Recording"
    : isTranscribing
      ? "Transcribing"
      : isCleaning
        ? "Cleaning up"
        : isDone
          ? doneLabel === "COPIED"
            ? "Copied to clipboard"
            : "Pasted"
          : isError
            ? `Error: ${message ?? "Something went wrong"}`
            : "";

  return (
    <div className="pill-root pill-root--visible">
      <div
        className={`pill-body pill-body--${state}${showSnippet ? " pill-body--tall" : ""}`}
        data-state={state}
        data-mode={mode}
        onClick={() => isRecording && api.stopDictation()}
      >
        <div className="pill-row1">
          <span className={`pill-mark pill-mark--${state}${isPtt && isRecording ? " pill-mark--blink" : ""}`} aria-hidden="true" />

          <span className="pill-label" data-tone={isDone ? "accent" : isError ? "err" : "muted"}>
            {isRecording ? timerText : isTranscribing ? "TRANSCRIBING" : isCleaning ? "CLEANING" : isDone ? doneLabel : isError ? "ERROR" : ""}
          </span>

          <div className="pill-content" key={state}>
            {isRecording && <Waveform levelRef={levelRef} reducedMotion={reducedMotion} />}
            {(isTranscribing || isCleaning) && <Sweep width={188} />}
            {isError && (
              <span className="pill-error-text">{(message ?? "Something went wrong").slice(0, 48)}</span>
            )}
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
              ESC
            </button>
          )}
          {isDone && note && (
            <span className={`pill-note${note.err ? " pill-note--err" : ""}`}>{note.label}</span>
          )}
          {isError && <span className="pill-note pill-note--muted">SEE VOXFLOW</span>}
        </div>

        {showSnippet && (
          <div className="pill-row2">
            <span className="pill-snippet">{text}</span>
          </div>
        )}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Pill />
  </React.StrictMode>,
);
