// Shared UI primitives from DESIGN.md §5 component inventory.
import { forwardRef, useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { File, Play, Search, X } from "./icons";

export function Sidebar({
  active,
  onSelect,
  status,
  fileStatus,
  hotkey,
  onTranscribeFile,
  onPreviewOverlay,
}: {
  active: string;
  onSelect: (id: string) => void;
  status: "idle" | "recording" | "transcribing" | "cleaning";
  fileStatus: "idle" | "recording" | "transcribing" | "cleaning" | "done" | "error";
  hotkey: string;
  onTranscribeFile: () => void;
  onPreviewOverlay: () => void;
}) {
  const items: { id: string; label: string }[] = [
    { id: "general", label: "General" },
    { id: "transcription", label: "Transcription" },
    { id: "cleanup", label: "Cleanup" },
    { id: "dictionary", label: "Dictionary" },
    { id: "playground", label: "Playground" },
    { id: "history", label: "History" },
    { id: "about", label: "About" },
  ];

  const statusLabel =
    status === "idle" ? "Idle" : status === "recording" ? "Recording" : status === "cleaning" ? "Cleaning" : "Transcribing";

  // DESIGN.md §3.1: disabled while a dictation/transcription is actually in
  // flight; allowed again once it lands on idle, done or error.
  const canTranscribeFile = fileStatus === "idle" || fileStatus === "done" || fileStatus === "error";
  const isFileBusy = fileStatus === "transcribing" || fileStatus === "cleaning";

  return (
    <nav className="sidebar" aria-label="Sections">
      <div className="sidebar-brand">
        <span className="wordmark">VoxFlow</span>
      </div>
      <div className="sidebar-nav" role="list">
        {items.map((it, i) => (
          <button
            key={it.id}
            role="listitem"
            className={`sidebar-item${active === it.id ? " is-active" : ""}`}
            onClick={() => onSelect(it.id)}
            aria-current={active === it.id ? "page" : undefined}
          >
            <span className="sidebar-item-index">{i + 1}</span>
            <span className="sidebar-item-label">{it.label}</span>
          </button>
        ))}
      </div>
      <div className="sidebar-tools">
        <Button
          variant="secondary"
          className="sidebar-tool-btn"
          disabled={!canTranscribeFile}
          onClick={onTranscribeFile}
        >
          <File size={14} />
          {isFileBusy ? "Transcribing…" : "Transcribe file…"}
        </Button>
        <Button
          variant="secondary"
          className="sidebar-tool-btn"
          disabled={fileStatus === "recording"}
          onClick={onPreviewOverlay}
        >
          <Play size={14} />
          Preview overlay
        </Button>
      </div>
      <div className="sidebar-footer">
        <span className={`status-dot status-dot--${status}`} aria-hidden="true" />
        <span className="sidebar-footer-text">
          <span className="sidebar-status-label">{statusLabel}</span>
          <KeyCombo combo={hotkey} size="xs" />
        </span>
      </div>
    </nav>
  );
}

export function SectionHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <div className="section-header">
      <div className="section-header-row">
        <h1 tabIndex={-1}>{title}</h1>
        {right}
      </div>
      {subtitle && <p className="section-subtitle">{subtitle}</p>}
    </div>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return <div className="box">{children}</div>;
}

export function CardTitle({ children }: { children: ReactNode }) {
  return <h2 className="box-heading">{children}</h2>;
}

