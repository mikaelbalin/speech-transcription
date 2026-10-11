import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useRef, useState } from "react";
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

  // Mirror of `isRecording` kept in a ref so the push-to-talk press/release
  // handlers read the current value synchronously. React state updates are
  // async, so a rapid pedal tap (press+release back-to-back) would otherwise
  // let `dictation-released` observe a stale `isRecording === false` and skip
  // the stop, leaving dictation stuck on.
  const isRecordingRef = useRef(false);

  useEffect(() => {
    invoke<AppSettings>("get_settings")
      .then((s) =>
        setActivationMode(s.activationMode === "hold" ? "hold" : "toggle"),
      )
      .catch(() => {});
  }, []);

  const start = useCallback(() => {
    invoke("start_transcription");
    isRecordingRef.current = true;
    setIsRecording(true);
    setError(null);
    setLiveText("");
  }, []);

  const stop = useCallback(() => {
    invoke("stop_transcription");
    isRecordingRef.current = false;
    setIsRecording(false);
  }, []);

  const toggle = useCallback(() => {
    if (isRecordingRef.current) {
      stop();
    } else {
      start();
    }
  }, [start, stop]);

  useEffect(() => {
    const unlisteners = [
      // A single shortcut press/release. In toggle mode the press toggles
      // dictation; in hold (push-to-talk) mode dictation runs while held.
      listen("dictation-pressed", () => {
        if (activationMode === "hold") {
          if (!isRecordingRef.current) start();
        } else {
          toggle();
        }
      }),
      listen("dictation-released", () => {
        if (activationMode === "hold" && isRecordingRef.current) {
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
  }, [activationMode, start, stop, toggle]);

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
