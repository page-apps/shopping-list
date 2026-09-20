const CACHE = "scout-list-shell-v2";

self.addEventListener("install", (event) => {
  const shell = new URL("./", self.registration.scope).toString();
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll([
    shell,
    new URL("manifest.webmanifest", shell).toString(),
    new URL("icons/icon-192.png", shell).toString(),
  ])));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cached = await caches.match(request);
    try {
      const response = await fetch(request);
      if (response.ok) {
        const copy = response.clone();
        void caches.open(CACHE).then((cache) => cache.put(request, copy));
      }
      return response;
    } catch {
      return cached ?? caches.match(new URL("./", self.registration.scope).toString());
    }
  })());
});
