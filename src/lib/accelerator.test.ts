import { describe, expect, test } from "bun:test";
import { toAccelerator } from "./accelerator";

function key(
  code: string,
  mods: Partial<{ ctrlKey: boolean; altKey: boolean; shiftKey: boolean; metaKey: boolean }> = {},
) {
  return {
    code,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    metaKey: false,
    ...mods,
  };
}

describe("toAccelerator", () => {
  test("Ctrl+Shift+Space", () => {
    expect(toAccelerator(key("Space", { ctrlKey: true, shiftKey: true }))).toBe(
      "CommandOrControl+Shift+Space",
    );
  });

  test("modifier-only keydown returns null", () => {
    expect(toAccelerator(key("ControlLeft", { ctrlKey: true }))).toBeNull();
    expect(toAccelerator(key("ShiftRight", { shiftKey: true }))).toBeNull();
  });

  test("F5 alone", () => {
    expect(toAccelerator(key("F5"))).toBe("F5");
  });

  test("letters and digits", () => {
    expect(toAccelerator(key("KeyA", { ctrlKey: true }))).toBe("CommandOrControl+A");
    expect(toAccelerator(key("Digit1", { altKey: true }))).toBe("Alt+1");
  });

  test("arrow keys", () => {
    expect(toAccelerator(key("ArrowUp"))).toBe("Up");
  });

  test("unmapped key returns null", () => {
    expect(toAccelerator(key("CapsLock"))).toBeNull();
  });
});
