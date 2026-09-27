// DESIGN.md §2.4 — 24-bar rolling waveform, updated via refs/rAF, no React
// re-render per level event.
import { useEffect, useRef } from "react";

const BARS = 24;

export function Waveform({
  levelRef,
  reducedMotion,
}: {
  /** mutable ref holding the latest 0..1 level; read each animation frame */
  levelRef: React.MutableRefObject<number>;
  reducedMotion: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<number[]>(new Array(BARS).fill(0));
  const prevSmoothedRef = useRef(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const bars = Array.from(el.children) as HTMLDivElement[];

    const tick = () => {
      const raw = levelRef.current;
      const smoothed = Math.max(raw, prevSmoothedRef.current * 0.82);
      prevSmoothedRef.current = smoothed;
      const hist = historyRef.current;
      hist.shift();
      hist.push(smoothed);

      hist.forEach((v, i) => {
        const clamped = Math.min(1, Math.max(0, v));
        const h = 4 + 24 * Math.sqrt(clamped);
        const bar = bars[i];
        if (!bar) return;
        bar.style.height = `${h}px`;
        bar.style.opacity = String(0.35 + (0.65 * i) / (BARS - 1));
      });

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [levelRef]);

  return (
    <div
      ref={containerRef}
      className={`waveform${reducedMotion ? " is-reduced-motion" : ""}`}
      aria-hidden="true"
    >
      {Array.from({ length: BARS }).map((_, i) => (
        <div key={i} className="waveform-bar" />
      ))}
    </div>
  );
}
