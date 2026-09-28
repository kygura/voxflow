// DESIGN.md §2.7 — transcript bubble shown above the pill in the done state.
import { useState } from "react";
import { api } from "../lib/api";

export function TranscriptBubble({
  text,
  note,
  copied,
  onCopy,
  onHoverChange,
}: {
  text: string;
  note?: { label: string; err?: boolean } | null;
  /** The pill's own copy-flash state (avoids a second duplicate timer here). */
  copied: boolean;
  /** Notifies the pill so it can flash its own label. */
  onCopy: () => void;
  onHoverChange: (hovering: boolean) => void;
}) {
  const [failed, setFailed] = useState(false);

  const handleClick = async () => {
    try {
      await api.copyText(text);
      setFailed(false);
      onCopy();
    } catch {
      setFailed(true);
    }
  };

  return (
    <div
      className="bubble"
      onClick={handleClick}
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
    >
      <p className="bubble-text">{text}</p>
      <div className="bubble-footer">
        <span className={`bubble-note${note?.err ? " bubble-note--err" : ""}`}>
          {note?.label ?? ""}
        </span>
        <span className={`bubble-hint${failed ? " bubble-note--err" : ""}`}>
          {failed ? "Copy failed" : copied ? "Copied" : "Click to copy"}
        </span>
      </div>
    </div>
  );
}
