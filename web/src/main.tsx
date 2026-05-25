import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

// v02 §2 stack #12 — self-hosted JetBrains Mono via @fontsource so
// the browser never hits Google Fonts for the data face. Noto Sans
// SC and Switzer stay on CDN: Noto's chinese-simplified subset is
// ~1 MB per weight at npm package level — Google Fonts auto-subsets
// it to the handful of hanzi we actually render, which is the
// faster path. Spec §5.3 explicitly permits "CDN options also work".
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/700.css";

import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// v02 §10 — register the offline-mode service worker once the
// initial render is dispatched. The SW caches the app shell + demo
// fallback assets so the loop survives a Wi-Fi drop on stage.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* registration failures are non-fatal — the app still runs
         online; we only lose the offline-mode safety net. */
    });
  });
}
