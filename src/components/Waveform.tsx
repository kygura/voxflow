// DESIGN.md §2.5 — canvas waveform, replaces the old DOM-bar implementation.
// Draws directly with rAF; no React re-render per level event.
import { useEffect, useRef } from "react";

const BAR_W = 2;
const BAR_GAP = 2;
const PITCH = BAR_W + BAR_GAP; // 4px
const SLOT_H = 32;
// ponytail: tune GAIN against real mic RMS; 1.4 assumed peak speech ≈ 0.7
const GAIN = 1.4;
const SAMPLE_MS = 1000 / 30; // ~33.3ms, matches dictation://level rate

export function Waveform({
  levelRef,
  reducedMotion,
}: {
  /** mutable ref holding the latest 0..1 level; read each animation frame */
  levelRef: React.MutableRefObject<number>;
  reducedMotion: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let width = canvas.clientWidth || 188;
    let n = Math.max(1, Math.floor((width + BAR_GAP) / PITCH));
    let ring = new Array(n).fill(0);
    let env = 0;
    let accumulator = 0;
    let last = performance.now();
    let color = "#f5f5f5";

    const readColor = () => {
      const v = getComputedStyle(document.documentElement).getPropertyValue("--text-0").trim();
      if (v) color = v;
    };

    const resize = () => {
      width = canvas.clientWidth || 188;
      const nextN = Math.max(1, Math.floor((width + BAR_GAP) / PITCH));
      const prev = ring;
      ring = new Array(nextN).fill(0);
      for (let i = 0; i < Math.min(nextN, prev.length); i++) {
        ring[nextN - 1 - i] = prev[prev.length - 1 - i];
      }
      n = nextN;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(SLOT_H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    readColor();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let raf = 0;
    const tick = (now: number) => {
      const dt = now - last;
      last = now;

      const v = Math.min(1, Math.max(0, levelRef.current * GAIN));
      env += (v - env) * (v > env ? 0.55 : 0.12);

      accumulator += dt;
      while (accumulator >= SAMPLE_MS) {
        ring.shift();
        ring.push(env);
        accumulator -= SAMPLE_MS;
      }

      readColor();
      ctx.clearRect(0, 0, width, SLOT_H);
      ctx.fillStyle = color;

      const offset = reducedMotion ? 0 : -(accumulator / SAMPLE_MS) * PITCH;
      for (let i = 0; i < n; i++) {
        // The rightmost (newest) bar tracks the live envelope, not the last sample.
        const sample = i === n - 1 ? env : ring[i];
        const clamped = Math.min(1, Math.max(0, sample));
        const h = 2 + 30 * Math.sqrt(clamped);
        const y = (SLOT_H - h) / 2;
        ctx.fillRect(i * PITCH + offset, y, BAR_W, h);
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [levelRef, reducedMotion]);

  return <canvas ref={canvasRef} className="pill-waveform" aria-hidden="true" />;
}
