import { useEffect, useRef } from "react";
import { useAudioLevel } from "../lib/use-audio-level";

/** DPR-aware canvas volume meter (modeled on the chatbot `volume-meter`). */
export function VolumeMeter({
  levelRef,
  live,
}: {
  levelRef: React.RefObject<number>;
  live: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useAudioLevel(canvasRef, levelRef, live);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const update = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = wrap.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
    };

    const observer = new ResizeObserver(update);
    observer.observe(wrap);
    update();

    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={wrapRef}
      className="relative h-5 flex-1 min-w-0 bg-background/95 before:absolute before:inset-y-0 before:left-0 before:w-4 before:bg-linear-to-r before:from-background/95 before:to-transparent before:pointer-events-none before:z-10 after:absolute after:inset-y-0 after:right-0 after:w-4 after:bg-linear-to-l after:from-background/95 after:to-transparent after:pointer-events-none after:z-10"
    >
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}
