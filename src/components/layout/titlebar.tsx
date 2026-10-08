import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Copy, Minus, Square, X } from "lucide-react";
import { useEffect, useState } from "react";
import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarShortcut,
  MenubarTrigger,
} from "@/components/ui/menubar";

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

  async function toggleFullscreen() {
    if (!appWindow) return;
    const isFullscreen = await appWindow.isFullscreen();
    await appWindow.setFullscreen(!isFullscreen);
  }

  return (
    <div className="flex h-9 items-center bg-muted select-none px-1">
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger>File</MenubarTrigger>
          <MenubarContent>
            <MenubarItem onClick={() => appWindow?.close()}>
              Quit
              <MenubarShortcut>Ctrl+Q</MenubarShortcut>
            </MenubarItem>
          </MenubarContent>
        </MenubarMenu>

        <MenubarMenu>
          <MenubarTrigger>View</MenubarTrigger>
          <MenubarContent className="min-w-58">
            <MenubarItem onClick={() => window.location.reload()}>
              Reload
              <MenubarShortcut>Ctrl+R</MenubarShortcut>
            </MenubarItem>

            <MenubarItem onClick={toggleFullscreen}>
              Toggle Fullscreen
              <MenubarShortcut>F11</MenubarShortcut>
            </MenubarItem>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>

      <div data-tauri-drag-region className="flex-1 self-stretch" />

      <div className="flex items-center">
        <ModeToggle />

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
            {maximized ? (
              <Copy className="size-4" />
            ) : (
              <Square className="size-4" />
            )}
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
