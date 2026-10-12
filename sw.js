// Visual Line - service worker (PWA, 13/10/2026): chỉ chạy khi mở bằng HTTPS / localhost.
// Thư viện 3D (lib/) nạp sẵn để mở nhanh trên điện thoại; trang + mã: ưu tiên mạng, mất mạng thì dùng bản đã lưu. KHÔNG lưu dữ liệu (/api, /data, /photo).
const C = 'vl-v1';
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(C).then(c => c.addAll(['lib/three.min.js', 'lib/OrbitControls.js', 'lib/xlsx.full.min.js', 'lib/i18n.js', 'lib/lite.js', 'lib/logo-tinh-loi.png']).catch(() => 0)));
});
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin || /^\/(api|data|photo)\//.test(u.pathname)) return;
  e.respondWith(fetch(r).then(res => { if (res.ok) { const cp = res.clone(); caches.open(C).then(c => c.put(r, cp)); } return res; }).catch(() => caches.match(r)));
});
