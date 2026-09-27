// Converts a captured keydown combo into a Tauri accelerator string
// (DESIGN.md §3.4 HotkeyRecorder). Pure function, no DOM side effects.

const MODIFIER_CODES = new Set([
  "ControlLeft",
  "ControlRight",
  "AltLeft",
  "AltRight",
  "ShiftLeft",
  "ShiftRight",
  "MetaLeft",
  "MetaRight",
]);

const ARROW_KEYS: Record<string, string> = {
  ArrowUp: "Up",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
};

function mainKeyFromCode(code: string): string | null {
  if (code === "Space") return "Space";
  if (code === "Escape") return "Escape";
  if (code in ARROW_KEYS) return ARROW_KEYS[code];
  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) return code; // F1..F24
  if (/^Key[A-Z]$/.test(code)) return code.slice(3); // KeyA -> A
  if (/^Digit[0-9]$/.test(code)) return code.slice(5); // Digit1 -> 1
  return null;
}

/**
 * Returns a Tauri accelerator string for a keydown event, or null when the
 * event is modifier-only (nothing to capture yet) or the key has no mapping.
 */
export function toAccelerator(
  e: Pick<KeyboardEvent, "code" | "ctrlKey" | "altKey" | "shiftKey" | "metaKey">,
): string | null {
  if (MODIFIER_CODES.has(e.code)) return null;

  const key = mainKeyFromCode(e.code);
  if (!key) return null;

  const parts: string[] = [];
  if (e.ctrlKey) parts.push("CommandOrControl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  if (e.metaKey) parts.push("Super");
  parts.push(key);
  return parts.join("+");
}
