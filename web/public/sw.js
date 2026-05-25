/**
 * Mirror service worker — v02 §10 "Wi-Fi dies mid-demo" insurance.
 *
 * Caches the shell + demo fallback assets (pre-rendered MP3s,
 * fallback analysis JSON, pre-recorded avatar JSON, brand SVGs) on
 * the first visit, then serves them from cache when the network is
 * unavailable. Live API calls (/api/asr, /api/synth, /api/clone,
 * /api/explain) are intentionally NOT cached — those rely on the
 * upstream services and have their own per-feature fallbacks in
 * code; caching their responses would lock the demo into stale
 * results.
 *
 * Strategy:
 *   - Static shell + demo assets: cache-first.
 *   - HTML navigation: network-first, cache fallback.
 *   - Everything else (incl. /api/*, fonts CDN): network-only.
 *
 * Versioning: bump CACHE_NAME's suffix on any breaking shell change.
 */
const CACHE_NAME = "mirror-shell-v1";

// Hand-picked URLs that must be available offline. The Vite-built
// assets (CSS / JS / hashed images) aren't listed here — they're
// fetched on first navigation and stored opportunistically via the
// runtime cache rule below.
const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/mirror-logo.svg",
  "/mirror-mark.svg",
  "/demo-audio/wo_xi_huan_xue_zhong_wen.mp3",
  "/demo-audio/ni_hao_wo_jiao.mp3",
  "/demo-audio/zhe_shi_yi_ge_yusan.mp3",
  "/demo/avatar/wo_xi_huan_xue_zhong_wen.json",
  "/demo/avatar/ni_hao_wo_jiao.json",
  "/demo/avatar/zhe_shi_yi_ge_yusan.json",
  "/demo/analysis/wo_xi_huan_xue_zhong_wen_russian.json",
  "/demo/analysis/wo_xi_huan_xue_zhong_wen_uzbek.json",
  "/demo/analysis/ni_hao_wo_jiao_russian.json",
  "/demo/analysis/ni_hao_wo_jiao_uzbek.json",
  "/demo/analysis/zhe_shi_yi_ge_yusan_russian.json",
  "/demo/analysis/zhe_shi_yi_ge_yusan_uzbek.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        // Use addAll(URL) so a single 404 doesn't take the whole
        // install down — we tolerate missing optional files.
        Promise.all(
          PRECACHE_URLS.map((url) =>
            cache.add(url).catch(() => {
              /* swallow */
            })
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("mirror-shell-") && k !== CACHE_NAME)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Never cache the live API surface — those calls must hit the
  // real backend or fail loud so the in-app fallbacks fire.
  if (url.pathname.startsWith("/api/")) return;
  // Don't try to intercept third-party fonts / Gemini / HF / ElevenLabs.
  if (url.origin !== self.location.origin) return;

  // Navigation requests: network-first, fallback to cached shell.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() =>
        caches.match("/index.html").then((r) => r || Response.error())
      )
    );
    return;
  }

  // Static assets + demo fallbacks: cache-first with background fill.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        // Only cache successful, same-origin responses.
        if (res.ok && res.type === "basic") {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return res;
      });
    })
  );
});
