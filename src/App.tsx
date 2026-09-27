import { useCallback, useEffect, useRef, useState } from "react";
import { api, events, isTauri } from "./lib/api";
import type { Settings, Status } from "./lib/ipc";
import { Banner } from "./components/ui";
import { Sidebar } from "./components/ui";
import { General } from "./sections/General";
import { Transcription } from "./sections/Transcription";
import { History } from "./sections/History";
import { About } from "./sections/About";

type Section = "general" | "transcription" | "history" | "about";
const SECTIONS: Section[] = ["general", "transcription", "history", "about"];

function applyTheme(theme: Settings["theme"]) {
  const resolved =
    theme === "system"
      ? window.matchMedia("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark"
      : theme;
  document.documentElement.dataset.theme = resolved;
}

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
    let unlisten: (() => void) | undefined;
    events.onNavigate((e) => setSection(e.section as Section)).then((u) => (unlisten = u));
    const params = new URLSearchParams(window.location.search);
    const initial = params.get("section");
    if (initial && SECTIONS.includes(initial as Section)) setSection(initial as Section);
    return () => unlisten?.();
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
      if (["1", "2", "3", "4"].includes(e.key)) {
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
      setSettings(settings); // revert
      setStatus((prev) => (prev ? { ...prev, lastError: String(err) } : prev));
      setBannerDismissed(false);
      return false;
    }
  };

  const dictationStatus: "idle" | "recording" | "transcribing" =
    status.state === "recording" || status.state === "transcribing" ? status.state : "idle";

  return (
    <div className="app-shell">
      <Sidebar active={section} onSelect={(s) => goToSection(s as Section)} status={dictationStatus} hotkey={settings.hotkey} />
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
