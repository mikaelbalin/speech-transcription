import { createFileRoute } from "@tanstack/react-router";
import { invoke } from "@tauri-apps/api/core";

import {
  type AppSettings,
  SettingsForm,
} from "@/components/pages/settings-form";

export const Route = createFileRoute("/settings")({
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
