import { describe, expect, test } from "bun:test";
import { canStartFile, isSupportedAudio } from "./audio";

describe("isSupportedAudio", () => {
  test("accepts supported extensions, case-insensitively, on posix and windows paths", () => {
    for (const p of ["a.wav", "/x/y.MP3", "C:\\Users\\me\\talk.M4a", "a.tar.ogg", "b.Flac"]) {
      expect(isSupportedAudio(p)).toBe(true);
    }
  });

  test("rejects other extensions and extensionless names", () => {
    for (const p of ["a.txt", "a.wav.exe", "wav", ".wav", "dir.wav/file", "", "a."]) {
      expect(isSupportedAudio(p)).toBe(false);
    }
  });
});

test("canStartFile mirrors the sidebar button", () => {
  for (const [s, ok] of [
    ["idle", true],
    ["done", true],
    ["error", true],
    ["recording", false],
    ["transcribing", false],
    ["cleaning", false],
  ] as const) {
    expect(canStartFile(s)).toBe(ok);
  }
});
