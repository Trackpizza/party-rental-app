// Party Rentals service worker — intentionally minimal.
// Its job is to make the app installable (Chromium requires a registered SW
// with a fetch handler). It does NOT cache app data: media uploads, Firebase,
// and API calls are left entirely to the browser so authenticated content and
// photo/signature capture behave exactly as without a SW.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

const OFFLINE_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Offline</title>
<style>body{font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#faf5fb;color:#2a1a2f;text-align:center;padding:1.5rem}
h1{color:#7c2d91}button{margin-top:1rem;padding:.6rem 1.2rem;border:0;border-radius:.6rem;background:#7c2d91;color:#fff;font-weight:600}</style></head>
<body><div><h1>🎉 You're offline</h1><p>This app needs a connection to load. Reconnect and try again.</p>
<button onclick="location.reload()">Retry</button></div></body></html>`;

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.mode !== "navigate") return; // only handle page navigations
  event.respondWith(
    fetch(req).catch(
      () =>
        new Response(OFFLINE_HTML, {
          status: 503,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        })
    )
  );
});
