import { CheckIcon, CopyIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { AppHeaderActions } from "@/components/layout/app-header-actions";
import { PageLayout } from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { RecordingTimer } from "./recording-timer";

function RecordingHeader() {
  return (
    <>
      <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-1.5">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-destructive" />
        <RecordingTimer />
      </div>
      <div className="flex items-center gap-2">
        <AppHeaderActions showSettings />
      </div>
    </>
  );
}

function RecordingBody({
  liveText,
  onChange,
}: {
  liveText: string;
  onChange: (text: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(liveText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

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
  onTextChange,
  onCancel,
}: {
  liveText: string;
  onTextChange: (text: string) => void;
  onCancel: () => void;
}) {
  return (
    <PageLayout
      header={<RecordingHeader />}
      footer={<RecordingFooter onCancel={onCancel} />}
    >
      <RecordingBody liveText={liveText} onChange={onTextChange} />
    </PageLayout>
  );
}
