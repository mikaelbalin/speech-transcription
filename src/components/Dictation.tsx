import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

export function Dictation() {
  const [isRecording, setIsRecording] = useState(false);
  const [liveText, setLiveText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const toggle = useCallback(() => {
    if (isRecording) {
      invoke("stop_transcription");
      setIsRecording(false);
    } else {
      invoke("start_transcription");
      setIsRecording(true);
      setError(null);
      setLiveText("");
    }
  }, [isRecording]);

  useEffect(() => {
    const unlisteners = [
      listen("toggle-dictation", () => toggle()),
      listen<string>("transcription-delta", (e) => {
        setLiveText((t) => t + e.payload);
      }),
      listen("transcription-done", () => {
        setLiveText("");
      }),
      listen<string>("transcription-error", (e) => {
        setError(e.payload);
      }),
    ];

    return () => {
      for (const u of unlisteners) {
        u.then((f) => f());
      }
    };
  }, [toggle]);

  return (
    <div className="flex flex-col gap-4">
      <Button
        onClick={toggle}
        variant={isRecording ? "destructive" : "default"}
      >
        {isRecording ? "Stop" : "Start dictation"}
      </Button>

      {liveText && <p className="text-sm text-muted-foreground">{liveText}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
