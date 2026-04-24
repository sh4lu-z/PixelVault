const CACHE_NAME = 'pixelvault-dark-v1';

// Cache කරන්න ඕන ෆයිල් ටික (ඔයාගේ JS ෆයිල් එකේ නම වෙනස් නම් මෙතන හදන්න)
const urlsToCache = [
  '/',
  '/index.html',
  '/admin.html',
  '/style.css',
  '/app.js',
  '/admin_frontend.js',
  '/api/index.js',
  '/api/admin.js'
  
];

// Service Worker එක Install කිරීම
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// පරණ Cache අයින් කිරීම
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

// Cache එකෙන් ඩේටා දීම (Offline Support)
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});
