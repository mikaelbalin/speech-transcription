import { Check, Mic, X } from "lucide-react";

import { DictationLayout } from "@/components/dictation/dictation-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

function RecordingHeader() {
  return (
    <>
      <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-1.5">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-destructive" />
        <span className="font-mono text-xs font-medium text-destructive">
          LIVE RECORDING
        </span>
        <span className="ml-2 font-mono text-xs text-muted-foreground/80">
          00:04.18
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="h-8 gap-1.5">
          LATENCY 42ms
        </Badge>
        <Badge variant="secondary" className="h-8 gap-1.5">
          CONFIDENCE 99.4%
        </Badge>
      </div>
    </>
  );
}

function RecordingBody({ liveText }: { liveText: string }) {
  return (
    <Card className="flex w-full flex-col">
      <CardHeader className="flex-row items-center justify-between border-b">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
          <span className="text-xs font-medium uppercase tracking-wider text-primary">
            Realtime Voice Stream
          </span>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground/70">
          <span className="flex items-center gap-1">
            <Mic className="size-3.5" />
            Active Target: VS Code • app.tsx
          </span>
        </div>
      </CardHeader>
      <CardContent className="flex min-h-48 flex-1 flex-col gap-2 pt-3">
        <p className="font-mono text-xs text-muted-foreground/60">
          [00:01.12] {/* Incoming streaming audio buffer chunk #419 verified */}
        </p>
        <p className="text-sm leading-relaxed text-foreground">
          {liveText ||
            "...refactor the Tauri backend dispatch handlers to stream incoming Mistral voice tokens directly into the React editor buffer without re-rendering the full document tree."}
        </p>
        <p className="text-sm leading-relaxed text-foreground">
          Ensure backpressure control uses the CPAL mono ring buffer threshold
          to throttle WebSocket frames during intensive syntax highlighting
          passes
          <span className="ml-1 inline-block h-4 w-2 animate-pulse bg-primary" />
        </p>
      </CardContent>
      <CardContent className="flex items-center justify-between border-t pt-2 text-xs text-muted-foreground/60">
        <span className="flex items-center gap-1">
          <Mic className="size-3.5 text-primary" />
          16kHz Mono PCM • 42 tokens generated
        </span>
        <Badge variant="secondary" className="font-mono">
          Live Injection Target: Buffer Ln 142, Col 8
        </Badge>
      </CardContent>
    </Card>
  );
}

function RecordingFooter({ onCancel }: { onCancel: () => void }) {
  return (
    <>
      <Button variant="outline" onClick={onCancel}>
        <X className="size-4" />
        Cancel Dictation
      </Button>
      <Button onClick={onCancel}>
        <Check className="size-4" />
        Inject to App
      </Button>
    </>
  );
}

export function DictationRecording({
  liveText,
  onCancel,
}: {
  liveText: string;
  onCancel: () => void;
}) {
  return (
    <DictationLayout
      header={<RecordingHeader />}
      footer={<RecordingFooter onCancel={onCancel} />}
    >
      <RecordingBody liveText={liveText} />
    </DictationLayout>
  );
}
