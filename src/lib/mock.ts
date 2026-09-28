// In-memory mock of the Tauri IPC surface, used ONLY when the app is opened
// in a plain browser (no __TAURI_INTERNALS__) so the UI can be visually
// verified without the Rust backend. Never imported by real builds' hot path
// beyond the isTauri() check in api.ts.
import type {
  Backend,
  CleanupPreview,
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
  cleanup: "basic",
  cleanupInstructions: "",
  ai: { baseUrl: "http://localhost:11434/v1", model: "llama3.2" },
  pasteLastHotkey: "Alt+Shift+Z",
  dictionary: [{ from: "vox flow", to: "VoxFlow" }],
  sounds: false,
};

let apiKeySaved = false;
let aiKeySaved = false;

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
    raw: "remember to, uh, send the the invoice before Friday",
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

// Pill dismissal (DESIGN.md §2.3/§2.9) is owned by the backend, not the pill's
// own JS. There is no real backend in a browser preview, so the mock
// reproduces the same auto-hide timing and the hold/release behaviour that
// `hold_pill` drives on the Rust side.
const AUTO_HIDE_MS: Record<"done:pasted" | "done:copied" | "done:ai-fallback" | "error", number> = {
  "done:pasted": 2200,
  "done:copied": 2600,
  "done:ai-fallback": 3000,
  error: 3500,
};
let autoHideTimer: ReturnType<typeof setTimeout> | null = null;
let autoHideHeld = false;

function hideKeyFor(state: "done" | "error", message?: string): keyof typeof AUTO_HIDE_MS {
  if (state === "error") return "error";
  if (message?.includes("AI cleanup failed")) return "done:ai-fallback";
  return message === "Copied" ? "done:copied" : "done:pasted";
}

function scheduleAutoHide(state: "done" | "error", message?: string) {
  if (autoHideTimer) clearTimeout(autoHideTimer);
  autoHideHeld = false;
  autoHideTimer = setTimeout(() => emitState({ state: "idle" }), AUTO_HIDE_MS[hideKeyFor(state, message)]);
}

function cancelAutoHide() {
  if (autoHideTimer) clearTimeout(autoHideTimer);
  autoHideTimer = null;
  autoHideHeld = false;
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
  }, 25);
}

// ponytail: mock-only synthetic envelope; the real backend streams the actual
// bundled clip's levels (SPEC.md v3 "Real audio everywhere").
/** Speech-like envelope: bursts separated by brief pauses, ~40 Hz (SPEC v3). */
function startSyntheticSpeechLevel() {
  stopLevelStream();
  let t = 0;
  levelTimer = setInterval(() => {
    t += 25;
    const phase = (t % 900) / 900; // burst/pause cycle
    const inBurst = phase < 0.65;
    const level = inBurst ? 0.25 + Math.random() * 0.65 : Math.random() * 0.08;
    levelListeners.forEach((cb) => cb({ level }));
  }, 25);
}

// DESIGN.md §6 demo sample: raw transcript -> cleaned transcript. Matches
// src-tauri/src/dictation.rs DEMO_RAW and core/src/audio.rs DEMO_CLIP_TEXT
// (the bundled demo clip's actual sentence, docs/ASSETS.md).
const DEMO_RAW =
  "um the work wasn't uh finished at 11:00 p.m. Friday, so they they decided to carry it over to the following Monday.";
const DEMO_TEXT =
  "The work wasn't finished at 11:00 p.m. Friday, so they decided to carry it over to the following Monday.";
// ?state=done&long=1 — a 6-line sample to verify the bubble's 4-line clamp.
const DEMO_LONG_TEXT =
  "So I think we should ship the new build on Friday, no wait, actually Monday " +
  "makes more sense given the QA backlog. Let me check with the team first and " +
  "get back to you about the exact timeline once I know how testing is going, " +
  "because I don't want to commit to a date we can't actually hit this time.";

let demoTimer: ReturnType<typeof setTimeout> | null = null;
function runDemoSequence() {
  cancelAutoHide();
  if (demoTimer) clearTimeout(demoTimer);
  emitState({ state: "recording", mode: "toggle" });
  startSyntheticSpeechLevel();
  demoTimer = setTimeout(() => {
    stopLevelStream();
    emitState({ state: "transcribing" });
    demoTimer = setTimeout(() => {
      emitState({ state: "cleaning" });
      demoTimer = setTimeout(() => {
        emitState({ state: "done", message: "Pasted", text: DEMO_TEXT, raw: DEMO_RAW });
        scheduleAutoHide("done", "Pasted");
      }, 900);
    }, 1200);
  }, 4000);
}

