import { useEffect, useMemo, useState } from "react";
import type { HistoryEntry } from "../lib/ipc";
import { api, events } from "../lib/api";
import { relativeTime } from "../lib/time";
import {
  Button,
  EmptyState,
  FilterInput,
  InlineConfirm,
  SectionHeader,
  Skeleton,
  useDebouncedCallback,
} from "../components/ui";

export function History({
  focusFilterToken,
  saveHistoryEnabled,
  hotkey,
  onGoToGeneral,
  filterInputRef,
}: {
  focusFilterToken: number;
  saveHistoryEnabled: boolean;
  hotkey: string;
  onGoToGeneral: () => void;
  filterInputRef: React.MutableRefObject<HTMLInputElement | null>;
}) {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [filterInput, setFilterInput] = useState("");
  const [filter, setFilter] = useState("");
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const debouncedFilter = useDebouncedCallback((v: string) => setFilter(v), 120);

  const refresh = () => api.getHistory().then(setEntries);

  useEffect(() => {
    refresh();
    const un = events.onHistoryChanged(() => refresh());
    return () => {
      un.then((u) => u());
    };
  }, []);

  useEffect(() => {
    if (focusFilterToken === 0) return;
    const el = filterInputRef.current;
    if (el) {
      el.focus();
      el.select();
    }
  }, [focusFilterToken, filterInputRef]);

  const filtered = useMemo(() => {
    if (!entries) return [];
    if (!filter) return entries;
    const q = filter.toLowerCase();
    return entries.filter((e) => e.text.toLowerCase().includes(q));
  }, [entries, filter]);

  const copy = async (e: HistoryEntry) => {
    await api.copyText(e.text);
    setCopiedId(e.id);
    setTimeout(() => setCopiedId((c) => (c === e.id ? null : c)), 1200);
  };

  return (
    <>
      <SectionHeader
        title="History"
        right={
          <div className="history-header-controls">
            <FilterInput
              ref={filterInputRef}
              id="history-filter"
              value={filterInput}
              placeholder="Filter… (Ctrl+F)"
              onChange={(v) => {
                setFilterInput(v);
                debouncedFilter(v);
              }}
              onEscape={() => {
                if (filterInput) {
                  setFilterInput("");
                  setFilter("");
                } else {
                  filterInputRef.current?.blur();
                }
              }}
            />
            <Button variant="ghost" onClick={() => setConfirmClearAll(true)} disabled={!entries?.length}>
              Clear all
            </Button>
          </div>
        }
      />
      {confirmClearAll && (
        <InlineConfirm
          message={`Delete all ${entries?.length ?? 0} entries? This cannot be undone.`}
          confirmLabel="Delete all"
          onConfirm={async () => {
            await api.clearHistory();
            setConfirmClearAll(false);
          }}
          onCancel={() => setConfirmClearAll(false)}
        />
      )}

      {!saveHistoryEnabled ? (
        <EmptyState
          title="History is off"
          body='Turn on "Save history" in General to keep transcriptions.'
          action={
            <button type="button" className="link-button" onClick={onGoToGeneral}>
              Go to General
            </button>
          }
        />
      ) : entries === null ? (
        <Skeleton />
      ) : entries.length === 0 ? (
        <EmptyState title="Nothing yet" body={`Press ${hotkeyLabel(hotkey)} anywhere and start talking.`} />
      ) : filtered.length === 0 ? (
        <EmptyState title="No matches" body="Try a shorter word." />
      ) : (
        <div className="history-list" role="list">
          {filtered.map((e) => (
            <HistoryRow
              key={e.id}
              entry={e}
              query={filter}
              expanded={expanded === e.id}
              copied={copiedId === e.id}
              onToggleExpand={() => setExpanded((cur) => (cur === e.id ? null : e.id))}
              onCopy={() => copy(e)}
              onDelete={async () => {
                await api.deleteHistoryEntry(e.id);
              }}
            />
          ))}
        </div>
      )}
    </>
  );
}

function hotkeyLabel(hotkey: string) {
  return hotkey.replace(/CommandOrControl/g, "Ctrl").replace(/\+/g, "+");
}

function highlight(text: string, query: string) {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark>{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

function HistoryRow({
  entry,
  query,
  expanded,
  copied,
  onToggleExpand,
  onCopy,
  onDelete,
}: {
  entry: HistoryEntry;
  query: string;
  expanded: boolean;
  copied: boolean;
  onToggleExpand: () => void;
  onCopy: () => void;
  onDelete: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  return (
    <div
      className={`history-row${expanded ? " is-expanded" : ""}${deleting ? " is-deleting" : ""}`}
      role="listitem"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggleExpand();
        } else if (e.key === "Escape" && expanded) {
          onToggleExpand();
        } else if (e.key === "Delete") {
          setDeleting(true);
          setTimeout(onDelete, 180);
        } else if (e.key === "c" && (e.ctrlKey || e.metaKey)) {
          onCopy();
        }
      }}
    >
      <div className="history-row-main">
        <p className={`history-row-text${expanded ? "" : " is-clamped"}`}>
          {highlight(entry.text, query)}
        </p>
        <span className="history-row-time" title={new Date(entry.createdAt).toISOString()}>
          {relativeTime(entry.createdAt)}
        </span>
      </div>
      <div className="history-row-actions">
        <Button variant="icon" aria-label="Copy" onClick={onCopy}>
          {copied ? "✓" : "⧉"}
        </Button>
        <Button
          variant="icon"
          aria-label="Delete"
          onClick={() => {
            setDeleting(true);
            setTimeout(onDelete, 180);
          }}
        >
          🗑
        </Button>
      </div>
    </div>
  );
}
