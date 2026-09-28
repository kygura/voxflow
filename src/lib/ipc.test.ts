import { describe, expect, test } from "bun:test";
import {
  SettingsSchema,
  DictEntrySchema,
  ModelInfoSchema,
  HistoryEntrySchema,
  StatusSchema,
  DictationStateEventSchema,
  DownloadProgressSchema,
  DownloadDoneSchema,
  CleanupPreviewSchema,
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
  cleanup: "basic",
  ai: { baseUrl: "http://localhost:11434/v1", model: "llama3.2" },
  pasteLastHotkey: "Alt+Shift+Z",
  dictionary: [{ from: "vox flow", to: "VoxFlow" }],
  sounds: false,
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

  test("Settings rejects an oversized dictionary / empty from / overlong strings", () => {
    expect(() =>
      SettingsSchema.parse({ ...goodSettings, dictionary: Array(201).fill({ from: "a", to: "b" }) }),
    ).toThrow();
    expect(() => DictEntrySchema.parse({ from: "", to: "x" })).toThrow();
    expect(() => DictEntrySchema.parse({ from: "a".repeat(101), to: "x" })).toThrow();
    expect(() => DictEntrySchema.parse({ from: "a", to: "b".repeat(101) })).toThrow();
    expect(DictEntrySchema.parse({ from: "vox flow", to: "" })).toBeTruthy();
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
    expect(StatusSchema.parse({ state: "idle", hasApiKey: false, hasAiKey: false })).toBeTruthy();
    expect(() =>
      StatusSchema.parse({ state: "bogus", hasApiKey: false, hasAiKey: false }),
    ).toThrow();
  });

  test("DictationState event payload", () => {
    expect(
      DictationStateEventSchema.parse({
        state: "done",
        message: "Pasted",
        text: "So I think we should ship it.",
        raw: "um so I I think we should ship it",
      }),
    ).toBeTruthy();
    expect(DictationStateEventSchema.parse({ state: "cleaning" })).toBeTruthy();
    expect(() => DictationStateEventSchema.parse({ state: "done", message: 5 })).toThrow();
  });

  test("CleanupPreview accepts / rejects", () => {
    expect(CleanupPreviewSchema.parse({ basic: "clean text" })).toBeTruthy();
    expect(
      CleanupPreviewSchema.parse({ basic: "clean text", ai: "ai text" }),
    ).toBeTruthy();
    expect(
      CleanupPreviewSchema.parse({ basic: "clean text", aiError: "no key" }),
    ).toBeTruthy();
    expect(() => CleanupPreviewSchema.parse({ ai: "only ai" })).toThrow();
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
