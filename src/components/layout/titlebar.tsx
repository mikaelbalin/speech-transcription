import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const appWindow = isTauri() ? getCurrentWindow() : null;

/**
 * Custom window titlebar (used when Tauri is configured with
 * `decorations: false`). Provides a draggable region and the standard
 * minimize / maximize / close controls, plus the theme toggle.
 */
export function Titlebar() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!appWindow) return;

    let disposed = false;

    appWindow.isMaximized().then((value) => {
      if (!disposed) setMaximized(value);
    });

    const unlisten = appWindow.onResized(async () => {
      const value = await appWindow.isMaximized();
      if (!disposed) setMaximized(value);
    });

    return () => {
      disposed = true;
      unlisten.then((fn) => fn());
    };
  }, []);

  return (
    <div className="flex h-9 items-center bg-muted select-none px-1">
      <div data-tauri-drag-region className="flex-1 self-stretch" />

      <div className="flex items-center">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            onClick={() => appWindow?.minimize()}
            aria-label="Minimize"
            size="icon-sm"
            variant="ghost"
          >
            <Minus className="size-4" />
          </Button>

          <Button
            type="button"
            onClick={() => appWindow?.toggleMaximize()}
            aria-label={maximized ? "Restore" : "Maximize"}
            size="icon-sm"
            variant="ghost"
          >
            <Square className="size-4" />
          </Button>

          <Button
            type="button"
            onClick={() => appWindow?.close()}
            aria-label="Close"
            size="icon-sm"
            variant="ghost"
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
