import React from "react";
import ReactDOM from "react-dom/client";
import Overlay from "./Overlay";
import "../App.css";
import "./Overlay.css";

// The overlay is a transparent fullscreen window; make sure the page itself
// doesn't paint an opaque background. The HUD uses the app's dark design
// tokens, so force the dark variant on the root element.
document.documentElement.classList.add("dark");
document.documentElement.style.background = "transparent";
document.body.style.background = "transparent";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Overlay />
  </React.StrictMode>,
);
