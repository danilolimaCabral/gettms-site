/* getTMS — cache do site inteiro: segunda visita roda sem baixar nada de novo */
const VERSION = "gettms-v1";
const SHELL = `${VERSION}-shell`;
const MEDIA = `${VERSION}-media`;
const MODELS = [
  "/models/semi-truck.glb",
  "/models/semi-truck-low.glb",
  "/models/car-sedan.glb",
  "/models/car-hatchback.glb",
  "/models/car-suv.glb",
  "/models/car-ev.glb",
  "/models/forklift.glb",
  "/models/bld-office.glb",
  "/models/bld-apartment.glb",
  "/models/bld-skyscraper.glb",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const shell = await caches.open(SHELL);
      await shell.addAll(["/", "/index.html"]).catch(() => undefined);
      const media = await caches.open(MEDIA);
      // baixa os modelos em segundo plano, um por um, sem travar a instalação
      await Promise.all(MODELS.map((url) => media.add(new Request(url, { cache: "reload" })).catch(() => undefined)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // modelos, imagens e bundles: cache primeiro (já vêm com hash e cache imutável)
  const isMedia = /\.(glb|png|jpg|jpeg|webp|svg|woff2?)$/.test(url.pathname) || url.pathname.startsWith("/assets/");
  if (isMedia) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(MEDIA);
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
          const response = await fetch(request);
          if (response.ok) cache.put(request, response.clone());
          return response;
        } catch {
          return cached ?? Response.error();
        }
      })(),
    );
    return;
  }

  // navegação: rede primeiro, cache como rede de segurança
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(SHELL);
        try {
          const response = await fetch(request);
          if (response.ok) cache.put("/index.html", response.clone());
          return response;
        } catch {
          return (await cache.match("/index.html")) ?? (await cache.match("/")) ?? Response.error();
        }
      })(),
    );
  }
});
