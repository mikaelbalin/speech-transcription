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
      listen<string>("transcription-done", (e) => {
        setLiveText("");
        setError(null);
        void e.payload;
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
    <div className="flex w-full max-w-md flex-col gap-4">
      <div className="flex items-center gap-3">
        <Button
          onClick={toggle}
          variant={isRecording ? "destructive" : "default"}
        >
          {isRecording ? "Stop" : "Start dictation"}
        </Button>
        {isRecording && (
          <span className="text-sm text-muted-foreground">Listening…</span>
        )}
      </div>

      <textarea
        readOnly
        value={liveText}
        placeholder="Transcribed text will appear here…"
        className="min-h-32 w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      />

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
