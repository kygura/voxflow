import { AlertCircle, Upload } from "./icons";
import type { DropState } from "../lib/useFileDrop";

const COPY: Record<DropState, { title: string; hint: string }> = {
  ready: { title: "Drop to transcribe", hint: "wav, mp3, m4a, ogg, flac" },
  unsupported: { title: "Unsupported file", hint: "Use wav, mp3, m4a, ogg or flac" },
  busy: { title: "Busy — try again in a moment", hint: "Dictation or transcription in progress" },
};

/** Full-window scrim shown while a file is dragged over the app. */
export function DropOverlay({ state }: { state: DropState }) {
  const { title, hint } = COPY[state];
  return (
    <div className={`drop-overlay drop-overlay--${state}`} role="status">
      <div className="drop-zone">
        <span className="drop-zone-icon">
          {state === "ready" ? <Upload size={24} /> : <AlertCircle size={24} />}
        </span>
        <p className="drop-zone-title">{title}</p>
        <p className="drop-zone-hint">{hint}</p>
      </div>
    </div>
  );
}
