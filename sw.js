/* Service worker: เก็บหน้าแอปไว้ในเครื่องให้เปิดเร็วและติดตั้งได้
   ข้อมูลจาก Google Sheet ไม่ถูกเก็บ (ดึงสดทุกครั้ง) */
const CACHE = 'pp-screening-v3';
const SHELL = ['./', 'index.html', 'app.js', 'demo.js', 'config.js', 'manifest.webmanifest',
               'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // API และฟอนต์ไม่ผ่าน cache
  // network-first: ได้เวอร์ชันล่าสุดเสมอ ถ้าออฟไลน์ค่อยใช้ของในเครื่อง
  e.respondWith(
    fetch(e.request)
      .then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return res; })
      .catch(() => caches.match(e.request).then(r => r || caches.match('index.html')))
  );
});
