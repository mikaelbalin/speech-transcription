import { useCallback, useEffect, useState } from "react";

/**
 * Codes that only modify a key; recording skips them until a non-modifier key
 * is pressed so the final shortcut includes a real key.
 */
const MODIFIER_CODES = [
  "ControlLeft",
  "ControlRight",
  "ShiftLeft",
  "ShiftRight",
  "AltLeft",
  "AltRight",
  "MetaLeft",
  "MetaRight",
];

function isModifier(code: string): boolean {
  return MODIFIER_CODES.includes(code);
}

/**
 * Captures a keyboard shortcut as a Tauri global-shortcut string (e.g.
 * `"ctrl+alt+space"`), following the stream-deck "record a key" pattern.
 */
export function useShortcutRecorder(onRecord: (shortcut: string) => void) {
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    if (!recording) return;

    function handleKeyDown(event: KeyboardEvent) {
      event.preventDefault();
      event.stopPropagation();

      if (event.code === "Escape") {
        setRecording(false);
        return;
      }

      if (isModifier(event.code)) {
        return;
      }

      const parts: string[] = [];
      if (event.ctrlKey) parts.push("ctrl");
      if (event.shiftKey) parts.push("shift");
      if (event.altKey) parts.push("alt");
      if (event.metaKey) parts.push("super");
      parts.push(event.code.toLowerCase());

      setRecording(false);
      onRecord(parts.join("+"));
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [recording, onRecord]);

  const toggleRecording = useCallback(() => {
    setRecording((current) => !current);
  }, []);

  return { recording, toggleRecording };
}
