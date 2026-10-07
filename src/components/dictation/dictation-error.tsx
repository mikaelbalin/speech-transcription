import { ArrowLeft, MicOff, RefreshCw } from "lucide-react";
import { DictationLayout } from "@/components/dictation/dictation-layout";
import type { DictationErrorInfo } from "@/components/pages/dictation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function ErrorHeader({ error }: { error: DictationErrorInfo }) {
  return (
    <div className="flex w-full items-start gap-3 rounded-xl bg-destructive/10 p-3">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-destructive text-destructive-foreground">
        <MicOff className="size-5" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1 text-left">
        <div className="flex items-center justify-between">
          <span className="text-base font-semibold">
            Microphone Capture Permitted Failed
          </span>
          <Badge variant="destructive" className="font-mono">
            {error.code}
          </Badge>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {error.message}
        </p>
      </div>
    </div>
  );
}

function ErrorBody() {
  return (
    <Card className="my-auto">
      <CardHeader>
        <CardTitle>Troubleshooting Steps</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-center gap-3 rounded-lg bg-muted p-2.5">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent font-mono text-xs">
            1
          </span>
          <span className="flex-1 text-sm text-muted-foreground">
            Open{" "}
            <strong>
              System Settings &gt; Privacy &amp; Security &gt; Microphone
            </strong>{" "}
            and enable WhisperPulse.
          </span>
          <Button variant="outline" size="sm" className="font-mono text-xs">
            Open Settings
          </Button>
        </div>
        <div className="flex items-center gap-3 rounded-lg bg-muted p-2.5">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent font-mono text-xs">
            2
          </span>
          <span className="flex-1 text-sm text-muted-foreground">
            Inspect Mistral AI Cloud WebSocket connectivity and API Token
            validity.
          </span>
        </div>
        <div className="flex items-center gap-3 rounded-lg bg-muted p-2.5">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent font-mono text-xs">
            3
          </span>
          <span className="flex-1 text-sm text-muted-foreground">
            Ensure audio hardware sample rate is compatible (supported: 16kHz -
            48kHz).
          </span>
          <Badge variant="secondary" className="font-mono">
            OK (48kHz)
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function ErrorFooter({
  onBack,
  onRetry,
}: {
  onBack: () => void;
  onRetry: () => void;
}) {
  return (
    <>
      <Button variant="outline" onClick={onBack}>
        <ArrowLeft className="size-4" />
        Back to Idle
      </Button>
      <Button variant="destructive" onClick={onRetry}>
        <RefreshCw className="size-4" />
        Retry Connection
      </Button>
    </>
  );
}

export function DictationError({
  error,
  onRetry,
  onBack,
}: {
  error: DictationErrorInfo;
  onRetry: () => void;
  onBack: () => void;
}) {
  return (
    <DictationLayout
      header={<ErrorHeader error={error} />}
      footer={<ErrorFooter onBack={onBack} onRetry={onRetry} />}
    >
      <ErrorBody />
    </DictationLayout>
  );
}
