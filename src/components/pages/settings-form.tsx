import { useField, useForm, useSelector } from "@tanstack/react-form";
import { invoke } from "@tauri-apps/api/core";
import { Check, Eye, EyeOff, Network } from "lucide-react";
import { useEffect, useState } from "react";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
} from "@/components/ui/combobox";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";

// Shared shape with the Rust `AppSettings` (serde camelCase).
export interface AppSettings {
  apiKey: string;
  model: string;
  sampleRate: number;
  targetDelayMs: number | null;
  shortcut: string;
  baseUrl: string;
}

const formSchema = z.object({
  apiKey: z.string().min(1, "API key is required."),
  model: z.string().min(1, "Model is required."),
  baseUrl: z.string().url("Must be a valid URL."),
  shortcut: z.string().min(1, "Shortcut is required."),
});

type FormValues = z.infer<typeof formSchema>;

const MODELS = [
  "mistral-realtime-voice-v1 (Recommended)",
  "mistral-embed-speech (Low latency)",
  "whisper-large-v3-turbo (Local fallback)",
];

const AUDIO_DEVICES = [
  "MacBook Pro Microphone (Built-in Audio) • 48000Hz 1ch",
  "Shure MV7 USB Dynamic Mic (External) • 44100Hz 1ch",
  "Elgato Wave:3 (Virtual Stream Mixer) • 48000Hz 2ch",
];

