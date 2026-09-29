// Facade: real Tauri IPC when running inside Tauri, in-memory mock otherwise.
import { ipc, isTauri, onDictationState, onDictationLevel, onModelsProgress, onModelsDone, onHistoryChanged, onSettingsChanged, onFileDrop } from "./ipc";
import { mockApi, mockEvents } from "./mock";

export const api = isTauri() ? ipc : mockApi;

export const events = isTauri()
  ? { onDictationState, onDictationLevel, onModelsProgress, onModelsDone, onHistoryChanged, onSettingsChanged, onFileDrop }
  : mockEvents;

export { isTauri };
