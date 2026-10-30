// Service worker di Casa App.
// Tiene in cache la "scocca" dell'app così si apre anche senza rete.
// I dati delle spese li gestisce Firebase (che ha già la sua copia offline).

const CACHE = "casa-app-v1";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/"])).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;

  // File statici di Next (hanno l'hash nel nome): prima la cache
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copia = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copia));
            return res;
          })
      )
    );
    return;
  }

  // Pagine: prima la rete (così prendi sempre l'ultima versione), se manca la rete la cache
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copia = res.clone();
          caches.open(CACHE).then((c) => c.put("/", copia));
          return res;
        })
        .catch(() => caches.match("/"))
    );
  }
});
