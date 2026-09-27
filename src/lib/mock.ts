// In-memory mock of the Tauri IPC surface, used ONLY when the app is opened
// in a plain browser (no __TAURI_INTERNALS__) so the UI can be visually
// verified without the Rust backend. Never imported by real builds' hot path
// beyond the isTauri() check in api.ts.
import type {
  Backend,
  DictationLevelEvent,
  DictationStateEvent,
  DownloadDone,
  DownloadProgress,
  HistoryEntry,
  ModelInfo,
  Settings,
  Status,
} from "./ipc";

let settings: Settings = {
  hotkey: "CommandOrControl+Shift+Space",
  hotkeyMode: "hybrid",
  backend: "local",
  localModel: "base",
  remote: { baseUrl: "", model: "" },
  language: "auto",
  inputDevice: null,
  autoPaste: true,
  restoreClipboard: true,
  saveHistory: true,
  theme: "system",
};

let apiKeySaved = false;

const CATALOG: { name: string; sizeMb: number; englishOnly: boolean }[] = [
  { name: "tiny.en", sizeMb: 75, englishOnly: true },
  { name: "base.en", sizeMb: 142, englishOnly: true },
  { name: "base", sizeMb: 142, englishOnly: false },
  { name: "small", sizeMb: 466, englishOnly: false },
  { name: "medium", sizeMb: 1500, englishOnly: false },
];
const downloaded = new Set(["base"]);
let downloading: { name: string; downloaded: number; total: number } | null = null;

let history: HistoryEntry[] = [
  {
    id: "1",
    text: "The quick brown fox jumped over the lazy dog and kept going for quite a while.",
    createdAt: Date.now() - 2 * 60_000,
    backend: "local",
    model: "base",
    durationMs: 4200,
  },
  {
    id: "2",
    text: "Remember to send the invoice before Friday.",
    createdAt: Date.now() - 3 * 3_600_000,
    backend: "local",
    model: "base",
    durationMs: 2100,
  },
];

let lastError: string | undefined;

type Listener<T> = (e: T) => void;
const stateListeners = new Set<Listener<DictationStateEvent>>();
const levelListeners = new Set<Listener<DictationLevelEvent>>();
const progressListeners = new Set<Listener<DownloadProgress>>();
const doneListeners = new Set<Listener<DownloadDone>>();
const historyListeners = new Set<Listener<void>>();

function emitState(e: DictationStateEvent) {
  stateListeners.forEach((cb) => cb(e));
}
function emitHistoryChanged() {
  historyListeners.forEach((cb) => cb());
}

let levelTimer: ReturnType<typeof setInterval> | null = null;
function stopLevelStream() {
  if (levelTimer) clearInterval(levelTimer);
  levelTimer = null;
}
function startLevelStream() {
  stopLevelStream();
  levelTimer = setInterval(() => {
    const level = Math.random() * (Math.random() > 0.15 ? 0.9 : 0.15);
    levelListeners.forEach((cb) => cb({ level }));
  }, 33);
}

export const mockApi = {
  getSettings: async () => settings,
  saveSettings: async (s: Settings) => {
    settings = s;
  },
  setApiKey: async () => {
    apiKeySaved = true;
  },
  clearApiKey: async () => {
    apiKeySaved = false;
  },
  hasApiKey: async () => apiKeySaved,
  listModels: async (): Promise<ModelInfo[]> =>
    CATALOG.map((m) => ({
      name: m.name,
      sizeMb: m.sizeMb,
      englishOnly: m.englishOnly,
      downloaded: downloaded.has(m.name),
    })),
  downloadModel: async (name: string) => {
    downloading = { name, downloaded: 0, total: CATALOG.find((m) => m.name === name)!.sizeMb * 1_000_000 };
    const timer = setInterval(() => {
      if (!downloading || downloading.name !== name) {
        clearInterval(timer);
        return;
      }
      downloading.downloaded = Math.min(
        downloading.total,
        downloading.downloaded + downloading.total / 12,
      );
      progressListeners.forEach((cb) => cb({ ...downloading! }));
      if (downloading.downloaded >= downloading.total) {
        clearInterval(timer);
        downloaded.add(name);
        downloading = null;
        doneListeners.forEach((cb) => cb({ name }));
      }
    }, 250);
  },
  cancelDownload: async (name: string) => {
    downloading = null;
    doneListeners.forEach((cb) => cb({ name, error: "cancelled" }));
  },
  deleteModel: async (name: string) => {
    downloaded.delete(name);
    if (settings.localModel === name) settings.localModel = "";
  },
  listInputDevices: async () => ["System default", "Built-in Microphone", "USB Headset"],
  testRemote: async () => {
    await new Promise((r) => setTimeout(r, 400));
    if (!settings.remote.baseUrl) throw "Base URL is empty";
    return "Connected (128 ms)";
  },
  getHistory: async () => history,
  deleteHistoryEntry: async (id: string) => {
    history = history.filter((h) => h.id !== id);
    emitHistoryChanged();
  },
  clearHistory: async () => {
    history = [];
    emitHistoryChanged();
  },
  copyText: async () => {},
  startDictation: async () => {
    emitState({ state: "recording" });
    startLevelStream();
  },
  stopDictation: async () => {
    stopLevelStream();
    emitState({ state: "transcribing" });
    setTimeout(() => {
      const backend: Backend = settings.backend;
      history = [
        {
          id: String(Date.now()),
          text: "Mock transcription result.",
          createdAt: Date.now(),
          backend,
          model: backend === "local" ? settings.localModel : settings.remote.model,
          durationMs: 1800,
        },
        ...history,
      ];
      emitHistoryChanged();
      emitState({ state: "done", message: settings.autoPaste ? "Pasted" : "Copied" });
    }, 900);
  },
  cancelDictation: async () => {
    stopLevelStream();
    emitState({ state: "idle" });
  },
  getStatus: async (): Promise<Status> => ({
    state: "idle",
    lastError,
    hasApiKey: apiKeySaved,
  }),
  openDataDir: async () => {},
};

export const mockEvents = {
  onDictationState: async (cb: Listener<DictationStateEvent>) => {
    stateListeners.add(cb);
    return () => stateListeners.delete(cb);
  },
  onDictationLevel: async (cb: Listener<DictationLevelEvent>) => {
    levelListeners.add(cb);
    return () => levelListeners.delete(cb);
  },
  onModelsProgress: async (cb: Listener<DownloadProgress>) => {
    progressListeners.add(cb);
    return () => progressListeners.delete(cb);
  },
  onModelsDone: async (cb: Listener<DownloadDone>) => {
    doneListeners.add(cb);
    return () => doneListeners.delete(cb);
  },
  onHistoryChanged: async (cb: Listener<void>) => {
    historyListeners.add(cb);
    return () => historyListeners.delete(cb);
  },
  onNavigate: async () => () => {},
};

/** Used only by pill.tsx?demo to force a visual state without a full flow. */
export function forceDictationState(state: DictationStateEvent["state"], message?: string) {
  if (state !== "recording") stopLevelStream();
  emitState({ state, message });
  if (state === "recording") startLevelStream();
}

export function setMockLastError(msg: string) {
  lastError = msg;
}
