const CACHE_NAME = 'dhandu-hisaabu-v3';
const ASSETS = [
  './index.html',
  './style.css',
  './app.js',
  './database.js',
  './i18n.js',
  './icon.png',
  './manifest.json'
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(key => {
        if (key !== CACHE_NAME) return caches.delete(key);
      })
    ))
  );
});

self.addEventListener('fetch', e => {
  // For Firestore API and online queries, bypass SW to run natively
  if (e.request.url.includes('firestore.googleapis.com') || e.request.url.includes('googleapis.com')) {
    return;
  }
  
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
