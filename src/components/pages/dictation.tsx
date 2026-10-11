import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useState } from "react";
import { DictationIdle } from "@/components/dictation/dictation-idle";
import { DictationRecording } from "@/components/dictation/dictation-recording";
import type { AppSettings } from "@/components/pages/settings-form";

export type DictationErrorInfo = {
  code: string;
  message: string;
};

export function Dictation() {
  const [isRecording, setIsRecording] = useState(false);
  const [liveText, setLiveText] = useState("");
  const [error, setError] = useState<DictationErrorInfo | null>(null);
  const [activationMode, setActivationMode] = useState<"toggle" | "hold">(
    "toggle",
  );

  useEffect(() => {
    invoke<AppSettings>("get_settings")
      .then((s) =>
        setActivationMode(s.activationMode === "hold" ? "hold" : "toggle"),
      )
      .catch(() => {});
  }, []);

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
      // A single shortcut press/release. In toggle mode the press toggles
      // dictation; in hold (push-to-talk) mode dictation runs while held.
      listen("dictation-pressed", () => {
        if (activationMode === "hold") {
          if (!isRecording) start();
        } else {
          toggle();
        }
      }),
      listen("dictation-released", () => {
        if (activationMode === "hold" && isRecording) {
          stop();
        }
      }),
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
  }, [activationMode, isRecording, start, stop, toggle]);

  if (isRecording) {
    return (
      <DictationRecording
        liveText={liveText}
        error={error}
        onTextChange={setLiveText}
        onCancel={stop}
        onRetry={start}
      />
    );
  }

  return <DictationIdle onStart={start} />;
}
