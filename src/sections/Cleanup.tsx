// DESIGN.md §3.5 — cleanup mode + AI provider configuration.
import { useEffect, useState } from "react";
import { MAX_CLEANUP_INSTRUCTIONS, type Settings } from "../lib/ipc";
import { api } from "../lib/api";
import {
  ApiKeyField,
  Button,
  Card,
  CardTitle,
  Field,
  Input,
  Segmented,
  SectionHeader,
  Select,
  Textarea,
  useSavedFlash,
} from "../components/ui";

const codePointCount = (s: string) => [...s].length;

const CLEANUP_INSTRUCTIONS_PLACEHOLDER = [
  "Keep technical terms as spoken (Tauri, WSL, cargo)",
  "Use British spelling",
  "Format spoken lists as bullet points",
  "Never translate; keep Spanish and English mixed as spoken",
].join("\n");

type Preset = "ollama" | "lm_studio" | "openai" | "groq" | "openrouter" | "anthropic" | "custom";

// Worker note: LM Studio's model name defaults to "local-model" (LM Studio's own
// server accepts any non-empty string and routes to whatever is loaded) since the
// Rust backend rejects an empty model. Anthropic model id confirmed current via the
// claude-api skill.
export const PRESETS: Record<Exclude<Preset, "custom">, { baseUrl: string; model: string }> = {
  ollama: { baseUrl: "http://localhost:11434/v1", model: "llama3.2" },
  lm_studio: { baseUrl: "http://localhost:1234/v1", model: "local-model" },
  openai: { baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini" },
  groq: { baseUrl: "https://api.groq.com/openai/v1", model: "llama-3.1-8b-instant" },
  openrouter: { baseUrl: "https://openrouter.ai/api/v1", model: "openai/gpt-4o-mini" },
  anthropic: { baseUrl: "https://api.anthropic.com/v1", model: "claude-haiku-4-5" },
};

const PRESET_LABELS: Record<Preset, string> = {
  ollama: "Ollama",
  lm_studio: "LM Studio",
  openai: "OpenAI",
  groq: "Groq",
  openrouter: "OpenRouter",
  anthropic: "Anthropic",
  custom: "Custom",
};

function presetFor(ai: Settings["ai"]): Preset {
  const entry = Object.entries(PRESETS).find(
    ([, v]) => v.baseUrl === ai.baseUrl && v.model === ai.model,
  );
  return (entry?.[0] as Preset) ?? "custom";
}

const CLEANUP_HELPER: Record<Settings["cleanup"], string> = {
  off: "Raw transcript, trimmed.",
  basic: "Removes fillers and stutters, fixes spacing and capitalization. Runs locally, instantly.",
  ai: "Sends the transcript to a chat model to remove disfluencies and apply self-corrections. Falls back to Basic on any failure.",
};

export function Cleanup({
  settings,
  onSave,
  hasAiKey,
  onAiKeyChange,
  onOpenDictionary,
}: {
  settings: Settings;
  onSave: (patch: Partial<Settings>) => Promise<boolean | string>;
  hasAiKey: boolean;
  onAiKeyChange: () => void;
  onOpenDictionary: () => void;
}) {
  const { saved, flash } = useSavedFlash();
  const save = async (patch: Partial<Settings>) => {
    const ok = await onSave(patch);
    if (ok === true) flash();
    return ok;
  };

  const preset = presetFor(settings.ai);
  const [baseUrl, setBaseUrl] = useState(settings.ai.baseUrl);
  const [model, setModel] = useState(settings.ai.model);
  const [urlError, setUrlError] = useState<string | undefined>();
  const [testState, setTestState] = useState<
    { kind: "idle" } | { kind: "testing" } | { kind: "ok"; message: string } | { kind: "err"; message: string }
  >({ kind: "idle" });

  useEffect(() => {
    setBaseUrl(settings.ai.baseUrl);
    setModel(settings.ai.model);
  }, [settings.ai.baseUrl, settings.ai.model]);

  const onPreset = (p: Preset) => {
    if (p === "custom") return;
    const next = PRESETS[p];
    setBaseUrl(next.baseUrl);
    setModel(next.model);
    save({ ai: next });
  };

  const onBaseUrlChange = (v: string) => setBaseUrl(v);
  const onModelChange = (v: string) => setModel(v);
  const onBaseUrlBlur = () => {
    if (baseUrl && !/^https?:\/\//.test(baseUrl)) {
      setUrlError("Must start with http:// or https://");
      return;
    }
    setUrlError(undefined);
    save({ ai: { baseUrl, model } });
  };
  const onModelBlur = () => save({ ai: { baseUrl, model } });

  const disabled = settings.cleanup !== "ai";

  const runTest = async () => {
    setTestState({ kind: "testing" });
    try {
      const msg = await api.testAi();
      setTestState({ kind: "ok", message: msg });
    } catch (err) {
      setTestState({ kind: "err", message: String(err) });
    }
  };

  return (
    <>
      <SectionHeader
        title="Cleanup"
        subtitle="What happens to the transcript before it is pasted."
        right={saved ? <span className="saved-flash">Saved</span> : undefined}
      />

      <Card>
        <CardTitle>Mode</CardTitle>
        <Field label="Cleanup" helper={CLEANUP_HELPER[settings.cleanup]}>
          <Segmented
            name="Cleanup"
            value={settings.cleanup}
            onChange={(v) => save({ cleanup: v })}
            options={[
              { value: "off", label: "Off" },
              { value: "basic", label: "Basic" },
              { value: "ai", label: "AI" },
            ]}
          />
        </Field>
      </Card>

      <Card>
        <CardTitle>AI provider</CardTitle>
        <p className="box-heading-helper">
          Dictionary replacements run before cleanup.{" "}
          <button type="button" className="link-button" onClick={onOpenDictionary}>
            Open dictionary
          </button>
        </p>
        <Field label="Preset" disabled={disabled}>
          <Select value={preset} onChange={(v) => onPreset(v as Preset)} disabled={disabled}>
            {(Object.keys(PRESET_LABELS) as Preset[]).map((p) => (
              <option key={p} value={p}>
                {PRESET_LABELS[p]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Base URL" disabled={disabled} error={urlError}>
          <Input
            mono
            placeholder="http://localhost:11434/v1"
            value={baseUrl}
            disabled={disabled}
            invalid={!!urlError}
            onChange={(e) => onBaseUrlChange(e.target.value)}
            onBlur={onBaseUrlBlur}
          />
        </Field>
        <Field label="Model" disabled={disabled}>
          <Input
            mono
            placeholder="llama3.2"
            value={model}
            disabled={disabled}
            onChange={(e) => onModelChange(e.target.value)}
            onBlur={onModelBlur}
          />
        </Field>
        <Field
          label="API key"
          disabled={disabled}
          helper="Stored in the system keyring. Local servers usually need none."
        >
          <ApiKeyField
            saved={hasAiKey}
            disabled={disabled}
            onSave={async (key) => {
              await api.setAiKey(key);
              onAiKeyChange();
            }}
            onClear={async () => {
              await api.clearAiKey();
              onAiKeyChange();
            }}
          />
        </Field>
        <Field label=" " disabled={disabled}>
          <div className="test-connection-row">
            <Button variant="secondary" disabled={disabled} loading={testState.kind === "testing"} onClick={runTest}>
              Test
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

      <CustomInstructions settings={settings} onSave={save} />
    </>
  );
}

function CustomInstructions({
  settings,
  onSave,
}: {
  settings: Settings;
  onSave: (patch: Partial<Settings>) => Promise<boolean | string>;
}) {
  const [draft, setDraft] = useState(settings.cleanupInstructions);
  const [saving, setSaving] = useState(false);

  // Saved value changed from outside this box (e.g. settings reloaded after a
  // save error elsewhere) — follow it, same as Cleanup's baseUrl/model state.
  useEffect(() => setDraft(settings.cleanupInstructions), [settings.cleanupInstructions]);

  const count = codePointCount(draft);
  const dirty = draft !== settings.cleanupInstructions;
  const tooLong = count > MAX_CLEANUP_INSTRUCTIONS;
  const canSave = dirty && !tooLong && !saving;

  const doSave = async () => {
    if (!canSave) return;
    setSaving(true);
    await onSave({ cleanupInstructions: draft });
    setSaving(false);
  };

  return (
    <Card className={`cleanup-instructions${settings.cleanup !== "ai" ? " box--dimmed" : ""}`}>
      <CardTitle>Custom instructions</CardTitle>
      <Field
        label="Instructions"
        helper="Applied to AI cleanup only. Basic cleanup ignores these. Playground uses saved instructions."
        error={tooLong ? `Too long — trim to ${MAX_CLEANUP_INSTRUCTIONS} characters.` : undefined}
      >
        <Textarea
          rows={6}
          value={draft}
          placeholder={CLEANUP_INSTRUCTIONS_PLACEHOLDER}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) doSave();
          }}
        />
      </Field>
      <p className={`char-counter${count >= 1900 ? " char-counter--warn" : ""}`}>
        {count} / {MAX_CLEANUP_INSTRUCTIONS}
      </p>
      <div className="cleanup-instructions-actions">
        <Button variant="primary" disabled={!canSave} loading={saving} onClick={doSave}>
          Save
        </Button>
        <Button variant="secondary" disabled={!dirty} onClick={() => setDraft(settings.cleanupInstructions)}>
          Reset
        </Button>
      </div>
    </Card>
  );
}
