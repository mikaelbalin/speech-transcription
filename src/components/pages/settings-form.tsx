import { useField, useForm, useSelector } from "@tanstack/react-form";
import { Link, useNavigate } from "@tanstack/react-router";
import { invoke } from "@tauri-apps/api/core";
import { Eye, EyeOff, Keyboard, X } from "lucide-react";
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
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
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
import { type InputDevice, useInputDevices } from "@/lib/use-input-devices";
import { type ModelInfo, useModels } from "@/lib/use-models";
import { useShortcutRecorder } from "@/lib/use-shortcut-recorder";

// Shared shape with the Rust `AppSettings` (serde camelCase).
export interface AppSettings {
  apiKey: string;
  model: string;
  sampleRate: number;
  targetDelayMs: number | null;
  shortcut: string;
  baseUrl: string;
  inputDeviceId: string;
  activationMode: "toggle" | "hold";
  setupCompleted: boolean;
}

const formSchema = z.object({
  apiKey: z.string().min(1, "API key is required."),
  model: z.string().min(1, "Model is required."),
  baseUrl: z.url("Must be a valid URL."),
  shortcut: z.string().min(1, "Shortcut is required."),
  inputDeviceId: z.string(),
  activationMode: z.enum(["toggle", "hold"]),
});

type FormValues = z.infer<typeof formSchema>;

