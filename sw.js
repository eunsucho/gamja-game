// 홈 화면에 추가(설치)용 서비스 워커. 네트워크 먼저, 끊기면 저장해 둔 파일로.
const CACHE = "gamja-v2";
self.addEventListener("install", e => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request, { cache: "no-cache" }).then(res => {
    const copy = res.clone();
    caches.open(CACHE).then(c => c.put(e.request, copy));
    return res;
  }).catch(() => caches.match(e.request)));
});
