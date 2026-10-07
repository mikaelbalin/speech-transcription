import { invoke, isTauri } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";

/**
 * Reads the saved global shortcut (`shortcut`) from the Tauri `get_settings`
 * command. Falls back to an empty string when unavailable (e.g. Storybook).
 */
export function useShortcut() {
  const [shortcut, setShortcut] = useState("");

  useEffect(() => {
    if (!isTauri()) return;
    invoke<{ shortcut?: string }>("get_settings")
      .then((s) => setShortcut(s.shortcut ?? ""))
      .catch(() => setShortcut(""));
  }, []);

  return { shortcut };
}
