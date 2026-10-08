import { useEffect, useRef } from "react";

/**
 * Live input-level meter for the overlay HUD.
 *
 * The overlay window does not capture the microphone itself — the Rust backend
 * streams raw PCM and emits normalized `audio-level` events (0..1). The
 * subscription to those events lives in `Overlay.tsx` (alongside the other
 * `transcription-*` listeners); this hook only renders the animated bar meter,
 * reading the latest level from a shared ref.
 */

const BAR_WIDTH = 2;
const BAR_BORDER_RADIUS = 4; // in CSS pixels
const MIN_BAR_HEIGHT = 4;
const GAP_WIDTH = 3;
const SCROLL_SPEED = 30; // pixels per second
const BAR_SPACING = BAR_WIDTH + GAP_WIDTH;

/**
 * Resolves the meter bar color from the project's `--destructive` token.
 * The token is defined as `rgb(...)`, which the 2D canvas `fillStyle` accepts
 * directly (no oklch conversion needed).
 */
const resolveColor = (): string => {
  const style = getComputedStyle(document.documentElement);
  return style.getPropertyValue("--destructive").trim() || "rgb(231 0 11)";
};

const drawBars = (
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  dpr: number,
  cssWidth: number,
  cssHeight: number,
  bars: number[],
  scrollOffset: number,
  color: string,
) => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = color;

  ctx.save();
  ctx.scale(dpr, dpr);

  for (let i = 0; i < bars.length; i++) {
    const barHeight = bars[i];
    const y = (cssHeight - barHeight) / 2;

    const barsFromRight = bars.length - i - 1;
    const x = cssWidth - BAR_WIDTH - barsFromRight * BAR_SPACING - scrollOffset;

    if (x + BAR_WIDTH > 0 && x < cssWidth) {
      ctx.beginPath();
      ctx.roundRect(x, y, BAR_WIDTH, barHeight, BAR_BORDER_RADIUS);
      ctx.fill();
    }
  }

  ctx.restore();
};

/**
 * Renders an animated bar meter into `canvasRef`. The bars scroll continuously
 * from right to left; their height reflects the latest input level from
 * `levelRef`. When `live` is false (paused), the scroll keeps running but new
 * bars use a fixed minimal height instead of tracking the level.
 */
export function useAudioLevel(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  levelRef: React.RefObject<number>,
  live: boolean,
) {
  const barsRef = useRef<number[]>([]);
  const scrollOffsetRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const liveRef = useRef(live);
  liveRef.current = live;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let lastTime = performance.now();

    const draw = (currentTime: number) => {
      rafRef.current = requestAnimationFrame(draw);

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const cssWidth = Math.ceil(canvas.width / dpr);
      const cssHeight = Math.ceil(canvas.height / dpr);
      const maxBars = Math.ceil(cssWidth / BAR_SPACING) + 1;

      const deltaTime = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      const volume = liveRef.current
        ? Math.max(0, Math.min(1, levelRef.current))
        : 0;

      while (scrollOffsetRef.current >= BAR_SPACING) {
        scrollOffsetRef.current -= BAR_SPACING;
        const barHeight = Math.max(MIN_BAR_HEIGHT, volume * cssHeight);
        barsRef.current.push(barHeight);
      }

      scrollOffsetRef.current += SCROLL_SPEED * deltaTime;

      while (barsRef.current.length > maxBars) {
        barsRef.current.shift();
      }

      drawBars(
        ctx,
        canvas,
        dpr,
        cssWidth,
        cssHeight,
        barsRef.current,
        scrollOffsetRef.current,
        resolveColor(),
      );
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [canvasRef, levelRef]);
}
