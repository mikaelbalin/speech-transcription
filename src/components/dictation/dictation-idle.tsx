import { Link } from "@tanstack/react-router";
import { Mic } from "lucide-react";

import { AppHeaderActions } from "@/components/layout/app-header-actions";
import { PageLayout } from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Kbd } from "@/components/ui/kbd";
import { shortcutParts } from "@/lib/shortcut";
import { type InputDevice, useInputDevices } from "@/lib/use-input-devices";
import { useShortcut } from "@/lib/use-shortcut";

function IdleHeader({ device }: { device?: InputDevice | null }) {
  const ready = Boolean(device);

  return (
    <>
      <div className="flex h-8 items-center gap-2 rounded-lg bg-muted px-3 text-sm">
        <div
          className={
            ready
              ? "h-2 w-2 shrink-0 rounded-full bg-emerald-500"
              : "h-2 w-2 shrink-0 rounded-full bg-destructive"
          }
        />

        <span className="text-muted-foreground">Input:</span>
        <span className="inline-flex items-center font-mono text-xs leading-none text-foreground">
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
    <Card className="flex w-full flex-row items-center justify-between gap-4 px-4 py-3">
      <div className="flex flex-col text-left gap-1">
        <span className="text-xs font-medium text-card-foreground">
          Awaiting voice capture
        </span>
        <span className="text-xs text-muted-foreground">
          Press trigger or begin speaking to buffer audio stream
        </span>
      </div>

      {parts.length ? (
        <div className="flex gap-1">
          {parts.map(({ key, node }, i) => (
            <span key={key} className="flex items-center gap-1">
              {i > 0 && <span className="text-muted-foreground">+</span>}
              <Kbd>{node}</Kbd>
            </span>
          ))}
        </div>
      ) : (
        <Button size="sm" render={<Link to="/settings" />}>
          Configure trigger
        </Button>
      )}
    </Card>
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
