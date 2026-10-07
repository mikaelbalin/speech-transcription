import { useField, useForm, useSelector } from "@tanstack/react-form";
import { invoke } from "@tauri-apps/api/core";
import { useEffect } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

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

export function SettingsForm({
  initialSettings,
}: {
  initialSettings?: AppSettings | null;
}) {
  const form = useForm({
    defaultValues: {
      apiKey: initialSettings?.apiKey ?? "",
      model: initialSettings?.model ?? "voxtral-mini-transcribe-realtime-2602",
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
        <CardTitle>Settings</CardTitle>
        <CardDescription>
          Mistral API key, model, and dictation hotkey.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
        >
          <FieldGroup>
            <Field data-invalid={invalidOf(apiKeyField.state.meta)}>
              <FieldLabel htmlFor="settings-api-key">API key</FieldLabel>
              <Input
                id="settings-api-key"
                name={apiKeyField.name}
                type="password"
                value={apiKeyField.state.value}
                onBlur={apiKeyField.handleBlur}
                onChange={(e) => apiKeyField.handleChange(e.target.value)}
                aria-invalid={invalidOf(apiKeyField.state.meta)}
                placeholder="Your Mistral API key"
                autoComplete="off"
              />
              {invalidOf(apiKeyField.state.meta) && (
                <FieldError errors={apiKeyField.state.meta.errors} />
              )}
            </Field>

            <Field data-invalid={invalidOf(modelField.state.meta)}>
              <FieldLabel htmlFor="settings-model">Model</FieldLabel>
              <Input
                id="settings-model"
                name={modelField.name}
                value={modelField.state.value}
                onBlur={modelField.handleBlur}
                onChange={(e) => modelField.handleChange(e.target.value)}
                aria-invalid={invalidOf(modelField.state.meta)}
                autoComplete="off"
              />
              {invalidOf(modelField.state.meta) && (
                <FieldError errors={modelField.state.meta.errors} />
              )}
            </Field>

            <Field data-invalid={invalidOf(baseUrlField.state.meta)}>
              <FieldLabel htmlFor="settings-base-url">Base URL</FieldLabel>
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
              <FieldLabel htmlFor="settings-shortcut">Hotkey</FieldLabel>
              <Input
                id="settings-shortcut"
                name={shortcutField.name}
                value={shortcutField.state.value}
                onBlur={shortcutField.handleBlur}
                onChange={(e) => shortcutField.handleChange(e.target.value)}
                aria-invalid={invalidOf(shortcutField.state.meta)}
                autoComplete="off"
              />
              {invalidOf(shortcutField.state.meta) && (
                <FieldError errors={shortcutField.state.meta.errors} />
              )}
            </Field>
          </FieldGroup>

          <div className="mt-6">
            <Button type="submit" disabled={!canSubmit}>
              {isSubmitting ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
