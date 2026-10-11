import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Mic, MicOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { DictationTranscript } from "@/components/dictation/dictation-transcript";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { shortcutParts } from "@/lib/shortcut";
import { VolumeMeter } from "../components/volume-meter";

type Status = "recording" | "error";

/**
 * The recording overlay HUD.
 */
export default function Overlay() {
  const [status, setStatus] = useState<Status>("recording");
  const [error, setError] = useState("");
  const [paused, setPaused] = useState(false);
  const [shortcut, setShortcut] = useState("");
  const [transcript, setTranscript] = useState("");
  const levelRef = useRef<number>(0);
  // Mirror of `paused` kept in a ref so the `pause-pressed` listener (registered
  // once on mount) reads the current value instead of a stale closure.
  const pausedRef = useRef(false);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  const togglePause = useCallback(() => {
    const next = !pausedRef.current;
    pausedRef.current = next;
    setPaused(next);
    invoke(next ? "pause_transcription" : "resume_transcription").catch((e) =>
      console.error(e),
    );
  }, []);

  useEffect(() => {
    invoke<{ shortcut?: string }>("get_settings")
      .then((s) => setShortcut(s.shortcut ?? ""))
      .catch(() => setShortcut(""));
  }, []);

  useEffect(() => {
    const unlisteners = [
      listen<string>("transcription-error", (e) => {
        setError(e.payload);
        setStatus("error");
      }),
      listen("show-overlay", () => {
        setStatus("recording");
        setPaused(false);
        setTranscript("");
      }),
      listen<number>("audio-level", (e) => {
        levelRef.current = e.payload;
      }),
      listen("paused", () => {
        setPaused(true);
      }),
      listen("resumed", () => {
        setPaused(false);
      }),
      listen("pause-pressed", () => {
        togglePause();
      }),
      listen<string>("transcription-delta", (e) => {
        setTranscript((prev) => prev + e.payload);
      }),
    ];

    return () => {
      for (const u of unlisteners) {
        u.then((f) => f());
      }
    };
  }, [togglePause]);

  const handleClear = () => {
    setTranscript("");
    invoke("clear_transcription").catch((e) => console.error(e));
  };

  const stopParts = shortcutParts(shortcut);
  const isError = status === "error";

  return (
    <main className="flex h-full w-full flex-col overflow-hidden select-none rounded-[20px] bg-background/85 px-4 pt-1.5 pb-4">
      <div className="flex items-center gap-4">
        <Button
          type="button"
          variant={isError ? "destructive" : "secondary"}
          size="icon-sm"
          onClick={togglePause}
          aria-label={paused ? "Resume" : "Pause"}
          className="rounded-[14px]"
          disabled={isError}
        >
          {paused || isError ? (
            <MicOff className="size-3.5" />
          ) : (
            <Mic className="size-3.5" />
          )}
        </Button>
        {isError ? (
          <>
            <div className="text-[13px] font-medium text-destructive whitespace-nowrap text-ellipsis overflow-hidden">
              {error}
            </div>

            <Button
              type="button"
              onClick={() => setStatus("recording")}
              size="sm"
              variant="destructive"
            >
              Retry
            </Button>
          </>
        ) : (
          <>
            <VolumeMeter levelRef={levelRef} live={!paused} />

            {stopParts.length ? (
              <span className="flex items-center gap-1 font-mono text-xs">
                {stopParts.map(({ key, node }, i) => (
                  <span key={key} className="flex items-center gap-1">
                    {i > 0 && <span className="text-muted-foreground">+</span>}
                    <Kbd>{node}</Kbd>
                  </span>
                ))}
              </span>
            ) : null}
          </>
        )}
      </div>

      <DictationTranscript text={transcript} onClear={handleClear} />
    </main>
  );
}
