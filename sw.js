// sw.js — 껍데기만 캐싱한다. 결제·권한 조회는 절대 캐싱하지 않는다.
const CACHE = "saju-v1";
const SHELL = ["/home.html", "/index.html", "/wealth.html", "/tools.html", "/taekil.html", "/today.html", "/samjae.html", "/destiny.html", "/terms.html", "/pay.js", "/manifest.json"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) =>
    Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
  ).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (url.pathname.startsWith("/api/")) return;           // 항상 네트워크
  if (url.pathname.startsWith("/success") || url.pathname.startsWith("/fail")) return;
  e.respondWith(
    fetch(e.request)
      .then((r) => { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, cp)); return r; })
      .catch(() => caches.match(e.request))
  );
});
