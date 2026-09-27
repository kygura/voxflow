import { describe, expect, test } from "bun:test";
import {
  SettingsSchema,
  ModelInfoSchema,
  HistoryEntrySchema,
  StatusSchema,
  DictationStateEventSchema,
  DownloadProgressSchema,
  DownloadDoneSchema,
} from "./ipc";

const goodSettings = {
  hotkey: "CommandOrControl+Shift+Space",
  hotkeyMode: "hybrid",
  backend: "local",
  localModel: "base",
  remote: { baseUrl: "https://api.openai.com/v1", model: "whisper-1" },
  language: "auto",
  inputDevice: null,
  autoPaste: true,
  restoreClipboard: true,
  saveHistory: true,
  theme: "system",
};

describe("SPEC-shaped payloads", () => {
  test("Settings accepts a SPEC-shaped payload", () => {
    expect(SettingsSchema.parse(goodSettings)).toEqual(goodSettings as never);
  });

  test("Settings rejects bad enum / missing field", () => {
    expect(() => SettingsSchema.parse({ ...goodSettings, hotkeyMode: "nope" })).toThrow();
    const { hotkey: _hotkey, ...missingHotkey } = goodSettings;
    expect(() => SettingsSchema.parse(missingHotkey)).toThrow();
  });

  test("ModelInfo accepts / rejects", () => {
    expect(
      ModelInfoSchema.parse({ name: "base", sizeMb: 142, englishOnly: false, downloaded: true }),
    ).toBeTruthy();
    expect(() => ModelInfoSchema.parse({ name: "base", sizeMb: "142" })).toThrow();
  });

  test("HistoryEntry accepts / rejects", () => {
    expect(
      HistoryEntrySchema.parse({
        id: "1",
        text: "hi",
        createdAt: 123,
        backend: "remote",
        model: "whisper-1",
        durationMs: 900,
      }),
    ).toBeTruthy();
    expect(() =>
      HistoryEntrySchema.parse({ id: "1", text: "hi", createdAt: 123, backend: "cloud" }),
    ).toThrow();
  });

  test("Status accepts optional fields missing", () => {
    expect(StatusSchema.parse({ state: "idle", hasApiKey: false })).toBeTruthy();
    expect(() => StatusSchema.parse({ state: "bogus", hasApiKey: false })).toThrow();
  });

  test("DictationState event payload", () => {
    expect(DictationStateEventSchema.parse({ state: "done", message: "Pasted" })).toBeTruthy();
    expect(() => DictationStateEventSchema.parse({ state: "done", message: 5 })).toThrow();
  });

  test("DownloadProgress / DownloadDone", () => {
    expect(
      DownloadProgressSchema.parse({ name: "base", downloaded: 10, total: 100 }),
    ).toBeTruthy();
    expect(DownloadDoneSchema.parse({ name: "base" })).toBeTruthy();
    expect(DownloadDoneSchema.parse({ name: "base", error: "cancelled" })).toBeTruthy();
    expect(() => DownloadDoneSchema.parse({ downloaded: 10 })).toThrow();
  });
});
