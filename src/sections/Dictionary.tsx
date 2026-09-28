// DESIGN.md §3.6 — personal dictionary: whole-word, case-insensitive replacements
// applied to the raw transcript before cleanup (core/src/cleanup.rs::apply_dictionary).
import { useState } from "react";
import type { DictEntry, Settings } from "../lib/ipc";
import { api } from "../lib/api";
import { Button, EmptyState, Input, SectionHeader, useSavedFlash } from "../components/ui";
import { ArrowRight, Book, Trash } from "../components/icons";

const MAX = 200;
const WARN_AT = 190;

export function Dictionary({
  settings,
  onSave,
}: {
  settings: Settings;
  onSave: (patch: Partial<Settings>) => Promise<boolean>;
}) {
  const { saved, flash } = useSavedFlash();
  const [fromInput, setFromInput] = useState("");
  const [toInput, setToInput] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ index: number; field: "from" | "to" } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);

  const dict = settings.dictionary;

  const save = async (next: DictEntry[]) => {
    const ok = await onSave({ dictionary: next });
    if (ok) flash();
    return ok;
  };

  const addEntry = async () => {
    const from = fromInput.trim();
    if (!from) return;
    if (dict.length >= MAX) {
      setAddError(`Dictionary is full (${MAX}).`);
      return;
    }
    if (dict.some((e) => e.from.toLowerCase() === from.toLowerCase())) {
      setAddError("Already in the dictionary.");
      return;
    }
    setAddError(null);
    const ok = await save([{ from, to: toInput.trim() }, ...dict]);
    if (ok) {
      setFromInput("");
      setToInput("");
    }
  };

  const removeAt = (index: number) => {
    setDeletingIndex(index);
    setTimeout(() => {
      save(dict.filter((_, i) => i !== index));
      setDeletingIndex(null);
    }, 320);
  };

  const startEdit = (index: number, field: "from" | "to") => {
    setEditing({ index, field });
    setEditValue(dict[index][field]);
  };

  const commitEdit = () => {
    if (!editing) return;
    const { index, field } = editing;
    setEditing(null);
    const value = field === "to" ? editValue : editValue.trim();
    if (field === "from" && !value) return; // `from` can't be emptied by editing
    if (dict[index][field] === value) return; // nothing changed
    save(dict.map((e, i) => (i === index ? { ...e, [field]: value } : e)));
  };

  const cancelEdit = () => setEditing(null);

  const count = dict.length;

  return (
    <>
      <SectionHeader
        title="Dictionary"
        subtitle="Words VoxFlow always gets wrong, and what to write instead. Applied to the raw transcript before cleanup. Whole words, case-insensitive."
        right={saved ? <span className="saved-flash">Saved</span> : undefined}
      />

      <div className="dict-add">
        <Input
          placeholder="vox flow"
          aria-label="Heard as"
          value={fromInput}
          onChange={(e) => {
            setFromInput(e.target.value);
            setAddError(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && addEntry()}
        />
        <ArrowRight size={16} />
        <Input
          placeholder="VoxFlow"
          aria-label="Write"
          value={toInput}
          onChange={(e) => setToInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addEntry()}
        />
        <Button variant="primary" disabled={!fromInput.trim()} onClick={addEntry}>
          Add
        </Button>
      </div>
      {addError && <p className="field-helper field-helper--error dict-add-error">{addError}</p>}
      <p className={`dict-count${count >= WARN_AT ? " dict-count--err" : ""}`}>
        {count} of {MAX}
      </p>

      {count === 0 ? (
        <EmptyState
          icon={<Book size={28} />}
          title="No entries yet"
          body="Add a word that keeps coming out wrong, and what it should be."
        />
      ) : (
        <div className="dict-list" role="list">
          {dict.map((entry, index) => (
            <DictRow
              key={`${entry.from}-${index}`}
              entry={entry}
              deleting={deletingIndex === index}
              editing={editing?.index === index ? editing.field : null}
              editValue={editValue}
              onEditValueChange={setEditValue}
              onStartEdit={(field) => startEdit(index, field)}
              onCommitEdit={commitEdit}
              onCancelEdit={cancelEdit}
              onDelete={() => removeAt(index)}
              onCopy={() => api.copyText(`${entry.from} → ${entry.to}`)}
            />
          ))}
        </div>
      )}
    </>
  );
}

function DictRow({
  entry,
  deleting,
  editing,
  editValue,
  onEditValueChange,
  onStartEdit,
  onCommitEdit,
  onCancelEdit,
  onDelete,
  onCopy,
}: {
  entry: DictEntry;
  deleting: boolean;
  editing: "from" | "to" | null;
  editValue: string;
  onEditValueChange: (v: string) => void;
  onStartEdit: (field: "from" | "to") => void;
  onCommitEdit: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
  onCopy: () => void;
}) {
  const cell = (field: "from" | "to", className: string) => (
    <span className={`dict-cell${editing === field ? " dict-cell--editing" : ""}`}>
      {editing === field ? (
        <Input
          autoFocus
          value={editValue}
          onChange={(e) => onEditValueChange(e.target.value)}
          onBlur={onCommitEdit}
          onKeyDown={(e) => {
            if (e.key === "Enter") onCommitEdit();
            else if (e.key === "Escape") onCancelEdit();
          }}
        />
      ) : (
        <button type="button" className={className} onClick={() => onStartEdit(field)}>
          {entry[field]}
        </button>
      )}
    </span>
  );

  return (
    <div
      className={`dict-row${deleting ? " is-deleting" : ""}`}
      role="listitem"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Delete") onDelete();
        else if (e.key === "c" && (e.ctrlKey || e.metaKey)) onCopy();
      }}
    >
      {cell("from", "dict-cell-btn")}
      <ArrowRight size={14} />
      {cell("to", "dict-cell-btn dict-cell-btn--to")}
      <Button variant="icon" aria-label={`Remove ${entry.from}`} onClick={onDelete}>
        <Trash size={16} />
      </Button>
    </div>
  );
}
