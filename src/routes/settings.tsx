import { createFileRoute } from "@tanstack/react-router";
import { invoke } from "@tauri-apps/api/core";
import { z } from "zod";

import { type AppSettings, SettingsForm } from "@/components/SettingsForm";

const settingsSearchSchema = z.object({
  tab: z.enum(["general", "audio", "shortcut"]).catch("general"),
});

export const Route = createFileRoute("/settings")({
  validateSearch: settingsSearchSchema,
  loader: async ({ context }) => {
    if (context.settings) return context.settings;
    const settings = await invoke<AppSettings>("get_settings");
    return settings;
  },
  component: SettingsRoute,
});

function SettingsRoute() {
  const settings = Route.useLoaderData();
  return <SettingsForm initialSettings={settings} />;
}
