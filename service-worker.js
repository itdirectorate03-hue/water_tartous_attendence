var CACHE_NAME = 'attendance-pwa-v1';
var APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg'
];

// تثبيت
self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(APP_SHELL);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

// تنشيط + حذف الكاش القديم
self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.map(function (k) {
          if (k !== CACHE_NAME) return caches.delete(k);
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

// اعتراض الطلبات
self.addEventListener('fetch', function (e) {
  var req = e.request;

  if (req.method !== 'GET') return;

  // تجاهل طلبات Apps Script
  if (req.url.indexOf('script.google.com') !== -1 ||
      req.url.indexOf('googleusercontent.com') !== -1) {
    return;
  }

  // Network-First لصفحة HTML (حتى تكون دائماً محدّثة)
  if (req.mode === 'navigate' || req.destination === 'document') {
    e.respondWith(
      fetch(req).then(function (res) {
        var clone = res.clone();
        caches.open(CACHE_NAME).then(function (c) { c.put(req, clone); });
        return res;
      }).catch(function () {
        return caches.match(req).then(function (cached) {
          return cached || caches.match('./index.html');
        });
      })
    );
    return;
  }

  // Cache-First لبقية الملفات
  e.respondWith(
    caches.match(req).then(function (cached) {
      return cached || fetch(req).then(function (res) {
        if (res && res.status === 200 && res.type === 'basic') {
          var clone = res.clone();
          caches.open(CACHE_NAME).then(function (c) { c.put(req, clone); });
        }
        return res;
      });
    })
  );
});