export function Field({
  label,
  helper,
  error,
  disabled,
  children,
}: {
  label: string;
  helper?: string;
  error?: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div className={`field${disabled ? " is-disabled" : ""}`}>
      <div className="field-label-col">
        <label htmlFor={id} className="field-label">
          {label}
        </label>
        {helper && !error && <p className="field-helper">{helper}</p>}
        {error && (
          <p className="field-helper field-helper--error" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="field-control">
        {/* children expected to accept an id via cloneElement-free convention: pass id as prop */}
        {children}
      </div>
    </div>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "icon";

export const Button = forwardRef<
  HTMLButtonElement,
  {
    variant?: ButtonVariant;
    loading?: boolean;
  } & React.ButtonHTMLAttributes<HTMLButtonElement>
>(function Button({ variant = "secondary", loading, children, className, ...rest }, ref) {
  return (
    <button
      ref={ref}
      className={`btn btn--${variant}${className ? ` ${className}` : ""}`}
      disabled={rest.disabled || loading}
      {...rest}
    >
      {loading && <Stepper />}
      {children}
    </button>
  );
});

export function Toggle({
  checked,
  onChange,
  disabled,
  label,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
  id?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={`toggle${checked ? " is-on" : ""}`}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle-knob" />
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  name,
  id,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  name: string;
  id?: string;
}) {
  const onKeyDown = (e: React.KeyboardEvent) => {
    const idx = options.findIndex((o) => o.value === value);
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      onChange(options[(idx + 1) % options.length].value);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      onChange(options[(idx - 1 + options.length) % options.length].value);
    }
  };
  return (
    <div id={id} className="segmented" role="radiogroup" aria-label={name} onKeyDown={onKeyDown}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          tabIndex={o.value === value ? 0 : -1}
          className={`segmented-option${o.value === value ? " is-selected" : ""}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Select({
  value,
  onChange,
  children,
  id,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
  id?: string;
  disabled?: boolean;
}) {
  return (
    <div className="select-wrap">
      <select
        id={id}
        className="select"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        {children}
      </select>
      <span className="select-chevron" aria-hidden="true">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3 4.5l3 3 3-3" strokeLinecap="square" />
        </svg>
      </span>
    </div>
  );
}

export const Input = forwardRef<
  HTMLInputElement,
  {
    mono?: boolean;
    invalid?: boolean;
  } & React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ mono, invalid, id, className, ...rest }, ref) {
  return (
    <input
      ref={ref}
      id={id}
      className={`input${mono ? " input--mono" : ""}${invalid ? " is-invalid" : ""}${
        className ? ` ${className}` : ""
      }`}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  {
    mono?: boolean;
  } & React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ mono, id, className, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      id={id}
      className={`textarea${mono ? " input--mono" : ""}${className ? ` ${className}` : ""}`}
      {...rest}
    />
  );
});

export const FilterInput = forwardRef<
  HTMLInputElement,
  {
    value: string;
    onChange: (v: string) => void;
    placeholder: string;
    id?: string;
    onEscape?: () => void;
    /** Combo shown as keycaps at the right edge while the field is empty, e.g. "Ctrl F". */
    shortcutHint?: string;
  }
>(function FilterInput({ value, onChange, placeholder, id, onEscape, shortcutHint }, ref) {
  return (
    <div className="filter-input">
      <span className="filter-input-icon" aria-hidden="true">
        <Search size={14} />
      </span>
      <input
        ref={ref}
        id={id}
        type="text"
        className="input filter-input-field"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            onEscape?.();
          }
        }}
      />
      {value ? (
        <button
          type="button"
          className="filter-input-clear"
          aria-label="Clear filter"
          onClick={() => onChange("")}
        >
          <X size={14} />
        </button>
      ) : (
        shortcutHint && (
          <span className="filter-input-hint" aria-hidden="true">
            <KeyCombo combo={shortcutHint} size="xs" muted />
          </span>
        )
      )}
    </div>
  );
});

export function KeyCombo({
  combo,
  size = "md",
  muted,
}: {
  combo: string;
  size?: "xs" | "md";
  muted?: boolean;
}) {
  const parts = combo.split(/[+\s]+/).filter(Boolean).map(normalizeKeyLabel);
  return (
    <span className={`key-combo key-combo--${size}${muted ? " is-muted" : ""}`}>
      {parts.map((p, i) => (
        <span key={i} className="key-cap">
          {p}
        </span>
      ))}
    </span>
  );
}

function normalizeKeyLabel(part: string): string {
  const map: Record<string, string> = {
    CommandOrControl: "Ctrl",
    Control: "Ctrl",
    Ctrl: "Ctrl",
    Alt: "Alt",
    Shift: "Shift",
    Super: navigator.platform.toLowerCase().includes("win") ? "Win" : "Super",
    Meta: "Super",
  };
  return map[part] ?? part;
}

export function Badge({
  tone = "muted",
  children,
}: {
  tone?: "accent" | "muted" | "err";
  children: ReactNode;
}) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}

export function ProgressBar({
  value,
  indeterminate,
}: {
  value?: number;
  indeterminate?: boolean;
}) {
  if (indeterminate) {
    return (
      <div className="progress-bar" role="progressbar">
        <Sweep width={120} />
      </div>
    );
  }
  return (
    <div
      className="progress-bar"
      role="progressbar"
      aria-valuenow={Math.round(value ?? 0)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="progress-bar-fill" style={{ width: `${value}%` }} />
    </div>
  );
}

/** DESIGN.md §2.6 sweep: a moving accent segment over a track; reduced motion
 * swaps to a 3-block stepper. Used by the pill (transcribing/cleaning) and
 * ProgressBar's indeterminate state. */
export function Sweep({ width }: { width?: number }) {
  // No explicit width: the track fills its flex slot via CSS (.sweep is
  // width: 100%) and the travel distance is computed the same way, so the
  // pill's content slot and this component never disagree about the width.
  const style = width
    ? ({ width, ["--sweep-travel" as string]: `${width - 48}px` } as React.CSSProperties)
    : ({ ["--sweep-travel" as string]: "calc(100cqw - 48px)" } as React.CSSProperties);
  return (
    <div className="sweep" style={style}>

      <span className="sweep-segment" />
      <span className="sweep-reduced" aria-hidden="true">
        <span className="sweep-reduced-block" />
        <span className="sweep-reduced-block" />
        <span className="sweep-reduced-block" />
      </span>
    </div>
  );
}

/** DESIGN.md §5 Stepper — replaces Spinner; three blocks filling in sequence. */
export function Stepper() {
  return (
    <span className="stepper" role="status" aria-label="Loading">
      <span className="stepper-block" />
      <span className="stepper-block" />
      <span className="stepper-block" />
    </span>
  );
}

export function Skeleton() {
  return (
    <div className="skeleton-rows" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <div className="skeleton-row" key={i}>
          <div className="skeleton-block" style={{ width: i % 2 ? "40%" : "60%" }} />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
  icon,
}: {
  title: string;
  body: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="empty-state">
      {icon && (
        <span className="empty-state-icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <p className="empty-state-title">{title}</p>
      <p className="empty-state-body">{body}</p>
      {action}
    </div>
  );
}

export function InlineConfirm({
  message,
  confirmLabel,
  cancelLabel = "Cancel",
  danger = true,
  onConfirm,
  onCancel,
}: {
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <div
      className="inline-confirm"
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel();
      }}
    >
      <span>{message}</span>
      <Button ref={ref} variant={danger ? "danger" : "primary"} onClick={onConfirm}>
        {confirmLabel}
      </Button>
      <Button variant="ghost" onClick={onCancel}>
        {cancelLabel}
      </Button>
    </div>
  );
}

export function Banner({
  variant = "error",
  title,
  body,
  onDismiss,
}: {
  variant?: "error" | "info";
  title: string;
  body?: string;
  onDismiss?: () => void;
}) {
  return (
    <div className={`banner banner--${variant}`} role={variant === "error" ? "alert" : undefined}>
      <span className="banner-icon" aria-hidden="true">
        {variant === "error" ? "!" : "i"}
      </span>
      <div className="banner-text">
        <p className="banner-title">{title}</p>
        {body && (
          <p className="banner-body" title={body}>
            {body}
          </p>
        )}
      </div>
      {onDismiss && (
        <Button variant="ghost" className="banner-dismiss" onClick={onDismiss}>
          Dismiss
        </Button>
      )}
    </div>
  );
}

/** DESIGN.md §3.4/§3.5 — write-only key field, shared by Transcription and Cleanup. */
export function ApiKeyField({
  saved,
  disabled,
  onSave,
  onClear,
}: {
  saved: boolean;
  disabled?: boolean;
  onSave: (key: string) => Promise<void>;
  onClear: () => Promise<void>;
}) {
  const [state, setState] = useState<"saved" | "input">(saved ? "saved" : "input");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [clearing, setClearing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setState(saved ? "saved" : "input"), [saved]);

  const doSave = async () => {
    if (!value) return;
    setBusy(true);
    try {
      await onSave(value);
      setValue("");
      setState("saved");
    } finally {
      setBusy(false);
    }
  };

  const doClear = async () => {
    setClearing(true);
    try {
      await onClear();
      setState("input");
    } finally {
      setClearing(false);
    }
  };

  if (state === "saved") {
    return (
      <div className="api-key-field">
        <span className="api-key-saved mono">•••••••• Saved</span>
        <Button
          variant="secondary"
          disabled={disabled}
          onClick={() => {
            setState("input");
            requestAnimationFrame(() => inputRef.current?.focus());
          }}
        >
          Replace
        </Button>
        <Button variant="ghost" disabled={disabled} loading={clearing} onClick={doClear}>
          Remove
        </Button>
      </div>
    );
  }

  return (
    <div className="api-key-field">
      <Input
        ref={inputRef}
        type="password"
        placeholder="sk-…"
        value={value}
        disabled={disabled}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") doSave();
          if (e.key === "Escape" && saved) setState("saved");
        }}
      />
      <Button variant="primary" disabled={disabled || !value} loading={busy} onClick={doSave}>
        Save
      </Button>
    </div>
  );
}

export function useDebouncedCallback<A extends unknown[]>(
  fn: (...args: A) => void,
  delayMs: number,
) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  return (...args: A) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => fn(...args), delayMs);
  };
}

export function useSavedFlash() {
  const [saved, setSaved] = useState(false);
  const flash = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 1200);
  };
  return { saved, flash };
}
