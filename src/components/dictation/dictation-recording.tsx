import { CheckIcon, CopyIcon, MicOff, XIcon } from "lucide-react";
import { useState } from "react";
import { AppHeaderActions } from "@/components/layout/app-header-actions";
import { PageLayout } from "@/components/layout/page-layout";
import type { DictationErrorInfo } from "@/components/pages/dictation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { StatusDot } from "@/components/ui/status-dot";
import { RecordingTimer } from "./recording-timer";

function RecordingHeader({ error }: { error: DictationErrorInfo | null }) {
  return (
    <>
      <div className="flex items-center gap-3">
        <div className="flex h-8 items-center gap-3 rounded-lg bg-destructive/10 px-3 text-sm">
          <StatusDot variant="destructive" pulse={!error} />
          <RecordingTimer paused={!!error} />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <AppHeaderActions showSettings />
      </div>
    </>
  );
}

function RecordingErrorBody({
  error,
  onRetry,
}: {
  error: DictationErrorInfo;
  onRetry: () => void;
}) {
  return (
    <Item variant="muted" className="items-start bg-destructive/10">
      <ItemMedia>
        <MicOff className="size-5" />
      </ItemMedia>
      <ItemContent className="text-left">
        <div className="flex items-center justify-between">
          <ItemTitle className="text-base font-semibold">
            Microphone Capture Permitted Failed
          </ItemTitle>
          <Badge variant="destructive" className="font-mono">
            {error.code}
          </Badge>
        </div>
        <ItemDescription className="leading-relaxed">
          {error.message}
        </ItemDescription>
        <Button
          variant="destructive"
          size="lg"
          onClick={onRetry}
          className="w-fit"
        >
          Retry
        </Button>
      </ItemContent>
    </Item>
  );
}

function RecordingBody({
  liveText,
  error,
  onChange,
  onRetry,
}: {
  liveText: string;
  error: DictationErrorInfo | null;
  onChange: (text: string) => void;
  onRetry: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(liveText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  if (error) {
    return <RecordingErrorBody error={error} onRetry={onRetry} />;
  }

  return (
    <InputGroup className="h-auto has-[[data-slot=input-group-control]:focus-visible]:border-input has-[[data-slot=input-group-control]:focus-visible]:ring-0">
      <InputGroupTextarea
        value={liveText}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-48 focus-visible:ring-0 focus-visible:border-transparent"
        aria-label="Dictated text"
        disabled={!liveText}
      />
      <InputGroupAddon align="block-end">
        <InputGroupButton
          onClick={handleCopy}
          size="icon-sm"
          disabled={!liveText}
          aria-label="Copy text"
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
        </InputGroupButton>
        <InputGroupButton
          onClick={() => onChange("")}
          size="icon-sm"
          disabled={!liveText}
          aria-label="Clear text"
        >
          <XIcon />
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  );
}

function RecordingFooter({ onCancel }: { onCancel: () => void }) {
  return (
    <div className="flex items-center ml-auto gap-2">
      <Button variant="ghost" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}

export function DictationRecording({
  liveText,
  error,
  onTextChange,
  onCancel,
  onRetry,
}: {
  liveText: string;
  error: DictationErrorInfo | null;
  onTextChange: (text: string) => void;
  onCancel: () => void;
  onRetry: () => void;
}) {
  return (
    <PageLayout
      header={<RecordingHeader error={error} />}
      footer={<RecordingFooter onCancel={onCancel} />}
    >
      <RecordingBody
        liveText={liveText}
        error={error}
        onChange={onTextChange}
        onRetry={onRetry}
      />
    </PageLayout>
  );
}