export function SettingsForm({
  initialSettings,
}: {
  initialSettings?: AppSettings | null;
}) {
  const [showKey, setShowKey] = useState(false);

  const form = useForm({
    defaultValues: {
      apiKey: initialSettings?.apiKey ?? "",
      model: initialSettings?.model ?? "mistral-realtime-voice-v1",
      baseUrl: initialSettings?.baseUrl ?? "wss://api.mistral.ai",
      shortcut: initialSettings?.shortcut ?? "ctrl+alt+space",
    } as FormValues,
    validators: {
      onChange: formSchema,
    },
    onSubmit: async ({ value }) => {
      const settings: AppSettings = {
        apiKey: value.apiKey,
        model: value.model,
        baseUrl: value.baseUrl,
        shortcut: value.shortcut,
        sampleRate: 16000,
        targetDelayMs: null,
      };
      await invoke("set_settings", { settings });
    },
  });

  const apiKeyField = useField({ form, name: "apiKey" });
  const modelField = useField({ form, name: "model" });
  const baseUrlField = useField({ form, name: "baseUrl" });
  const shortcutField = useField({ form, name: "shortcut" });

  const canSubmit = useSelector(form.store, (s) => s.canSubmit);
  const isSubmitting = useSelector(form.store, (s) => s.isSubmitting);

  useEffect(() => {
    if (!initialSettings) return;
    form.setFieldValue("apiKey", initialSettings.apiKey);
    form.setFieldValue("model", initialSettings.model);
    form.setFieldValue("baseUrl", initialSettings.baseUrl);
    form.setFieldValue("shortcut", initialSettings.shortcut);
  }, [form, initialSettings]);

  const invalidOf = (meta: { isTouched: boolean; isValid: boolean }) =>
    meta.isTouched && !meta.isValid;

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Engine Configuration</CardTitle>
            <CardDescription>
              Manage Mistral realtime inference endpoints, audio devices, and
              hotkeys.
            </CardDescription>
          </div>
          <Badge variant="secondary" className="font-mono">
            Config: config.json
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
        >
          <FieldGroup>
            {/* Row 1: API Key & Model */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field data-invalid={invalidOf(apiKeyField.state.meta)}>
                <div className="flex items-center justify-between">
                  <FieldLabel htmlFor="settings-api-key">
                    Mistral API Key
                  </FieldLabel>
                  <Badge variant="outline" className="font-mono">
                    Active License
                  </Badge>
                </div>
                <InputGroup>
                  <InputGroupInput
                    id="settings-api-key"
                    name={apiKeyField.name}
                    type={showKey ? "text" : "password"}
                    value={apiKeyField.state.value}
                    onBlur={apiKeyField.handleBlur}
                    onChange={(e) => apiKeyField.handleChange(e.target.value)}
                    aria-invalid={invalidOf(apiKeyField.state.meta)}
                    placeholder="Your Mistral API key"
                    autoComplete="off"
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      size="icon-xs"
                      variant="ghost"
                      type="button"
                      aria-label={showKey ? "Hide API key" : "Show API key"}
                      onClick={() => setShowKey((v) => !v)}
                    >
                      {showKey ? (
                        <EyeOff className="size-3.5" />
                      ) : (
                        <Eye className="size-3.5" />
                      )}
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
                {invalidOf(apiKeyField.state.meta) && (
                  <FieldError errors={apiKeyField.state.meta.errors} />
                )}
              </Field>

              <Field data-invalid={invalidOf(modelField.state.meta)}>
                <FieldLabel htmlFor="settings-model">
                  Realtime Speech Model
                </FieldLabel>
                <Combobox
                  value={modelField.state.value}
                  onValueChange={(value) => {
                    if (value) modelField.handleChange(value);
                  }}
                >
                  <ComboboxInput
                    showClear={false}
                    placeholder="Select a model"
                    aria-invalid={invalidOf(modelField.state.meta)}
                  />
                  <ComboboxContent>
                    <ComboboxList>
                      {MODELS.map((model) => (
                        <ComboboxItem key={model} value={model}>
                          {model}
                        </ComboboxItem>
                      ))}
                    </ComboboxList>
                  </ComboboxContent>
                  <ComboboxValue>{modelField.state.value}</ComboboxValue>
                </Combobox>
                {invalidOf(modelField.state.meta) && (
                  <FieldError errors={modelField.state.meta.errors} />
                )}
              </Field>
            </div>

            {/* Row 2: Base URL & Hotkey */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field data-invalid={invalidOf(baseUrlField.state.meta)}>
                <FieldLabel htmlFor="settings-base-url">
                  Inference WebSocket Base URL
                </FieldLabel>
                <Input
                  id="settings-base-url"
                  name={baseUrlField.name}
                  value={baseUrlField.state.value}
                  onBlur={baseUrlField.handleBlur}
                  onChange={(e) => baseUrlField.handleChange(e.target.value)}
                  aria-invalid={invalidOf(baseUrlField.state.meta)}
                  autoComplete="off"
                />
                {invalidOf(baseUrlField.state.meta) && (
                  <FieldError errors={baseUrlField.state.meta.errors} />
                )}
              </Field>

              <Field data-invalid={invalidOf(shortcutField.state.meta)}>
                <div className="flex items-center justify-between">
                  <FieldLabel htmlFor="settings-shortcut">
                    Global Activation Hotkey
                  </FieldLabel>
                  <span className="text-xs text-muted-foreground/80">
                    Click badge to re-bind
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-input px-3 py-1.5">
                  <Input
                    id="settings-shortcut"
                    name={shortcutField.name}
                    value={shortcutField.state.value}
                    onBlur={shortcutField.handleBlur}
                    onChange={(e) => shortcutField.handleChange(e.target.value)}
                    aria-invalid={invalidOf(shortcutField.state.meta)}
                    autoComplete="off"
                    className="border-0 bg-transparent shadow-none focus-visible:ring-0"
                  />
                  <Badge variant="secondary" className="uppercase">
                    Registered
                  </Badge>
                </div>
                {invalidOf(shortcutField.state.meta) && (
                  <FieldError errors={shortcutField.state.meta.errors} />
                )}
              </Field>
            </div>

            {/* Row 3: Audio Device */}
            <Field>
              <FieldLabel>Audio Input Capture Device</FieldLabel>
              <Combobox defaultValue={AUDIO_DEVICES[0]}>
                <ComboboxInput
                  showClear={false}
                  placeholder="Select a device"
                />
                <ComboboxContent>
                  <ComboboxList>
                    {AUDIO_DEVICES.map((device) => (
                      <ComboboxItem key={device} value={device}>
                        {device}
                      </ComboboxItem>
                    ))}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
            </Field>
          </FieldGroup>

          {/* Bottom Actions: Test Connection & Save */}
          <div className="mt-6 flex items-center justify-between">
            <Button type="button" variant="outline">
              <Network className="size-4" />
              Test WebSocket Ping
            </Button>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost">
                Cancel
              </Button>
              <Button type="submit" disabled={!canSubmit}>
                <Check className="size-4" />
                {isSubmitting ? "Saving…" : "Save Preferences"}
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
