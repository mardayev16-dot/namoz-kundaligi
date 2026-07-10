const CACHE = 'namoz-cache-v1';
const ASSETS = ['./', './index.html', './manifest.json', './icon.svg'];
const PRAYERS = ["Bomdod","Peshin","Asr","Shom","Xufton"];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
});

function idbGetLog() {
  return new Promise((resolve) => {
    const req = indexedDB.open('namozDB', 1);
    req.onupgradeneeded = () => { req.result.createObjectStore('data'); };
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction('data', 'readonly');
      const store = tx.objectStore('data');
      const getReq = store.get('prayerLog');
      getReq.onsuccess = () => resolve(getReq.result ? JSON.parse(getReq.result) : {});
      getReq.onerror = () => resolve({});
    };
    req.onerror = () => resolve({});
  });
}

function countMissedDays(log) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let missed = 0;
  for (const key in log) {
    const [y, m, d] = key.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    if (dt < today) {
      const entry = log[key];
      const c = PRAYERS.reduce((n, p) => n + (entry[p] ? 1 : 0), 0);
      if (c < 5) missed++;
    }
  }
  return missed;
}

async function notifyIfMissed() {
  const log = await idbGetLog();
  const missed = countMissedDays(log);
  if (missed > 0) {
    await self.registration.showNotification('Namoz Kundaligi', {
      body: missed === 1 ? "Sizda o'qilmagan namoz bor" : `${missed} kunlik o'qilmagan namozlaringiz bor`,
      icon: './icon.svg',
      badge: './icon.svg',
      tag: 'namoz-eslatma',
      vibrate: [80, 40, 80]
    });
  }
}

// Best-effort: fires roughly once a day when the browser decides to run it
// (Chrome/Android, app must be installed). Not an exact 21:00 trigger.
self.addEventListener('periodicsync', (e) => {
  if (e.tag === 'namoz-eslatma') {
    e.waitUntil(notifyIfMissed());
  }
});

self.addEventListener('sync', (e) => {
  if (e.tag === 'namoz-eslatma-check') {
    e.waitUntil(notifyIfMissed());
  }
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'CHECK_NOW') {
    e.waitUntil(notifyIfMissed());
  }
});
