import { Mic } from "lucide-react";

import { DictationLayout } from "@/components/dictation/dictation-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function IdleHeader() {
  return (
    <>
      <div className="flex h-8 items-center gap-2 rounded-lg bg-muted px-3 text-sm">
        <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
        <span className="text-muted-foreground">Input:</span>
        <span className="font-mono text-xs text-foreground">
          MacBook Pro Mic (48kHz)
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="h-8 uppercase">
          Mistral AI • Large-v3
        </Badge>
        <Badge variant="secondary" className="h-8 gap-1.5">
          LATENCY ~140ms
        </Badge>
      </div>
    </>
  );
}

function IdleBody({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-8 text-center">
      <Button
        onClick={onStart}
        size="icon"
        className="h-28 w-28 rounded-full"
        aria-label="Start dictation"
      >
        <Mic className="size-9" />
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
          <kbd className="rounded bg-accent px-2 py-0.5 text-foreground">
            Option
          </kbd>
          <span className="text-muted-foreground">+</span>
          <kbd className="rounded bg-accent px-2 py-0.5 text-foreground">
            Space
          </kbd>
        </span>
      </div>
    </div>
  );
}

function IdleFooter() {
  return (
    <div className="flex w-full items-center justify-between rounded-xl bg-muted p-3">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-background text-muted-foreground">
          <Mic className="size-4" />
        </div>
        <div className="flex flex-col text-left">
          <span className="font-mono text-xs text-muted-foreground">
            Awaiting voice capture...
          </span>
          <span className="text-xs text-muted-foreground/60">
            Press trigger or begin speaking to buffer audio stream
          </span>
        </div>
      </div>
      <Badge variant="outline" className="uppercase">
        VAD STANDBY
      </Badge>
    </div>
  );
}

export function DictationIdle({ onStart }: { onStart: () => void }) {
  return (
    <DictationLayout header={<IdleHeader />} footer={<IdleFooter />}>
      <IdleBody onStart={onStart} />
    </DictationLayout>
  );
}
