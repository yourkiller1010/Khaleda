const CACHE = "killbyte-static-v1";
self.addEventListener("install", (event) => { event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(["/icons/icon-192.png", "/manifest.webmanifest"]))); self.skipWaiting(); });
self.addEventListener("activate", (event) => { event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))); self.clients.claim(); });
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || request.mode === "navigate" || new URL(request.url).pathname.startsWith("/api/")) return;
  event.respondWith(fetch(request).then((response) => { if (response.ok && new URL(request.url).origin === self.location.origin) caches.open(CACHE).then((cache) => cache.put(request, response.clone())); return response; }).catch(() => caches.match(request)));
});