/** ponytail: mock-only filler/stutter strip, real cleanup lives in voxflow-core::cleanup (Rust). */
function mockBasicCleanup(raw: string): string {
  let s = raw.trim();
  s = s.replace(/\b(um+|uh+|erm+|hmm+)\b[,]?/gi, " ");
  s = s.replace(/\b(\w+)([,]?\s+\1\b)+/gi, "$1"); // collapse immediate stutters
  s = s.replace(/\s+/g, " ").trim();
  if (s) s = s[0].toUpperCase() + s.slice(1);
  if (s && !/[.!?]$/.test(s)) s += ".";
  return s;
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
  setAiKey: async () => {
    aiKeySaved = true;
  },
  clearAiKey: async () => {
    aiKeySaved = false;
  },
  testAi: async () => {
    await new Promise((r) => setTimeout(r, 400));
    if (!settings.ai.baseUrl) throw "Base URL is empty";
    return "Connected (mock)";
  },
  cleanupPreview: async (text: string): Promise<CleanupPreview> => {
    const basic = mockBasicCleanup(text) || "(empty)";
    if (!aiKeySaved && !settings.ai.baseUrl.includes("localhost")) {
      return { basic, aiError: "No AI key saved (mock)" };
    }
    return { basic, ai: mockBasicCleanup(text) };
  },
  transcribeFile: async () => {
    // ponytail: mock has no file picker; just runs the transcribing → cleaning →
    // done sequence a real file transcription goes through, same as stopDictation.
    cancelAutoHide();
    emitState({ state: "transcribing" });
    setTimeout(() => {
      emitState({ state: "cleaning" });
      setTimeout(() => {
        history = [
          {
            id: String(Date.now()),
            text: DEMO_TEXT,
            raw: DEMO_RAW,
            createdAt: Date.now(),
            backend: settings.backend,
            model: settings.backend === "local" ? settings.localModel : settings.remote.model,
            durationMs: 1800,
          },
          ...history,
        ];
        emitHistoryChanged();
        emitState({ state: "done", message: "Copied", text: DEMO_TEXT, raw: DEMO_RAW });
        scheduleAutoHide("done", "Copied");
      }, 900);
    }, 900);
  },
  previewOverlay: async () => {
    runDemoSequence();
  },
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
    cancelAutoHide();
    emitState({ state: "recording", mode: "toggle" });
    startLevelStream();
  },
  stopDictation: async () => {
    cancelAutoHide();
    stopLevelStream();
    emitState({ state: "transcribing" });
    setTimeout(() => {
      emitState({ state: "cleaning" });
      setTimeout(() => {
        const backend: Backend = settings.backend;
        const raw = "so uh this is a mock mock transcription result";
        const text = mockBasicCleanup(raw);
        history = [
          {
            id: String(Date.now()),
            text,
            raw,
            createdAt: Date.now(),
            backend,
            model: backend === "local" ? settings.localModel : settings.remote.model,
            durationMs: 1800,
          },
          ...history,
        ];
        emitHistoryChanged();
        const message = settings.autoPaste ? "Pasted" : "Copied";
        emitState({ state: "done", message, text, raw });
        scheduleAutoHide("done", message);
      }, 500);
    }, 900);
  },
  cancelDictation: async () => {
    cancelAutoHide();
    stopLevelStream();
    if (demoTimer) clearTimeout(demoTimer);
    emitState({ state: "idle" });
  },
  getStatus: async (): Promise<Status> => ({
    state: "idle",
    lastError,
    hasApiKey: apiKeySaved,
    hasAiKey: aiKeySaved,
  }),
  openDataDir: async () => {},
  // Mirrors the Rust `hold_pill` command: hovering the bubble holds the
  // pending auto-hide; releasing resumes it with a 1200ms grace period.
  holdPill: async (hold: boolean) => {
    if (hold) {
      autoHideHeld = true;
      if (autoHideTimer) {
        clearTimeout(autoHideTimer);
        autoHideTimer = null;
      }
    } else if (autoHideHeld) {
      autoHideHeld = false;
      autoHideTimer = setTimeout(() => emitState({ state: "idle" }), 1200);
    }
  },
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
  onSettingsChanged: async () => () => {},
};

/** Used only by pill.tsx?state= to force a visual state without a full flow. */
export function forceDictationState(
  state: DictationStateEvent["state"],
  message?: string,
  mode?: DictationStateEvent["mode"],
  opts?: { warmup?: boolean; long?: boolean; flash?: boolean },
) {
  cancelAutoHide();
  stopLevelStream();
  if (state === "done") {
    const text = opts?.long ? DEMO_LONG_TEXT : DEMO_TEXT;
    const raw = opts?.flash ? undefined : DEMO_RAW;
    emitState({ state, message, mode, text, raw });
    scheduleAutoHide("done", message);
  } else {
    emitState({ state, message, mode });
    if (state === "error") scheduleAutoHide("error", message);
  }
  // ?warmup=1: stay in the warm-up dots — never emit a level event.
  if (state === "recording" && !opts?.warmup) startSyntheticSpeechLevel();
}

/** Used only by pill.tsx?demo=1 to run the full recording→idle loop. */
export function startDemoLoop() {
  runDemoSequence();
}

export function setMockLastError(msg: string) {
  lastError = msg;
}
