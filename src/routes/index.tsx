import { createFileRoute, isRedirect, redirect } from "@tanstack/react-router";
import { invoke, isTauri } from "@tauri-apps/api/core";

import { Dictation } from "@/components/pages/dictation";
import type { AppSettings } from "@/components/pages/settings-form";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    // On Linux, guide the user through first-run host setup (auto-paste via
    // uinput) before they land on the dictation screen.
    if (isTauri()) {
      try {
        const settings = await invoke<AppSettings>("get_settings");
        if (!settings.setupCompleted) {
          throw redirect({ to: "/onboarding" });
        }
      } catch (e) {
        // Re-throw redirects; swallow any other error and continue to the
        // dictation screen (setup can be revisited from settings).
        if (isRedirect(e)) throw e;
      }
    }
  },
  component: Index,
});

function Index() {
  return <Dictation />;
}
