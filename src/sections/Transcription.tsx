import { useEffect, useRef, useState } from "react";
import type { Settings, ModelInfo } from "../lib/ipc";
import { api, events } from "../lib/api";
import {
  Badge,
  Banner,
  Button,
  Card,
  CardTitle,
  Field,
  Input,
  InlineConfirm,
  ProgressBar,
  Segmented,
  SectionHeader,
  useDebouncedCallback,
  useSavedFlash,
} from "../components/ui";

type Preset = "openai" | "groq" | "local_server" | "custom";
const PRESETS: Record<Exclude<Preset, "custom">, { baseUrl: string; model: string }> = {
  openai: { baseUrl: "https://api.openai.com/v1", model: "whisper-1" },
  groq: { baseUrl: "https://api.groq.com/openai/v1", model: "whisper-large-v3-turbo" },
  local_server: { baseUrl: "http://localhost:8000/v1", model: "whisper-1" },
};

function presetFor(remote: Settings["remote"]): Preset {
  const entry = Object.entries(PRESETS).find(
    ([, v]) => v.baseUrl === remote.baseUrl && v.model === remote.model,
  );
  return (entry?.[0] as Preset) ?? "custom";
}

export function Transcription({
  settings,
  onSave,
  hasApiKey,
}: {
  settings: Settings;
  onSave: (patch: Partial<Settings>) => Promise<boolean>;
  hasApiKey: boolean;
}) {
  const { saved, flash } = useSavedFlash();
  const save = async (patch: Partial<Settings>) => {
    const ok = await onSave(patch);
    if (ok) flash();
    return ok;
  };

  return (
    <>
      <SectionHeader
        title="Transcription"
        right={saved ? <span className="saved-flash">Saved</span> : undefined}
      />
      <Field label="Backend">
        <Segmented
          name="Backend"
          value={settings.backend}
          onChange={(v) => save({ backend: v })}
          options={[
            { value: "local", label: "Local" },
            { value: "remote", label: "Server" },
          ]}
        />
      </Field>
      {settings.backend === "local" ? (
        <LocalPanel settings={settings} onSave={save} />
      ) : (
        <ServerPanel settings={settings} onSave={save} hasApiKey={hasApiKey} />
      )}
    </>
  );
}

function LocalPanel({
  settings,
  onSave,
}: {
  settings: Settings;
  onSave: (patch: Partial<Settings>) => Promise<boolean>;
}) {
  const [models, setModels] = useState<ModelInfo[] | null>(null);
  const [progress, setProgress] = useState<Record<string, { downloaded: number; total: number }>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const refresh = () => api.listModels().then(setModels);

  useEffect(() => {
    refresh();
    const unlistenProgress = events.onModelsProgress((e) =>
      setProgress((p) => ({ ...p, [e.name]: { downloaded: e.downloaded, total: e.total } })),
    );
    const unlistenDone = events.onModelsDone((e) => {
      setProgress((p) => {
        const next = { ...p };
        delete next[e.name];
        return next;
      });
      if (e.error && e.error !== "cancelled") {
        setErrors((er) => ({ ...er, [e.name]: e.error! }));
      } else {
        setErrors((er) => {
          const next = { ...er };
          delete next[e.name];
          return next;
        });
      }
      refresh();
    });
    return () => {
      unlistenProgress.then((u) => u());
      unlistenDone.then((u) => u());
    };
  }, []);

  if (!models) {
    return (
      <Card>
        <CardTitle>Models</CardTitle>
        <p className="field-helper">Loading models…</p>
      </Card>
    );
  }

  const noneDownloaded = models.every((m) => !m.downloaded);

  return (
    <>
      {settings.backend === "local" && noneDownloaded && (
        <Banner variant="info" title="Pick a model to download. base is a good start." />
      )}
      <Card>
        <CardTitle>Models</CardTitle>
        <p className="field-helper models-helper">
          Downloaded to the app data directory / models. Larger is more accurate and slower.
        </p>
        <div className="model-list" role="list">
          {models.map((m) => (
            <ModelRow
              key={m.name}
              model={m}
              active={settings.localModel === m.name}
              progress={progress[m.name]}
              error={errors[m.name]}
              confirmingDelete={confirmDelete === m.name}
              onDownload={() => api.downloadModel(m.name)}
              onCancel={() => api.cancelDownload(m.name)}
              onUse={() => onSave({ localModel: m.name })}
              onDeleteRequest={() => setConfirmDelete(m.name)}
              onDeleteCancel={() => setConfirmDelete(null)}
              onDeleteConfirm={async () => {
                await api.deleteModel(m.name);
                setConfirmDelete(null);
                refresh();
              }}
              onRetry={() => api.downloadModel(m.name)}
            />
          ))}
        </div>
      </Card>
    </>
  );
}

