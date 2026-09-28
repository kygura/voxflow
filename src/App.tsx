import { useCallback, useEffect, useRef, useState } from "react";
import { api, events, isTauri } from "./lib/api";
import type { Settings, Status } from "./lib/ipc";
import { Banner } from "./components/ui";
import { Sidebar } from "./components/ui";
import { General } from "./sections/General";
import { Transcription } from "./sections/Transcription";
import { Cleanup } from "./sections/Cleanup";
import { Playground } from "./sections/Playground";
import { History } from "./sections/History";
import { About } from "./sections/About";
import { applyTheme } from "./lib/theme";

type Section = "general" | "transcription" | "cleanup" | "playground" | "history" | "about";
const SECTIONS: Section[] = ["general", "transcription", "cleanup", "playground", "history", "about"];

export default function App() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [section, setSection] = useState<Section>("general");
  const [bannerDismissed, setBannerDismissed] = useState(false);
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
        if (e.state === "error") setBannerDismissed(false);
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
      if (["1", "2", "3", "4", "5", "6"].includes(e.key)) {
        e.preventDefault();
        goToSection(SECTIONS[Number(e.key) - 1]);
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

  const saveSettings = async (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    try {
      await api.saveSettings(next);
      return true;
    } catch (err) {
      setSettings(await api.getSettings());
      setStatus((prev) => (prev ? { ...prev, lastError: String(err) } : prev));
      setBannerDismissed(false);
      return false;
    }
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
        hotkey={settings.hotkey}
        onTranscribeFile={() => api.transcribeFile()}
        onPreviewOverlay={() => api.previewOverlay()}
      />
      <main className="content-column">
        {status.lastError && !bannerDismissed && (
          <Banner
            variant="error"
            title="Transcription failed"
            body={status.lastError}
            onDismiss={() => setBannerDismissed(true)}
          />
        )}
        {section === "general" && <General settings={settings} onSave={saveSettings} />}
        {section === "transcription" && (
          <Transcription settings={settings} onSave={saveSettings} hasApiKey={status.hasApiKey} />
        )}
        {section === "cleanup" && (
          <Cleanup settings={settings} onSave={saveSettings} hasAiKey={status.hasAiKey} />
        )}
        {section === "playground" && <Playground />}
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
