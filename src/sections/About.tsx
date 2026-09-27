import { useEffect, useState } from "react";
import type { Settings, Status } from "../lib/ipc";
import { api } from "../lib/api";
import { CardTitle, KeyCombo, SectionHeader } from "../components/ui";

const SHORTCUTS: [string, string][] = [
  ["Ctrl Shift Space", "Start / stop dictation (anywhere)"],
  ["Esc", "Cancel while recording or transcribing (anywhere)"],
  ["Ctrl 1 … Ctrl 4", "Switch section"],
  ["Ctrl F", "Filter history"],
  ["Ctrl W", "Hide window to tray"],
  ["Enter", "Expand history row / activate control"],
  ["Delete", "Delete focused history row"],
];

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
          <dt>Last error</dt>
          <dd className="mono about-last-error">{status.lastError ?? "None"}</dd>
        </div>
      </dl>

      <CardTitle>Shortcuts</CardTitle>
      <div className="shortcuts-table">
        {SHORTCUTS.map(([combo, desc]) => (
          <div className="shortcuts-row" key={combo}>
            <KeyCombo combo={combo === "Ctrl Shift Space" ? hotkeyDisplay(settings.hotkey) : combo} />
            <span>{desc}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function hotkeyDisplay(hotkey: string) {
  return hotkey;
}
