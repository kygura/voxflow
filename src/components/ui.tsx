// Shared UI primitives from DESIGN.md §7 component inventory.
import { forwardRef, useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Search, X } from "./icons";

export function Sidebar({
  active,
  onSelect,
  status,
  hotkey,
}: {
  active: string;
  onSelect: (id: string) => void;
  status: "idle" | "recording" | "transcribing";
  hotkey: string;
}) {
  const items: { id: string; label: string; combo: string }[] = [
    { id: "general", label: "General", combo: "Ctrl 1" },
    { id: "transcription", label: "Transcription", combo: "Ctrl 2" },
    { id: "history", label: "History", combo: "Ctrl 3" },
    { id: "about", label: "About", combo: "Ctrl 4" },
  ];
  return (
    <nav className="sidebar" aria-label="Sections">
      <div className="sidebar-brand">
        <span className="sidebar-icon" aria-hidden="true" />
        <span className="wordmark">VoxFlow</span>
      </div>
      <div className="sidebar-nav" role="list">
        {items.map((it) => (
          <button
            key={it.id}
            role="listitem"
            className={`sidebar-item${active === it.id ? " is-active" : ""}`}
            onClick={() => onSelect(it.id)}
            aria-current={active === it.id ? "page" : undefined}
          >
            <span>{it.label}</span>
            <KeyCombo combo={it.combo} size="xs" />
          </button>
        ))}
      </div>
      <div className="sidebar-footer">
        <span className={`status-dot status-dot--${status}`} aria-hidden="true" />
        <span className="sidebar-footer-text">
          <span className="sidebar-status-label">
            {status === "idle" ? "Idle" : status === "recording" ? "Recording" : "Transcribing"}
          </span>
          <KeyCombo combo={hotkey} size="md" />
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
  return <div className="card">{children}</div>;
}

export function CardTitle({ children }: { children: ReactNode }) {
  return <h2 className="card-title">{children}</h2>;
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
      {loading && <Spinner size={14} />}
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
        ▾
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

export const FilterInput = forwardRef<
  HTMLInputElement,
  {
    value: string;
    onChange: (v: string) => void;
    placeholder: string;
    id?: string;
    onEscape?: () => void;
  }
>(function FilterInput({ value, onChange, placeholder, id, onEscape }, ref) {
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
      {value && (
        <button
          type="button"
          className="filter-input-clear"
          aria-label="Clear filter"
          onClick={() => onChange("")}
        >
          <X size={14} />
        </button>
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
  tone?: "accent" | "ok" | "muted";
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
  return (
    <div
      className={`progress-bar${indeterminate ? " is-indeterminate" : ""}`}
      role="progressbar"
      aria-valuenow={indeterminate ? undefined : Math.round(value ?? 0)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="progress-bar-fill" style={indeterminate ? undefined : { width: `${value}%` }} />
    </div>
  );
}

export function Spinner({ size = 14 }: { size?: number }) {
  return (
    <span
      className="spinner"
      style={{ width: size, height: size }}
      role="status"
      aria-label="Loading"
    />
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
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-state-icon" aria-hidden="true" />
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
        <button type="button" className="banner-dismiss" aria-label="Dismiss" onClick={onDismiss}>
          <X size={14} />
        </button>
      )}
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
