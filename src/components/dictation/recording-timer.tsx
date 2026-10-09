import { useEffect, useState } from "react";

const formatTime = (centiseconds: number) => {
  const totalSeconds = Math.floor(centiseconds / 100);
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = (totalSeconds % 60).toString().padStart(2, "0");
  const centis = (centiseconds % 100).toString().padStart(2, "0");
  return `${minutes}:${secs}.${centis}`;
};

/**
 * Live recording timer. Counts elapsed time in centiseconds (mm:ss.cc) while
 * mounted. The recording view is only mounted while a dictation session is
 * active, so the timer starts at zero on mount and runs until unmount. When
 * `paused` is true (e.g. an error occurred), the countdown freezes.
 */
export function RecordingTimer({ paused = false }: { paused?: boolean }) {
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    if (paused) {
      return;
    }

    const interval = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 10);

    return () => clearInterval(interval);
  }, [paused]);

  return (
    <span className="font-mono text-xs text-destructive">
      {formatTime(elapsedTime)}
    </span>
  );
}
