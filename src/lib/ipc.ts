// Typed, validated wrappers around the Tauri IPC surface (SPEC.md "IPC surface"
// and "IPC payload shapes"). Every payload coming from Rust is parsed with zod
// before the rest of the app touches it.
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { z } from "zod";

export const HotkeyModeSchema = z.enum(["hybrid", "push_to_talk", "toggle"]);
export type HotkeyMode = z.infer<typeof HotkeyModeSchema>;

export const BackendSchema = z.enum(["local", "remote"]);
export type Backend = z.infer<typeof BackendSchema>;

export const ThemeSchema = z.enum(["system", "dark", "light"]);
export type Theme = z.infer<typeof ThemeSchema>;

export const CleanupModeSchema = z.enum(["off", "basic", "ai"]);
export type CleanupMode = z.infer<typeof CleanupModeSchema>;

// SPEC.md v3: whole-word, case-insensitive `from` → `to`; `from` non-empty ≤100
// chars, `to` ≤100 chars (may be empty — that means "delete the word").
// Rust counts `.chars().count()` (Unicode scalars); zod's `.max()` counts
// UTF-16 code units, which double-counts astral-plane emoji. Count code
// points via spread to match the Rust-side limit.
const codePointCount = (s: string) => [...s].length;
const max100CodePoints = <T extends z.ZodString>(schema: T) =>
  schema.refine((s) => codePointCount(s) <= 100, { message: "String must contain at most 100 character(s)" });

export const MAX_DICT = 200;
export const MAX_CLEANUP_INSTRUCTIONS = 2000;

export const DictEntrySchema = z.object({
  from: max100CodePoints(z.string().min(1)),
  to: max100CodePoints(z.string()),
});
export type DictEntry = z.infer<typeof DictEntrySchema>;

export const SettingsSchema = z.object({
  hotkey: z.string(),
  hotkeyMode: HotkeyModeSchema,
  backend: BackendSchema,
  localModel: z.string(),
  remote: z.object({ baseUrl: z.string(), model: z.string() }),
  language: z.string(),
  inputDevice: z.string().nullable(),
  autoPaste: z.boolean(),
  restoreClipboard: z.boolean(),
  saveHistory: z.boolean(),
  theme: ThemeSchema,
  cleanup: CleanupModeSchema,
  // AI cleanup only; free-form guidance appended to the cleanup prompt. Rust
  // counts `.chars().count()` — count code points here too (see codePointCount above).
  cleanupInstructions: z
    .string()
    .refine((s) => codePointCount(s) <= MAX_CLEANUP_INSTRUCTIONS, {
      message: `String must contain at most ${MAX_CLEANUP_INSTRUCTIONS} character(s)`,
    }),
  ai: z.object({ baseUrl: z.string(), model: z.string() }),
  pasteLastHotkey: z.string(),
  dictionary: z.array(DictEntrySchema).max(MAX_DICT),
  sounds: z.boolean(),
});
export type Settings = z.infer<typeof SettingsSchema>;

export const ModelInfoSchema = z.object({
  name: z.string(),
  sizeMb: z.number(),
  englishOnly: z.boolean(),
  downloaded: z.boolean(),
});
export type ModelInfo = z.infer<typeof ModelInfoSchema>;
export const ModelInfoListSchema = z.array(ModelInfoSchema);

export const HistoryEntrySchema = z.object({
  id: z.string(),
  text: z.string(),
  raw: z.string().optional(),
  createdAt: z.number(),
  backend: BackendSchema,
  model: z.string(),
  durationMs: z.number(),
});
export type HistoryEntry = z.infer<typeof HistoryEntrySchema>;
export const HistoryEntryListSchema = z.array(HistoryEntrySchema);

export const DictationStateNameSchema = z.enum([
  "idle",
  "recording",
  "transcribing",
  "cleaning",
  "done",
  "error",
]);
export type DictationStateName = z.infer<typeof DictationStateNameSchema>;

export const StatusSchema = z.object({
  state: DictationStateNameSchema,
  message: z.string().optional(),
  lastError: z.string().optional(),
  hasApiKey: z.boolean(),
  hasAiKey: z.boolean(),
});
export type Status = z.infer<typeof StatusSchema>;

export const DictationStateEventSchema = z.object({
  state: DictationStateNameSchema,
  message: z.string().optional(),
  // Recording only: "push_to_talk" while the hotkey is held, "toggle" when hands-free.
  mode: z.enum(["push_to_talk", "toggle"]).optional(),
  text: z.string().optional(),
  raw: z.string().optional(),
});
export type DictationStateEvent = z.infer<typeof DictationStateEventSchema>;