function ModelRow({
  model,
  active,
  progress,
  error,
  confirmingDelete,
  onDownload,
  onCancel,
  onUse,
  onDeleteRequest,
  onDeleteCancel,
  onDeleteConfirm,
  onRetry,
}: {
  model: ModelInfo;
  active: boolean;
  progress?: { downloaded: number; total: number };
  error?: string;
  confirmingDelete: boolean;
  onDownload: () => void;
  onCancel: () => void;
  onUse: () => void;
  onDeleteRequest: () => void;
  onDeleteCancel: () => void;
  onDeleteConfirm: () => void;
  onRetry: () => void;
}) {
  const pct = progress ? Math.round((progress.downloaded / Math.max(1, progress.total)) * 100) : 0;
  return (
    <div className="model-row" role="listitem">
      <span
        className={`model-row-dot${active ? " is-active" : model.downloaded ? " is-downloaded" : " is-hidden"}`}
        aria-hidden="true"
      />
      <span className="model-row-name">
        {model.name}
        {model.englishOnly && <Badge tone="accent">English only</Badge>}
      </span>
      <span className="model-row-size">{model.sizeMb} MB</span>
      <span className="model-row-status">
        {confirmingDelete ? (
          <InlineConfirm
            message={`Delete ${model.sizeMb} MB?`}
            confirmLabel="Delete"
            cancelLabel="Keep"
            onConfirm={onDeleteConfirm}
            onCancel={onDeleteCancel}
          />
        ) : progress ? (
          <>
            <ProgressBar value={pct} />
            <span className="model-row-pct">{pct}%</span>
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          </>
        ) : active ? (
          <Badge tone="ok">Active ✓</Badge>
        ) : model.downloaded ? (
          <>
            <Button variant="secondary" onClick={onUse}>
              Use
            </Button>
            <Button variant="icon" aria-label="Delete" onClick={onDeleteRequest}>
              🗑
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={onDownload}>
            Download
          </Button>
        )}
      </span>
      {error && (
        <p className="field-helper field-helper--error model-row-error">
          Download failed: {error}.{" "}
          <button type="button" className="link-button" onClick={onRetry}>
            Retry
          </button>
        </p>
      )}
    </div>
  );
}

