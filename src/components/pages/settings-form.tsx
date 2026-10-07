import { useField, useForm, useSelector } from "@tanstack/react-form";
import { Link } from "@tanstack/react-router";
import { invoke } from "@tauri-apps/api/core";
import { Check, Eye, EyeOff, Keyboard, Network, X } from "lucide-react";
import { useEffect, useState } from "react";
import { z } from "zod";
import { AppHeaderActions } from "@/components/layout/app-header-actions";
import { PageLayout } from "@/components/layout/page-layout";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
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
  InputGroupText,
} from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";
import { shortcutParts } from "@/lib/shortcut";
import { useShortcutRecorder } from "@/lib/use-shortcut-recorder";

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
  baseUrl: z.url("Must be a valid URL."),
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

  const { recording, toggleRecording } = useShortcutRecorder((shortcut) => {
    shortcutField.handleChange(shortcut);
  });

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

  const shortcut = shortcutField.state.value;
  const hasShortcut = shortcut.trim().length > 0;

  return (
    <PageLayout
      header={
        <div className="flex w-full items-center justify-between">
          <div>
            <h1 className="font-heading text-base leading-snug font-medium">
              Configuration
            </h1>
            <p className="text-sm text-muted-foreground">
              Manage Mistral realtime inference endpoints, audio devices, and
              hotkeys.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <AppHeaderActions />
          </div>
        </div>
      }
      footer={
        <>
          <Button type="button" variant="outline">
            <Network className="size-4" />
            Test WebSocket Ping
          </Button>
          <div className="flex items-center gap-2">
            <Link to="/" className={buttonVariants({ variant: "ghost" })}>
              Cancel
            </Link>
            <Button type="submit" form="settings-form" disabled={!canSubmit}>
              <Check className="size-4" />
              {isSubmitting ? "Saving…" : "Save Preferences"}
            </Button>
          </div>
        </>
      }
    >
      <form
        id="settings-form"
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
      >
        <FieldGroup>
          {/* Row 1: API Key & Model */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field data-invalid={invalidOf(apiKeyField.state.meta)}>
              <FieldLabel htmlFor="settings-api-key">
                Mistral API Key
              </FieldLabel>
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
              <FieldLabel htmlFor="settings-shortcut">
                Global Activation Hotkey
              </FieldLabel>
              <InputGroup className="justify-between">
                {recording ? (
                  <InputGroupInput
                    id="settings-shortcut"
                    placeholder="Press a key…"
                    readOnly
                  />
                ) : hasShortcut ? (
                  <InputGroupAddon align="inline-start">
                    {shortcutParts(shortcut).map(({ key, node }) => (
                      <Kbd key={key}>{node}</Kbd>
                    ))}
                  </InputGroupAddon>
                ) : (
                  <InputGroupAddon align="inline-start">
                    <InputGroupText>Not set</InputGroupText>
                  </InputGroupAddon>
                )}

                <InputGroupAddon align="inline-end">
                  {hasShortcut && !recording && (
                    <InputGroupButton
                      size="icon-xs"
                      type="button"
                      aria-label="Clear hotkey"
                      onClick={() => shortcutField.handleChange("")}
                    >
                      <X className="size-3.5" />
                    </InputGroupButton>
                  )}
                  <InputGroupButton
                    size="icon-xs"
                    type="button"
                    aria-label={recording ? "Cancel" : "Record hotkey"}
                    onClick={toggleRecording}
                  >
                    {recording ? (
                      <X className="size-3.5" />
                    ) : (
                      <Keyboard className="size-3.5" />
                    )}
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
              {invalidOf(shortcutField.state.meta) && (
                <FieldError errors={shortcutField.state.meta.errors} />
              )}
            </Field>
          </div>

          {/* Row 3: Audio Device */}
          <Field>
            <FieldLabel>Audio Input Capture Device</FieldLabel>
            <Combobox defaultValue={AUDIO_DEVICES[0]}>
              <ComboboxInput showClear={false} placeholder="Select a device" />
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
      </form>
    </PageLayout>
  );
}
