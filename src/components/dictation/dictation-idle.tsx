import { Mic } from "lucide-react";

import { AppHeaderActions } from "@/components/layout/app-header-actions";
import { PageLayout } from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { type InputDevice, useInputDevices } from "@/lib/use-input-devices";

function IdleHeader({ device }: { device?: InputDevice | null }) {
  const ready = Boolean(device);

  return (
    <>
      <div className="flex h-8 items-center gap-2 rounded-lg bg-muted px-3 text-sm">
        <span
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
      <Button
        onClick={onStart}
        variant="ghost"
        size="icon"
        className="h-28 w-28 rounded-full border-0 bg-linear-to-b from-secondary to-muted animate-pulse-glow transition-transform duration-300 hover:scale-105 hover:animate-pulse-glow-strong active:scale-95"
        aria-label="Start dictation"
      >
        <span className="flex flex-col items-center justify-center gap-0.5">
          <Mic className="size-9 text-primary" />
          <span className="font-mono text-xs font-bold tracking-wider text-primary">
            READY
          </span>
        </span>
      </Button>

      <div className="flex flex-col items-center gap-1">
        <h2 className="text-lg font-medium tracking-tight">Press to Dictate</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Realtime speech-to-text token stream routed directly to your active
          focused application.
        </p>
      </div>
      <div className="flex items-center gap-2 rounded-full bg-muted px-4 py-2 text-sm">
        <span className="text-muted-foreground">Global trigger:</span>
        <span className="flex items-center gap-1 font-mono text-xs">
          <Kbd className="bg-background text-foreground">Option</Kbd>
          <span className="text-muted-foreground">+</span>
          <Kbd className="bg-background text-foreground">Space</Kbd>
        </span>
      </div>
    </div>
  );
}

export function DictationIdle({ onStart }: { onStart: () => void }) {
  const { selectedDevice } = useInputDevices();

  return (
    <PageLayout header={<IdleHeader device={selectedDevice} />}>
      <IdleBody onStart={onStart} />
    </PageLayout>
  );
}
