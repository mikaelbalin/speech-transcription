import { Link } from "@tanstack/react-router";
import { Mic } from "lucide-react";

import { AppHeaderActions } from "@/components/layout/app-header-actions";
import { PageLayout } from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@/components/ui/item";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { StatusDot } from "@/components/ui/status-dot";
import { shortcutParts } from "@/lib/shortcut";
import { type InputDevice, useInputDevices } from "@/lib/use-input-devices";
import { useShortcut } from "@/lib/use-shortcut";

function IdleHeader({ device }: { device?: InputDevice | null }) {
  const ready = Boolean(device);

  return (
    <>
      <div className="flex h-8 items-center gap-2 rounded-lg bg-muted px-3 text-sm">
        <StatusDot variant={ready ? "success" : "destructive"} />

        <span className="text-muted-foreground">Input:</span>
        <span className="font-mono text-xs leading-none text-foreground">
          {device?.name ?? "No microphone detected"}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <AppHeaderActions showSettings />
      </div>
    </>
  );
}

function IdleBody({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-8 text-center">
      <div className="group relative cursor-pointer">
        <div className="absolute -inset-3 rounded-full bg-glow-soft/40 blur-xl transition-all animate-pulse group-hover:bg-glow-soft/70" />
        <Button
          onClick={onStart}
          variant="ghost"
          size="icon"
          className="relative h-28 w-28 rounded-full border-0 bg-linear-to-b from-button-from to-button-to shadow-button transition-transform duration-300 hover:scale-105 active:scale-95"
          aria-label="Start dictation"
        >
          <span className="flex flex-col items-center justify-center gap-0.5">
            <Mic className="mb-0.5 size-9 text-button-icon" />
            <span className="font-mono text-xs font-bold tracking-wider text-button-label">
              READY
            </span>
          </span>
        </Button>
      </div>
    </div>
  );
}

function IdleFooter() {
  const { shortcut } = useShortcut();
  const parts = shortcutParts(shortcut);

  return (
    <Item variant="outline">
      <ItemContent>
        <ItemTitle>Awaiting voice capture</ItemTitle>
        <ItemDescription>
          Press trigger or begin speaking to buffer audio stream
        </ItemDescription>
      </ItemContent>

      {parts.length ? (
        <ItemActions>
          <KbdGroup>
            {parts.map(({ key, node }, i) => (
              <span key={key} className="flex items-center gap-1">
                {i > 0 && <span className="text-muted-foreground">+</span>}
                <Kbd>{node}</Kbd>
              </span>
            ))}
          </KbdGroup>
        </ItemActions>
      ) : (
        <ItemActions>
          <Button size="sm" render={<Link to="/settings" />}>
            Configure trigger
          </Button>
        </ItemActions>
      )}
    </Item>
  );
}

export function DictationIdle({ onStart }: { onStart: () => void }) {
  const { selectedDevice } = useInputDevices();

  return (
    <PageLayout
      header={<IdleHeader device={selectedDevice} />}
      footer={<IdleFooter />}
    >
      <IdleBody onStart={onStart} />
    </PageLayout>
  );
}
