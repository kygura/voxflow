import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-mono/400.css";
import "./styles/tokens.css";
import "./styles/pill.css";

import React, { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import { api, events, isTauri } from "./lib/api";
import type { DictationStateEvent, DictationStateName } from "./lib/ipc";
import { forceDictationState } from "./lib/mock";
import { Waveform } from "./components/Waveform";
import { applyTheme } from "./lib/theme";

const AUTO_HIDE_MS: Partial<Record<string, number>> = {
  "done:pasted": 900,
  "done:copied": 1400,
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

function Pill() {
  const [state, setState] = useState<DictationStateName>("idle");
  const [message, setMessage] = useState<string | undefined>();
  const [visible, setVisible] = useState(false);
  const [mode, setMode] = useState<DictationStateEvent["mode"]>();
  const levelRef = useRef(0);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    api.getSettings().then((s) => applyTheme(s.theme));
    let unlistenSettings: (() => void) | undefined;
    events.onSettingsChanged(() => {
      api.getSettings().then((s) => applyTheme(s.theme));
    }).then((u) => (unlistenSettings = u));
    return () => unlistenSettings?.();
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let unlistenLevel: (() => void) | undefined;
    events.onDictationState((e) => {
      setState(e.state);
      setMessage(e.message);
      setMode(e.mode);
    }).then((u) => (unlisten = u));
    events.onDictationLevel((e) => {
      levelRef.current = e.level;
    }).then((u) => (unlistenLevel = u));
    return () => {
      unlisten?.();
      unlistenLevel?.();
    };
  }, []);

  // ?demo support: force a state via ?state= for visual verification outside Tauri.
  useEffect(() => {
    if (isTauri()) return;
    const params = new URLSearchParams(window.location.search);
    if (!params.has("demo")) return;
    const forced = params.get("state");
    if (forced === "recording" || forced === "transcribing") {
      forceDictationState(forced);
    } else if (forced === "done-pasted") {
      forceDictationState("done", "Pasted");
    } else if (forced === "done-copied") {
      forceDictationState("done", "Copied");
    } else if (forced === "error") {
      forceDictationState("error", "Network request failed");
    } else {
      forceDictationState("recording");
    }
  }, []);

  useEffect(() => {
    setVisible(state !== "idle");
    if (state !== "done" && state !== "error") return;
    const key = state === "done" ? `done:${message === "Copied" ? "copied" : "pasted"}` : "error";
    const ms = AUTO_HIDE_MS[key] ?? 900;
    const t = setTimeout(() => setVisible(false), ms);
    return () => clearTimeout(t);
  }, [state, message]);

  if (!visible) {
    return <div className="pill-root pill-root--hidden" />;
  }

  const isRecording = state === "recording";
  const isTranscribing = state === "transcribing";
  const isDone = state === "done";
  const isError = state === "error";
  const isPtt = mode === "push_to_talk";

  const hint = isRecording
    ? isPtt
      ? "release to stop"
      : "Esc to cancel"
    : isTranscribing
      ? "Esc to cancel"
      : isError
        ? "details in VoxFlow"
        : "";

  const statusText = isRecording
    ? "Recording"
    : isTranscribing
      ? "Transcribing"
      : isDone
        ? message ?? "Done"
        : isError
          ? message ?? "Error"
          : "";

  const onClick = () => {
    if (isRecording) api.stopDictation();
  };

  return (
    <div className={`pill-root pill-root--visible`}>
      <div
        className={`pill-body pill-body--${state}`}
        onClick={onClick}
        data-state={state}
      >
        <span className={`pill-glyph pill-glyph--${state}`} aria-hidden="true">
          {isRecording && <span className={`pill-dot${isPtt ? " is-pulsing" : ""}`} />}
          {isTranscribing && <span className="pill-spinner" />}
          {isDone && message === "Copied" && "⧉"}
          {isDone && message !== "Copied" && "✓"}
          {isError && "!"}
        </span>

        <div className="pill-content" role="status" aria-live="polite">
          {isRecording && <Waveform levelRef={levelRef} reducedMotion={reducedMotion} />}
          {isTranscribing && (
            <span className="pill-transcribing-text">
              Transcribing
              <span className="pill-transcribing-dot">.</span>
              <span className="pill-transcribing-dot">.</span>
              <span className="pill-transcribing-dot">.</span>
            </span>
          )}
          {isDone && <span className="pill-status-text">{statusText}</span>}
          {isError && (
            <span className="pill-status-text pill-status-text--error">
              {(message ?? "Something went wrong").slice(0, 36)}
            </span>
          )}
        </div>

        {hint && <span className="pill-hint">{hint}</span>}

        {(isRecording || isTranscribing) && (
          <button
            type="button"
            className="pill-cancel"
            aria-label="Cancel"
            onClick={(e) => {
              e.stopPropagation();
              api.cancelDictation();
            }}
          >
            ×
          </button>
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
