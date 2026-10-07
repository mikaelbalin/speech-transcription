import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useState } from "react";
import { DictationError } from "@/components/dictation/dictation-error";
import { DictationIdle } from "@/components/dictation/dictation-idle";
import { DictationRecording } from "@/components/dictation/dictation-recording";

export type DictationErrorInfo = {
  code: string;
  message: string;
};

export function Dictation() {
  const [isRecording, setIsRecording] = useState(false);
  const [liveText, setLiveText] = useState("");
  const [error, setError] = useState<DictationErrorInfo | null>(null);

  const start = useCallback(() => {
    invoke("start_transcription");
    setIsRecording(true);
    setError(null);
    setLiveText("");
  }, []);

  const stop = useCallback(() => {
    invoke("stop_transcription");
    setIsRecording(false);
  }, []);

  const toggle = useCallback(() => {
    if (isRecording) {
      stop();
    } else {
      start();
    }
  }, [isRecording, start, stop]);

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
        setError({
          code: "ERR_TRANSCRIPTION",
          message: e.payload,
        });
      }),
    ];

    return () => {
      for (const u of unlisteners) {
        u.then((f) => f());
      }
    };
  }, [toggle]);

  if (error) {
    return <DictationError error={error} onRetry={start} onBack={stop} />;
  }

  if (isRecording) {
    return <DictationRecording liveText={liveText} onCancel={stop} />;
  }

  return <DictationIdle onStart={start} />;
}
