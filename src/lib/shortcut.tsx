/**
 * Helpers for the Tauri global-shortcut string format used by the app's
 * `shortcut` setting (e.g. `"ctrl+alt+space"`).
 */

import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from "lucide-react";
import type { ReactNode } from "react";

const MODIFIER_LABELS: Record<string, string> = {
  ctrl: "Ctrl",
  control: "Ctrl",
  shift: "Shift",
  alt: "Alt",
  option: "Alt",
  meta: "Super",
  super: "Super",
  cmd: "Super",
  command: "Super",
  win: "Super",
};

function formatKey(key: string): ReactNode {
  const lower = key.toLowerCase();
  if (lower === "space") return "Space";
  if (lower === "esc" || lower === "escape") return "Esc";
  if (lower === "enter" || lower === "return") return "Enter";
  if (lower === "backspace") return "Backspace";
  if (lower === "delete" || lower === "del") return "Del";
  if (lower === "insert" || lower === "ins") return "Ins";
  if (lower === "pageup") return "PgUp";
  if (lower === "pagedown") return "PgDn";
  if (lower === "arrowup") return <ArrowUp className="size-3" />;
  if (lower === "arrowdown") return <ArrowDown className="size-3" />;
  if (lower === "arrowleft") return <ArrowLeft className="size-3" />;
  if (lower === "arrowright") return <ArrowRight className="size-3" />;
  if (lower === "tab") return "Tab";
  if (lower === "minus") return "-";
  if (lower === "equal") return "=";
  if (lower === "bracketleft") return "[";
  if (lower === "bracketright") return "]";
  if (lower === "semicolon") return ";";
  if (lower === "quote") return "'";
  if (lower === "backquote") return "`";
  if (lower === "backslash") return "\\";
  if (lower === "comma") return ",";
  if (lower === "period") return ".";
  if (lower === "slash") return "/";
  return key.toUpperCase();
}

/**
 * Splits a Tauri shortcut string into human-readable key parts for rendering
 * as `<Kbd>` chips. Order is normalized to modifiers-first. Arrow keys are
 * rendered as lucide icons; everything else as text.
 *
 * Example: `"ctrl+alt+space"` → `["Ctrl", "Alt", "Space"]`.
 */
export function shortcutParts(
  shortcut: string,
): { key: string; node: ReactNode }[] {
  const tokens = shortcut
    .split("+")
    .map((t) => t.trim())
    .filter(Boolean);

  const parts: { key: string; node: ReactNode }[] = [];

  for (const token of tokens) {
    const lower = token.toLowerCase();
    const label = MODIFIER_LABELS[lower];
    parts.push(
      label
        ? { key: token, node: label }
        : { key: token, node: formatKey(token) },
    );
  }

  // Normalize to modifiers-first for display.
  const modifiers = parts.filter(
    (p) => typeof p.node === "string" && MODIFIER_LABELS[p.key.toLowerCase()],
  );
  const keys = parts.filter((p) => !MODIFIER_LABELS[p.key.toLowerCase()]);

  return [...modifiers, ...keys];
}