export function SettingsForm({
  initialSettings,
  models: modelsOverride,
  devices: devicesOverride,
}: {
  initialSettings?: AppSettings | null;
  /** Override the device list (used by Storybook to mock Tauri data). */
  devices?: InputDevice[];
  /** Override the model list (used by Storybook to mock Tauri data). */
  models?: ModelInfo[];
}) {
  const [showKey, setShowKey] = useState(false);
  const { devices: fetchedDevices } = useInputDevices();
  const { models: fetchedModels } = useModels();
  const navigate = useNavigate();

  const devices = devicesOverride ?? fetchedDevices;
  const models = modelsOverride ?? fetchedModels;

  const form = useForm({
    defaultValues: {
      apiKey: initialSettings?.apiKey ?? "",
      model: initialSettings?.model ?? "voxtral-mini-transcribe-realtime-2602",
      baseUrl: initialSettings?.baseUrl ?? "wss://api.mistral.ai",
      shortcut: initialSettings?.shortcut ?? "ctrl+alt+space",
      inputDeviceId: initialSettings?.inputDeviceId ?? "",
      activationMode: initialSettings?.activationMode ?? "toggle",
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
        inputDeviceId: value.inputDeviceId,
        activationMode: value.activationMode,
        setupCompleted: initialSettings?.setupCompleted ?? false,
      };
      await invoke("set_settings", { settings });
      navigate({ to: "/" });
    },
  });

  const apiKeyField = useField({ form, name: "apiKey" });
  const modelField = useField({ form, name: "model" });
  const baseUrlField = useField({ form, name: "baseUrl" });
  const shortcutField = useField({ form, name: "shortcut" });
  const inputDeviceIdField = useField({ form, name: "inputDeviceId" });
  const activationModeField = useField({ form, name: "activationMode" });

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
    form.setFieldValue("inputDeviceId", initialSettings.inputDeviceId ?? "");
    form.setFieldValue(
      "activationMode",
      initialSettings.activationMode ?? "toggle",
    );
  }, [form, initialSettings]);

  const invalidOf = (meta: { isTouched: boolean; isValid: boolean }) =>
    meta.isTouched && !meta.isValid;

  const shortcut = shortcutField.state.value;
  const hasShortcut = shortcut.trim().length > 0;

  // Resolve the device to display, falling back to the system default when the
  // saved id is empty or no longer matches an available device (e.g. the saved
  // microphone was disconnected).
  const defaultDevice = devices.find((d) => d.isDefault) ?? devices[0] ?? null;
  const resolvedDevice =
    devices.find((d) => d.id === inputDeviceIdField.state.value) ??
    defaultDevice;

  // The saved microphone was replaced by the fallback default.
  const deviceIsFallback =
    Boolean(inputDeviceIdField.state.value) &&
    !devices.some((d) => d.id === inputDeviceIdField.state.value);

  return (
    <PageLayout
      header={
        <div className="flex w-full items-center justify-between">
          <h1 className="font-heading text-base leading-snug font-medium">
            Configuration
          </h1>

          <div className="flex items-center gap-2">
            <Dialog>
              <AppHeaderActions showOnboarding showHotkeys />
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Hotkeys</DialogTitle>
                  <DialogDescription>
                    Configure the keyboard shortcuts used to control dictation.
                  </DialogDescription>
                </DialogHeader>
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
                <DialogFooter>
                  <DialogClose render={<Button variant="outline" />}>
                    Cancel
                  </DialogClose>
                  <Button
                    type="submit"
                    form="settings-form"
                    disabled={!canSubmit}
                  >
                    {isSubmitting ? "Saving…" : "Save"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      }
      footer={
        <div className="flex items-center ml-auto gap-2">
          <Link to="/" className={buttonVariants({ variant: "ghost" })}>
            Cancel
          </Link>
          <Button type="submit" form="settings-form" disabled={!canSubmit}>
            {isSubmitting ? "Saving…" : "Save Preferences"}
          </Button>
        </div>
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
                value={
                  models.find((m) => m.id === modelField.state.value)
                    ? {
                        value: modelField.state.value,
                        label:
                          models.find((m) => m.id === modelField.state.value)
                            ?.label ?? "",
                      }
                    : null
                }
                onValueChange={(value) => {
                  if (value) modelField.handleChange(value.value);
                }}
              >
                <ComboboxInput
                  showClear={false}
                  placeholder="Select a model"
                  aria-invalid={invalidOf(modelField.state.meta)}
                />
                <ComboboxContent>
                  <ComboboxList>
                    {models.map((model) => (
                      <ComboboxItem
                        key={model.id}
                        value={{ value: model.id, label: model.label }}
                      >
                        {model.label}
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

          {/* Row 2: Base URL */}
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

            <Field>
              <FieldLabel htmlFor="settings-activation-mode">
                Activation Mode
              </FieldLabel>
              <Combobox
                value={{
                  value: activationModeField.state.value,
                  label:
                    activationModeField.state.value === "hold"
                      ? "Hold to talk"
                      : "Toggle",
                }}
                onValueChange={(value) => {
                  if (value) activationModeField.handleChange(value.value);
                }}
              >
                <ComboboxInput
                  id="settings-activation-mode"
                  showClear={false}
                  placeholder="Select activation mode"
                />
                <ComboboxContent>
                  <ComboboxList>
                    <ComboboxItem value={{ value: "toggle", label: "Toggle" }}>
                      Toggle
                    </ComboboxItem>
                    <ComboboxItem
                      value={{ value: "hold", label: "Hold to talk" }}
                    >
                      Hold to talk
                    </ComboboxItem>
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
            </Field>
          </div>

          {/* Row 4: Audio Device */}
          <Field>
            <FieldLabel htmlFor="settings-input-device">
              Audio Input Capture Device
            </FieldLabel>
            <Combobox
              value={
                resolvedDevice
                  ? {
                      value: inputDeviceIdField.state.value,
                      label: resolvedDevice.name,
                    }
                  : null
              }
              onValueChange={(value) => {
                if (value) inputDeviceIdField.handleChange(value.value);
              }}
            >
              <ComboboxInput
                id="settings-input-device"
                showClear={false}
                placeholder={
                  devices.length ? "Select a device" : "No microphones detected"
                }
              />
              <ComboboxContent>
                <ComboboxList>
                  {devices.map((device) => (
                    <ComboboxItem
                      key={device.id}
                      value={{ value: device.id, label: device.name }}
                    >
                      {device.name}
                    </ComboboxItem>
                  ))}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
            {deviceIsFallback && (
              <FieldDescription>
                The previously selected microphone is unavailable, the system
                default is being used.
              </FieldDescription>
            )}
          </Field>
        </FieldGroup>
      </form>
    </PageLayout>
  );
}
