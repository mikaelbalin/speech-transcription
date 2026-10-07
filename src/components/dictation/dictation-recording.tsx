import { AppHeaderActions } from "@/components/layout/app-header-actions";
import { PageLayout } from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

function RecordingHeader() {
  return (
    <>
      <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-1.5">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-destructive" />
        <span className="font-mono text-xs font-medium text-destructive">
          LIVE RECORDING
        </span>
      </div>
      <div className="flex items-center gap-2">
        <AppHeaderActions showSettings />
      </div>
    </>
  );
}

function RecordingBody({ liveText }: { liveText: string }) {
  return (
    <Card className="flex w-full flex-col">
      <CardContent className="min-h-48">
        <p className="text-sm leading-relaxed text-foreground">{liveText}</p>
      </CardContent>
    </Card>
  );
}

function RecordingFooter({ onCancel }: { onCancel: () => void }) {
  return (
    <div className="flex items-center ml-auto gap-2">
      <Button onClick={onCancel}>Cancel Dictation</Button>
    </div>
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
    <PageLayout
      header={<RecordingHeader />}
      footer={<RecordingFooter onCancel={onCancel} />}
    >
      <RecordingBody liveText={liveText} />
    </PageLayout>
  );
}