export const DictationLevelEventSchema = z.object({
  level: z.number(),
});
export type DictationLevelEvent = z.infer<typeof DictationLevelEventSchema>;

export const DownloadProgressSchema = z.object({
  name: z.string(),
  downloaded: z.number(),
  total: z.number(),
});
export type DownloadProgress = z.infer<typeof DownloadProgressSchema>;

export const DownloadDoneSchema = z.object({
  name: z.string(),
  error: z.string().optional(),
});
export type DownloadDone = z.infer<typeof DownloadDoneSchema>;

export const InputDeviceListSchema = z.array(z.string());

export const CleanupPreviewSchema = z.object({
  basic: z.string(),
  ai: z.string().optional(),
  aiError: z.string().optional(),
});
export type CleanupPreview = z.infer<typeof CleanupPreviewSchema>;

// --- commands ---------------------------------------------------------

export const ipc = {
  getSettings: () => invoke("get_settings").then((v) => SettingsSchema.parse(v)),
  saveSettings: (settings: Settings) => invoke<void>("save_settings", { settings }),
  setApiKey: (key: string) => invoke<void>("set_api_key", { key }),
  clearApiKey: () => invoke<void>("clear_api_key"),
  setAiKey: (key: string) => invoke<void>("set_ai_key", { key }),
  clearAiKey: () => invoke<void>("clear_ai_key"),
  testAi: () => invoke("test_ai").then((v) => z.string().parse(v)),
  cleanupPreview: (text: string) =>
    invoke("cleanup_preview", { text }).then((v) => CleanupPreviewSchema.parse(v)),
  transcribeFile: () => invoke<void>("transcribe_file"),
  listModels: () => invoke("list_models").then((v) => ModelInfoListSchema.parse(v)),
  downloadModel: (name: string) => invoke<void>("download_model", { name }),
  cancelDownload: (name: string) => invoke<void>("cancel_download", { name }),
  deleteModel: (name: string) => invoke<void>("delete_model", { name }),
  listInputDevices: () =>
    invoke("list_input_devices").then((v) => InputDeviceListSchema.parse(v)),
  testRemote: () => invoke("test_remote").then((v) => z.string().parse(v)),
  getHistory: () => invoke("get_history").then((v) => HistoryEntryListSchema.parse(v)),
  deleteHistoryEntry: (id: string) => invoke<void>("delete_history_entry", { id }),
  clearHistory: () => invoke<void>("clear_history"),
  copyText: (text: string) => invoke<void>("copy_text", { text }),
  startDictation: () => invoke<void>("start_dictation"),
  stopDictation: () => invoke<void>("stop_dictation"),
  cancelDictation: () => invoke<void>("cancel_dictation"),
  getStatus: () => invoke("get_status").then((v) => StatusSchema.parse(v)),
  openDataDir: () => invoke<void>("open_data_dir"),
  // Pill dismissal is owned by Rust: hovering the transcript bubble holds the
  // pending auto-hide, releasing it resumes with a short grace period.
  holdPill: (hold: boolean) => invoke<void>("hold_pill", { hold }),
};

// --- events -------------------------------------------------------------

export function onDictationState(
  cb: (e: DictationStateEvent) => void,
): Promise<UnlistenFn> {
  return listen("dictation://state", (e) => {
    const parsed = DictationStateEventSchema.safeParse(e.payload);
    if (!parsed.success) {
      console.warn("dictation://state rejected", parsed.error, e.payload);
      return;
    }
    cb(parsed.data);
  });
}

export function onDictationLevel(
  cb: (e: DictationLevelEvent) => void,
): Promise<UnlistenFn> {
  return listen("dictation://level", (e) =>
    cb(DictationLevelEventSchema.parse(e.payload)),
  );
}

export function onModelsProgress(
  cb: (e: DownloadProgress) => void,
): Promise<UnlistenFn> {
  return listen("models://progress", (e) =>
    cb(DownloadProgressSchema.parse(e.payload)),
  );
}

export function onModelsDone(cb: (e: DownloadDone) => void): Promise<UnlistenFn> {
  return listen("models://done", (e) => cb(DownloadDoneSchema.parse(e.payload)));
}

export function onHistoryChanged(cb: () => void): Promise<UnlistenFn> {
  return listen("history://changed", () => cb());
}

export function onSettingsChanged(cb: () => void): Promise<UnlistenFn> {
  return listen("settings://changed", () => cb());
}

export const isTauri = () => "__TAURI_INTERNALS__" in window;
