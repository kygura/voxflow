// DESIGN.md §3.3 — captures a key combo and converts it to an accelerator.
import { useEffect, useRef, useState } from "react";
import { toAccelerator } from "../lib/accelerator";
import { Badge, KeyCombo } from "./ui";

type Phase = "idle" | "listening" | "flash-ok" | "invalid";

const LIVE_MODIFIER_LABELS: Record<string, string> = {
  ctrlKey: "Ctrl",
  altKey: "Alt",
  shiftKey: "Shift",
  metaKey: navigator.platform.toLowerCase().includes("win") ? "Win" : "Super",
};

export function HotkeyRecorder({
  value,
  onCapture,
  invalidMessage,
  allowEmpty,
  onClear,
}: {
  value: string;
  onCapture: (accelerator: string) => Promise<void> | void;
  invalidMessage?: string;
  /** DESIGN.md §3.3: an empty value renders an "Off" badge instead of caps,
   * and a "Clear" button outside the box saves "". */
  allowEmpty?: boolean;
  onClear?: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [liveMods, setLiveMods] = useState<string[]>([]);
  const [error, setError] = useState<string | undefined>(invalidMessage);
  const revertTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setError(invalidMessage), [invalidMessage]);

  useEffect(() => {
    if (phase !== "listening") return;
    const onKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      if (e.code === "Escape") {
        setPhase("idle");
        setLiveMods([]);
        return;
      }
      const accel = toAccelerator(e);
      if (!accel) {
        setLiveMods(
          Object.entries(LIVE_MODIFIER_LABELS)
            .filter(([k]) => (e as unknown as Record<string, boolean>)[k])
            .map(([, label]) => label),
        );
        return;
      }
      Promise.resolve(onCapture(accel))
        .then(() => {
          setPhase("flash-ok");
          setTimeout(() => setPhase("idle"), 600);
        })
        .catch((err: unknown) => {
          setError(String(err));
          setPhase("invalid");
          revertTimer.current = setTimeout(() => setPhase("idle"), 5000);
        });
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [phase, onCapture]);

  useEffect(() => () => {
    if (revertTimer.current) clearTimeout(revertTimer.current);
  }, []);

  const start = () => {
    setError(undefined);
    setLiveMods([]);
    setPhase("listening");
  };

  const isEmpty = allowEmpty && value === "" && phase === "idle";
  // DESIGN.md Round 2 #9: with allowEmpty and a value set, Clear is a second
  // text action inside the box, after Change (`Change · Clear`).
  const showClear = allowEmpty && !isEmpty && phase === "idle";

  return (
    <div className="hotkey-recorder-wrap">
      <div
        role="button"
        tabIndex={0}
        className={`hotkey-recorder hotkey-recorder--${phase}${isEmpty ? " hotkey-recorder--empty" : ""}`}
        onClick={() => (phase === "idle" ? start() : undefined)}
        onKeyDown={(e) => {
          if (phase === "idle" && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            start();
          }
        }}
        onBlur={() => phase === "listening" && setPhase("idle")}
        aria-live="polite"
      >
        {phase === "listening" ? (
          liveMods.length ? (
            <KeyCombo combo={liveMods.join("+")} muted />
          ) : (
            <span className="hotkey-recorder-hint">Press keys…</span>
          )
        ) : isEmpty ? (
          <Badge tone="muted">Off</Badge>
        ) : (
          <KeyCombo combo={value} />
        )}
        <span className="hotkey-recorder-actions">
          <span className="hotkey-recorder-action">
            {phase === "listening" ? "Esc to cancel" : isEmpty ? "Set" : "Change"}
          </span>
          {showClear && (
            <>
              <span className="hotkey-recorder-sep" aria-hidden="true">
                ·
              </span>
              <button
                type="button"
                className="hotkey-recorder-action hotkey-recorder-action--clear"
                onClick={(e) => {
                  e.stopPropagation();
                  onClear?.();
                }}
              >
                Clear
              </button>
            </>
          )}
        </span>
      </div>
      {phase === "invalid" && error && <p className="field-helper field-helper--error">{error}</p>}
    </div>
  );
}
