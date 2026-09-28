// DESIGN.md §2.7 — transcript bubble shown above the pill in the done state.
import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";

export function TranscriptBubble({
  text,
  note,
  onCopy,
  onHoverChange,
}: {
  text: string;
  note?: { label: string; err?: boolean } | null;
  /** Notifies the pill so it can flash its own label and pause the auto-hide timer. */
  onCopy: () => void;
  onHoverChange: (hovering: boolean) => void;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const handleClick = () => {
    api.copyText(text);
    onCopy();
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1000);
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
        <span className="bubble-hint">{copied ? "Copied" : "Click to copy"}</span>
      </div>
    </div>
  );
}
