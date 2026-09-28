// DESIGN.md §3.5 — cleanup mode + AI provider configuration.
import { useEffect, useState } from "react";
import type { Settings } from "../lib/ipc";
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
  useSavedFlash,
} from "../components/ui";

type Preset = "ollama" | "lm_studio" | "openai" | "groq" | "openrouter" | "anthropic" | "custom";

// Worker note: LM Studio's model name is left blank (input placeholder only) since it
// depends entirely on what the user has loaded locally. Anthropic model id confirmed
// current via the claude-api skill.
const PRESETS: Record<Exclude<Preset, "custom">, { baseUrl: string; model: string }> = {
  ollama: { baseUrl: "http://localhost:11434/v1", model: "llama3.2" },
  lm_studio: { baseUrl: "http://localhost:1234/v1", model: "" },
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
}: {
  settings: Settings;
  onSave: (patch: Partial<Settings>) => Promise<boolean>;
  hasAiKey: boolean;
}) {
  const { saved, flash } = useSavedFlash();
  const save = async (patch: Partial<Settings>) => {
    const ok = await onSave(patch);
    if (ok) flash();
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
          <ApiKeyField saved={hasAiKey} onSave={(key) => api.setAiKey(key)} onClear={() => api.clearAiKey()} />
        </Field>
        <Field label=" " disabled={disabled}>
          <div className="test-connection-row">
            <Button variant="secondary" loading={testState.kind === "testing"} onClick={runTest}>
              Test
            </Button>
            {testState.kind === "ok" && (
              <span className="test-result test-result--ok" title={testState.message}>
                CONNECTED
              </span>
            )}
            {testState.kind === "err" && (
              <span className="test-result test-result--err" title={testState.message}>
                FAILED: {testState.message}
              </span>
            )}
          </div>
        </Field>
      </Card>
    </>
  );
}
