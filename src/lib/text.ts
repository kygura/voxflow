// Shared word-count / diff-label helpers (DESIGN.md §2.7 counter, reused by
// pill.tsx, History.tsx and Playground.tsx so the "-N X" / "EDITED" logic
// lives in exactly one place).

export function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Label for the word-count delta between `before` and `after`, e.g.
 * `−4 fillers` / `−4 words`, or `Edited` when the text changed but the word
 * count didn't drop. Returns null when the two are the same (nothing to report).
 */
export function diffLabel(before: string, after: string, unit: string): string | null {
  if (before.trim() === after.trim()) return null;
  const n = wordCount(before) - wordCount(after);
  return n >= 1 ? `−${n} ${unit}` : "Edited";
}
