import { useEffect, useState } from "react";
import type { Settings, Status } from "../lib/ipc";
import { api } from "../lib/api";
import { CardTitle, KeyCombo, SectionHeader } from "../components/ui";

const SHORTCUTS: [string, string][] = [
  ["Ctrl Shift Space", "Start / stop dictation (anywhere)"],
  ["Esc", "Cancel while recording or transcribing (anywhere)"],
  ["Ctrl 1 … Ctrl 7", "Switch section"],
  ["Ctrl F", "Filter history"],
  ["Ctrl W", "Hide window to tray"],
  ["Enter", "Expand history row / add or save a dictionary entry"],
  ["R", "Toggle raw peek on focused history row"],
  ["Ctrl C", "Copy focused history / dictionary row"],
  ["Delete", "Delete focused history / dictionary row"],
];

function cleanupSummary(settings: Settings): string {
  if (settings.cleanup === "off") return "Off";
  if (settings.cleanup === "basic") return "Basic";
  const host = settings.ai.baseUrl.replace(/^https?:\/\//, "");
  return `AI · ${settings.ai.model || "?"} @ ${host}`;
}

export function About({ settings, status }: { settings: Settings; status: Status }) {
  const [modelsSummary, setModelsSummary] = useState("Loading…");

  useEffect(() => {
    api.listModels().then((models) => {
      const downloaded = models.filter((m) => m.downloaded);
      const totalMb = downloaded.reduce((sum, m) => sum + m.sizeMb, 0);
      const gb = (totalMb / 1000).toFixed(1);
      setModelsSummary(`${downloaded.length} downloaded · ${gb} GB`);
    });
  }, []);

  return (
    <>
      <SectionHeader title="About" />
      <dl className="about-list">
        <div className="about-row">
          <dt>Version</dt>
          <dd className="mono">0.1.0</dd>
        </div>
        <div className="about-row">
          <dt>Data folder</dt>
          <dd className="mono">
            <button type="button" className="link-button" onClick={() => api.openDataDir()}>
              Open folder
            </button>
          </dd>
        </div>
        <div className="about-row">
          <dt>Models</dt>
          <dd className="mono">{modelsSummary}</dd>
        </div>
        <div className="about-row">
          <dt>Cleanup</dt>
          <dd>{cleanupSummary(settings)}</dd>
        </div>
        <div className="about-row">
          <dt>Dictionary</dt>
          <dd>
            {settings.dictionary.length} {settings.dictionary.length === 1 ? "entry" : "entries"}
          </dd>
        </div>
        <div className="about-row">
          <dt>Last error</dt>
          <dd className="mono about-last-error">{status.lastError ?? "None"}</dd>
        </div>
      </dl>

      <CardTitle>Shortcuts</CardTitle>
      <div className="shortcuts-table">
        {SHORTCUTS.map(([combo, desc]) => (
          <div className="shortcuts-row" key={combo}>
            <KeyCombo combo={combo === "Ctrl Shift Space" ? settings.hotkey : combo} />
            <span>{desc}</span>
          </div>
        ))}
      </div>
    </>
  );
}
