// DESIGN.md §3.6 — paste raw text, compare Basic vs AI cleanup output.
import { useState } from "react";
import { api } from "../lib/api";
import type { CleanupPreview } from "../lib/ipc";
import { Button, Card, SectionHeader, Textarea } from "../components/ui";
import { Copy } from "../components/icons";

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function counterLabel(raw: string, out: string | undefined): string {
  if (out === undefined) return "";
  if (raw.trim() === out.trim()) return "UNCHANGED";
  const n = wordCount(raw) - wordCount(out);
  return n >= 1 ? `−${n} WORDS` : "EDITED";
}

export function Playground() {
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<CleanupPreview | null>(null);
  const [copied, setCopied] = useState<"basic" | "ai" | null>(null);

  const run = async () => {
    if (!input.trim() || running) return;
    setRunning(true);
    try {
      setResult(await api.cleanupPreview(input));
    } finally {
      setRunning(false);
    }
  };

  const copy = async (which: "basic" | "ai", text: string) => {
    await api.copyText(text);
    setCopied(which);
    setTimeout(() => setCopied((c) => (c === which ? null : c)), 1200);
  };

  return (
    <>
      <SectionHeader title="Playground" subtitle="Paste a raw transcript and compare cleanup outputs." />

      <Textarea
        mono
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="um so I I think we should, uh, ship it on on friday"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) run();
        }}
      />
      <div className="playground-run-row">
        <span className="key-combo key-combo--xs">
          <span className="key-cap">Ctrl</span>
          <span className="key-cap">Enter</span>
        </span>
        <Button variant="primary" disabled={!input.trim()} loading={running} onClick={run}>
          {running ? "Running…" : "Run"}
        </Button>
      </div>

      <div className="playground-columns">
        <Card>
          <div className="box-eyebrow-row">
            <h2 className="box-eyebrow">Basic</h2>
            {result && (
              <Button variant="icon" aria-label="Copy basic output" onClick={() => copy("basic", result.basic)}>
                <Copy size={14} />
              </Button>
            )}
          </div>
          <p className={`playground-column-body${result ? "" : " playground-column-body--muted"}`}>
            {result ? result.basic : "—"}
          </p>
          {result && (
            <p className="playground-column-counter">
              {copied === "basic" ? "COPIED" : counterLabel(input, result.basic)}
            </p>
          )}
        </Card>

        <Card>
          <div className="box-eyebrow-row">
            <h2 className={`box-eyebrow${result?.aiError ? " box-eyebrow--err" : ""}`}>
              {result?.aiError ? "AI · FAILED" : "AI"}
            </h2>
            {result?.ai && (
              <Button variant="icon" aria-label="Copy AI output" onClick={() => copy("ai", result.ai!)}>
                <Copy size={14} />
              </Button>
            )}
          </div>
          {result?.aiError ? (
            <>
              <p className="playground-column-body--err-msg">{result.aiError}</p>
              <p className="playground-column-body--err-note">Basic output would be used.</p>
            </>
          ) : (
            <p className={`playground-column-body${result?.ai ? "" : " playground-column-body--muted"}`}>
              {result?.ai ?? "—"}
            </p>
          )}
          {result?.ai && (
            <p className="playground-column-counter">
              {copied === "ai" ? "COPIED" : counterLabel(input, result.ai)}
            </p>
          )}
        </Card>
      </div>
    </>
  );
}
