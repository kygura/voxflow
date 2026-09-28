import { describe, expect, test } from "bun:test";

// Cleanup.tsx pulls in lib/api.ts, whose isTauri() check touches `window` at
// module load; bun test runs outside a DOM, so stub it before importing.
if (typeof window === "undefined") {
  (globalThis as unknown as { window: object }).window = {};
}

const { PRESETS } = await import("./Cleanup");

describe("Cleanup PRESETS", () => {
  test("every preset has a non-empty baseUrl and model", () => {
    for (const [name, preset] of Object.entries(PRESETS)) {
      expect(preset.baseUrl, `${name} baseUrl`).not.toBe("");
      expect(preset.model, `${name} model`).not.toBe("");
    }
  });
});
