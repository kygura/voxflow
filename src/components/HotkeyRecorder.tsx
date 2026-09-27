// DESIGN.md §3.4 — captures a key combo and converts it to an accelerator.
import { useEffect, useRef, useState } from "react";
import { toAccelerator } from "../lib/accelerator";
import { KeyCombo } from "./ui";

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
}: {
  value: string;
  onCapture: (accelerator: string) => Promise<void> | void;
  invalidMessage?: string;
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

  return (
    <div className="hotkey-recorder-wrap">
      <button
        type="button"
        className={`hotkey-recorder hotkey-recorder--${phase}`}
        onClick={() => (phase === "idle" ? start() : undefined)}
        onBlur={() => phase === "listening" && setPhase("idle")}
        aria-live="polite"
      >
        {phase === "listening" ? (
          liveMods.length ? (
            <KeyCombo combo={liveMods.join("+")} muted />
          ) : (
            <span className="hotkey-recorder-hint">Press keys…</span>
          )
        ) : (
          <KeyCombo combo={value} />
        )}
        <span className="hotkey-recorder-action">
          {phase === "listening" ? "Esc to cancel" : "Change"}
        </span>
      </button>
      {phase === "invalid" && error && <p className="field-helper field-helper--error">{error}</p>}
    </div>
  );
}
