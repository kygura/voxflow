import { useCallback, useEffect, useRef, useState } from "react";
import { api, events, isTauri } from "./lib/api";
import type { Settings, Status } from "./lib/ipc";
import { Banner } from "./components/ui";
import { Sidebar } from "./components/ui";
import { General } from "./sections/General";
import { Transcription } from "./sections/Transcription";
import { Cleanup } from "./sections/Cleanup";
import { Dictionary } from "./sections/Dictionary";
import { Playground } from "./sections/Playground";
import { History } from "./sections/History";
import { About } from "./sections/About";
import { applyTheme } from "./lib/theme";

const SECTIONS = [
  "general",
  "transcription",
  "cleanup",
  "dictionary",
  "playground",
  "history",
  "about",
] as const;
type Section = (typeof SECTIONS)[number];

export default function App() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [section, setSection] = useState<Section>("general");
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [bannerTitle, setBannerTitle] = useState("Transcription failed");
  const historyFilterRef = useRef<HTMLInputElement | null>(null);
  const [historyFocusFilterToken, setHistoryFocusFilterToken] = useState(0);

  useEffect(() => {
    api.getSettings().then((s) => {
      setSettings(s);
      applyTheme(s.theme);
    });
    api.getStatus().then(setStatus);
  }, []);

  useEffect(() => {
    if (!settings) return;
    applyTheme(settings.theme);
    if (settings.theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [settings?.theme]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initial = params.get("section");
    if (initial && SECTIONS.includes(initial as Section)) setSection(initial as Section);
  }, []);

  useEffect(() => {
    let unlistenState: (() => void) | undefined;
    events
      .onDictationState((e) => {
        setStatus((prev) => ({
          state: e.state,
          message: e.message,
          lastError: e.state === "error" ? e.message : prev?.lastError,
          hasApiKey: prev?.hasApiKey ?? false,
          hasAiKey: prev?.hasAiKey ?? false,
        }));
        if (e.state === "error") {
          setBannerTitle("Transcription failed");
          setBannerDismissed(false);
        }
      })
      .then((u) => (unlistenState = u));
    return () => unlistenState?.();
  }, []);

  const goToSection = useCallback((s: Section) => {
    setSection(s);
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(".section-header h1")?.focus();
    });
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      const n = Number(e.key);
      if (n >= 1 && n <= SECTIONS.length) {
        e.preventDefault();
        goToSection(SECTIONS[n - 1]);
      } else if (e.key.toLowerCase() === "f") {
        e.preventDefault();
        setSection("history");
        setHistoryFocusFilterToken((t) => t + 1);
      } else if (e.key.toLowerCase() === "w") {
        e.preventDefault();
        if (isTauri()) {
          import("@tauri-apps/api/window").then(({ getCurrentWindow }) =>
            getCurrentWindow().hide(),
          );
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goToSection]);

  if (!settings || !status) {
    return <div className="app-loading" aria-busy="true" />;
  }

  /** Surfaces any non-dictation failure (settings save, file transcribe, preview
   * overlay, playground run) in the same error banner, generically titled since
   * it isn't a dictation-flow "Transcription failed". */
  const surfaceError = (message: string) => {
    setStatus((prev) => (prev ? { ...prev, lastError: message } : prev));
    setBannerTitle("Something failed");
    setBannerDismissed(false);
  };

  const refreshStatus = () => {
    api.getStatus().then(setStatus);
  };

  const saveSettings = async (patch: Partial<Settings>): Promise<boolean | string> => {
    const next = { ...settings, ...patch };
    setSettings(next);
    try {
      await api.saveSettings(next);
      return true;
    } catch (err) {
      setSettings(await api.getSettings());
      const message = String(err);
      surfaceError(message);
      return message;
    }
  };

  const transcribeFile = () => {
    api.transcribeFile().catch((err) => surfaceError(String(err)));
  };

  const dictationStatus: "idle" | "recording" | "transcribing" | "cleaning" =
    status.state === "recording" || status.state === "transcribing" || status.state === "cleaning"
      ? status.state
      : "idle";

  return (
    <div className="app-shell">
      <Sidebar
        active={section}
        onSelect={(s) => goToSection(s as Section)}
        status={dictationStatus}
        fileStatus={status.state}
        hotkey={settings.hotkey}
        onTranscribeFile={transcribeFile}
      />
      <main className="content-column">
        {status.lastError && !bannerDismissed && (
          <Banner
            variant="error"
            title={bannerTitle}
            body={status.lastError}
            onDismiss={() => setBannerDismissed(true)}
          />
        )}
        {section === "general" && <General settings={settings} onSave={saveSettings} />}
        {section === "transcription" && (
          <Transcription
            settings={settings}
            onSave={saveSettings}
            hasApiKey={status.hasApiKey}
            onApiKeyChange={refreshStatus}
          />
        )}
        {section === "cleanup" && (
          <Cleanup
            settings={settings}
            onSave={saveSettings}
            hasAiKey={status.hasAiKey}
            onAiKeyChange={refreshStatus}
            onOpenDictionary={() => goToSection("dictionary")}
          />
        )}
        {section === "dictionary" && <Dictionary settings={settings} onSave={saveSettings} />}
        {section === "playground" && <Playground settings={settings} onError={surfaceError} />}
        {section === "history" && (
          <History
            focusFilterToken={historyFocusFilterToken}
            saveHistoryEnabled={settings.saveHistory}
            hotkey={settings.hotkey}
            onGoToGeneral={() => goToSection("general")}
            filterInputRef={historyFilterRef}
          />
        )}
        {section === "about" && <About settings={settings} status={status} />}
      </main>
    </div>
  );
}
