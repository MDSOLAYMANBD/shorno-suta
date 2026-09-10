import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
// Consent Mode v2 defaults + click-id capture — MUST run before any tag loads.
import "./lib/consentBoot";

// Chunk error detection — covers both sync errors and Promise rejections
const isChunkError = (msg: string) =>
  msg.includes('Failed to fetch dynamically imported module') ||
  msg.includes('Importing a module script failed') ||
  msg.includes('error loading dynamically imported module') ||
  msg.includes('ChunkLoadError') ||
  msg.includes('Loading chunk') ||
  msg.includes('Loading CSS chunk');

const tryChunkReload = () => {
  const key = 'chunk_reload';
  const last = sessionStorage.getItem(key);
  const now = Date.now();
  if (!last || now - Number(last) > 10000) {
    sessionStorage.setItem(key, String(now));
    window.location.reload();
  }
};

window.addEventListener('error', (event) => {
  if (isChunkError(event.message || '')) tryChunkReload();
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  const msg = reason?.message || reason?.toString?.() || '';
  if (isChunkError(msg)) tryChunkReload();
});

// Trigger SW update for all visitors (not just admin push subscribers)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistration('/').then((reg) => {
    if (reg) reg.update().catch(() => {});
  });
}

createRoot(document.getElementById("root")!).render(<App />);
