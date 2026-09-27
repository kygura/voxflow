import { useEffect, useState } from "react";
import type { Settings } from "../lib/ipc";
import { api } from "../lib/api";
import { Card, CardTitle, Field, Segmented, Select, Toggle, SectionHeader, useSavedFlash } from "../components/ui";
import { HotkeyRecorder } from "../components/HotkeyRecorder";

const LANGUAGES: [string, string][] = [
  ["auto", "Auto-detect"],
  ["en", "English (en)"],
  ["es", "Spanish (es)"],
  ["fr", "French (fr)"],
  ["de", "German (de)"],
  ["it", "Italian (it)"],
  ["pt", "Portuguese (pt)"],
  ["nl", "Dutch (nl)"],
  ["ru", "Russian (ru)"],
  ["zh", "Chinese (zh)"],
  ["ja", "Japanese (ja)"],
  ["ko", "Korean (ko)"],
  ["ar", "Arabic (ar)"],
  ["hi", "Hindi (hi)"],
  ["tr", "Turkish (tr)"],
  ["pl", "Polish (pl)"],
  ["sv", "Swedish (sv)"],
  ["uk", "Ukrainian (uk)"],
  ["vi", "Vietnamese (vi)"],
  ["id", "Indonesian (id)"],
  ["cs", "Czech (cs)"],
];

const HOTKEY_MODE_HELPER: Record<Settings["hotkeyMode"], string> = {
  hybrid: "Hold to talk, or tap to start and tap again to stop.",
  push_to_talk: "Recording stops when you release the keys.",
  toggle: "Press once to start, again to stop.",
};

export function General({
  settings,
  onSave,
}: {
  settings: Settings;
  onSave: (patch: Partial<Settings>) => Promise<boolean>;
}) {
  const [devices, setDevices] = useState<string[]>([]);
  const { saved, flash } = useSavedFlash();

  useEffect(() => {
    api.listInputDevices().then(setDevices);
  }, []);

  const save = async (patch: Partial<Settings>) => {
    const ok = await onSave(patch);
    if (ok) flash();
  };

  return (
    <>
      <SectionHeader
        title="General"
        subtitle="Dictation hotkey and behaviour."
        right={saved ? <span className="saved-flash">Saved</span> : undefined}
      />

      <Card>
        <CardTitle>Hotkey</CardTitle>
        <Field label="Dictation hotkey" helper="Press the combo you want. Needs at least one non-modifier key.">
          <HotkeyRecorder
            value={settings.hotkey}
            onCapture={async (accel) => {
              const ok = await onSave({ hotkey: accel });
              if (!ok) throw "Backend could not register this combo.";
              flash();
            }}
          />
        </Field>
        <Field label="Hotkey mode" helper={HOTKEY_MODE_HELPER[settings.hotkeyMode]}>
          <Segmented
            name="Hotkey mode"
            value={settings.hotkeyMode}
            onChange={(v) => save({ hotkeyMode: v })}
            options={[
              { value: "hybrid", label: "Hybrid" },
              { value: "push_to_talk", label: "Push to talk" },
              { value: "toggle", label: "Toggle" },
            ]}
          />
        </Field>
      </Card>

      <Card>
        <CardTitle>Input</CardTitle>
        <Field
          label="Microphone"
          helper="Devices are listed when the app starts. Plug in, then reopen this window."
        >
          <Select
            value={settings.inputDevice ?? ""}
            onChange={(v) => save({ inputDevice: v || null })}
          >
            <option value="">System default</option>
            {devices.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Language"
          helper="Auto-detect works well for local models. Server models may need a fixed language."
        >
          <Select value={settings.language} onChange={(v) => save({ language: v })}>
            {LANGUAGES.map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
      </Card>

      <Card>
        <CardTitle>Output</CardTitle>
        <Field
          label="Paste automatically"
          helper="Types Ctrl+V into the focused app after transcribing. Off: text is only copied."
        >
          <Toggle
            label="Paste automatically"
            checked={settings.autoPaste}
            onChange={(v) => save({ autoPaste: v })}
          />
        </Field>
        <Field
          label="Restore clipboard"
          helper="Put your previous clipboard back after pasting."
          disabled={!settings.autoPaste}
        >
          <Toggle
            label="Restore clipboard"
            checked={settings.restoreClipboard}
            disabled={!settings.autoPaste}
            onChange={(v) => save({ restoreClipboard: v })}
          />
        </Field>
        <Field label="Save history" helper="Keep the last 200 transcriptions on this device.">
          <Toggle
            label="Save history"
            checked={settings.saveHistory}
            onChange={(v) => save({ saveHistory: v })}
          />
        </Field>
      </Card>

      <Card>
        <CardTitle>Appearance</CardTitle>
        <Field label="Theme">
          <Segmented
            name="Theme"
            value={settings.theme}
            onChange={(v) => save({ theme: v })}
            options={[
              { value: "system", label: "System" },
              { value: "dark", label: "Dark" },
              { value: "light", label: "Light" },
            ]}
          />
        </Field>
      </Card>
    </>
  );
}
