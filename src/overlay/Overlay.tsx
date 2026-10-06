import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";

/**
 * The recording overlay card.
 *
 * Lives in a small window anchored to the top-center of the screen (the
 * backend uses gtk-layer-shell for this on Wayland). The card is always
 * rendered; visibility is controlled by the backend showing/hiding the window.
 */
export default function Overlay() {
  const [text, setText] = useState("");

  useEffect(() => {
    const unlisteners = [
      listen<string>("transcription-delta", (e) => {
        setText((t) => t + e.payload);
      }),
      listen<string>("transcription-done", () => {
        setText("");
      }),
    ];

    return () => {
      for (const u of unlisteners) {
        u.then((f) => f());
      }
    };
  }, []);

  return (
    <div className="overlay-card">
      {text || <span className="overlay-placeholder">Listening…</span>}
    </div>
  );
}