function ServerPanel({
  settings,
  onSave,
  hasApiKey,
}: {
  settings: Settings;
  onSave: (patch: Partial<Settings>) => Promise<boolean>;
  hasApiKey: boolean;
}) {
  const preset = presetFor(settings.remote);
  const [baseUrl, setBaseUrl] = useState(settings.remote.baseUrl);
  const [model, setModel] = useState(settings.remote.model);
  const [urlError, setUrlError] = useState<string | undefined>();
  const [testState, setTestState] = useState<
    { kind: "idle" } | { kind: "testing" } | { kind: "ok"; message: string } | { kind: "err"; message: string }
  >({ kind: "idle" });

  useEffect(() => {
    setBaseUrl(settings.remote.baseUrl);
    setModel(settings.remote.model);
  }, [settings.remote.baseUrl, settings.remote.model]);

  const debouncedSaveRemote = useDebouncedCallback((next: Settings["remote"]) => {
    onSave({ remote: next });
  }, 400);

  const onPreset = (p: Preset) => {
    if (p === "custom") return; // custom is derived, not chosen directly
    const next = PRESETS[p];
    setBaseUrl(next.baseUrl);
    setModel(next.model);
    onSave({ remote: next });
  };

  const onBaseUrlChange = (v: string) => {
    setBaseUrl(v);
    debouncedSaveRemote({ baseUrl: v, model });
  };
  const onModelChange = (v: string) => {
    setModel(v);
    debouncedSaveRemote({ baseUrl, model: v });
  };
  const onBaseUrlBlur = () => {
    if (baseUrl && !/^https?:\/\//.test(baseUrl)) {
      setUrlError("Must start with http:// or https://");
    } else {
      setUrlError(undefined);
    }
  };

  const runTest = async () => {
    setTestState({ kind: "testing" });
    try {
      const msg = await api.testRemote();
      setTestState({ kind: "ok", message: msg });
    } catch (err) {
      setTestState({ kind: "err", message: String(err) });
    }
  };

  return (
    <Card>
      <CardTitle>Server</CardTitle>
      <Field label="Preset">
        <Segmented
          name="Preset"
          value={preset}
          onChange={onPreset}
          options={[
            { value: "openai", label: "OpenAI" },
            { value: "groq", label: "Groq" },
            { value: "local_server", label: "Local server" },
            { value: "custom", label: "Custom" },
          ]}
        />
      </Field>
      <Field label="Base URL" error={urlError}>
        <Input
          mono
          placeholder="https://api.openai.com/v1"
          value={baseUrl}
          invalid={!!urlError}
          onChange={(e) => onBaseUrlChange(e.target.value)}
          onBlur={onBaseUrlBlur}
        />
      </Field>
      <Field label="Model">
        <Input mono placeholder="whisper-1" value={model} onChange={(e) => onModelChange(e.target.value)} />
      </Field>
      <Field label="API key">
        <ApiKeyField hasApiKey={hasApiKey} />
      </Field>
      <Field label=" ">
        <div className="test-connection-row">
          <Button variant="secondary" loading={testState.kind === "testing"} onClick={runTest}>
            Test connection
          </Button>
          {testState.kind === "ok" && (
            <span className="test-result test-result--ok" title={testState.message}>
              {testState.message}
            </span>
          )}
          {testState.kind === "err" && (
            <span className="test-result test-result--err" title={testState.message}>
              Failed: {testState.message}
            </span>
          )}
        </div>
      </Field>
    </Card>
  );
}

function ApiKeyField({ hasApiKey }: { hasApiKey: boolean }) {
  const [state, setState] = useState<"saved" | "input">(hasApiKey ? "saved" : "input");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setState(hasApiKey ? "saved" : "input"), [hasApiKey]);

  const doSave = async () => {
    if (!value) return;
    setBusy(true);
    try {
      await api.setApiKey(value);
      setValue("");
      setState("saved");
    } finally {
      setBusy(false);
    }
  };

  if (state === "saved") {
    return (
      <div className="api-key-field">
        <span className="api-key-saved">•••••••• Saved ✓</span>
        <Button
          variant="secondary"
          onClick={() => {
            setState("input");
            requestAnimationFrame(() => inputRef.current?.focus());
          }}
        >
          Replace
        </Button>
        <Button
          variant="ghost"
          onClick={async () => {
            await api.clearApiKey();
            setState("input");
          }}
        >
          Remove
        </Button>
        <p className="field-helper">Stored in the system keyring, never in files or logs.</p>
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
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") doSave();
          if (e.key === "Escape" && hasApiKey) setState("saved");
        }}
      />
      <Button variant="primary" disabled={!value} loading={busy} onClick={doSave}>
        Save
      </Button>
      <p className="field-helper">Stored in the system keyring, never in files or logs.</p>
    </div>
  );
}
