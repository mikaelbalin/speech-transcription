import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Mic, MicOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
  const levelRef = useRef<number>(0);

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
    ];

    return () => {
      for (const u of unlisteners) {
        u.then((f) => f());
      }
    };
  }, []);

  const togglePause = () => {
    invoke(paused ? "resume_transcription" : "pause_transcription").catch((e) =>
      console.error(e),
    );
  };

  const stopParts = shortcutParts(shortcut);
  const isError = status === "error";

  return (
    <main className="flex h-full w-full items-center justify-between gap-3 overflow-hidden select-none rounded-[20px] bg-background/95 px-4 py-1.5">
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
          <div className="text-[13px] font-medium text-destructive">
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
    </main>
  );
}
