// Audio-file helpers for "Transcribe file…" and drag-and-drop. The extension list
// mirrors AUDIO_EXTS in src-tauri/src/commands.rs.

export const AUDIO_EXTENSIONS = ["wav", "mp3", "m4a", "ogg", "flac"] as const;

/** True when the path ends in a supported audio extension (case-insensitive). */
export function isSupportedAudio(path: string): boolean {
  const name = path.split(/[\\/]/).pop() ?? "";
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return false;
  return (AUDIO_EXTENSIONS as readonly string[]).includes(name.slice(dot + 1).toLowerCase());
}

/** A file transcription may start unless a dictation or transcription is in flight. */
export function canStartFile(state: string): boolean {
  return state === "idle" || state === "done" || state === "error";
}
