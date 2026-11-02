var CACHE_NAME = 'attendance-pwa-v8';
var CORE_ASSETS = ['./', './index.html'];
var OPTIONAL_ASSETS = ['./manifest.json', './icon.svg', './icon-192.png', './icon-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      var promises = [];
      CORE_ASSETS.forEach(function (url) {
        promises.push(cache.add(url).catch(function () {}));
      });
      OPTIONAL_ASSETS.forEach(function (url) {
        promises.push(cache.add(url).catch(function () {}));
      });
      return Promise.all(promises);
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.map(function (k) { if (k !== CACHE_NAME) return caches.delete(k); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

function findInCache(request) {
  return caches.match(request).then(function (found) {
    if (found) return found;
    var fallbacks = ['./index.html', './', '/index.html', '/'];
    var idx = 0;
    function tryNext() {
      if (idx >= fallbacks.length) return null;
      var url = fallbacks[idx++];
      return caches.match(url).then(function (r) {
        return r || tryNext();
      });
    }
    return tryNext();
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  if (req.url.indexOf('script.google.com') !== -1 ||
      req.url.indexOf('drive.google.com') !== -1 ||
      req.url.indexOf('googleusercontent.com') !== -1 ||
      req.url.indexOf('googleapis.com') !== -1) {
    return;
  }

  if (req.mode === 'navigate' || req.destination === 'document') {
    e.respondWith(
      findInCache(req).then(function (cached) {
        if (cached) {
          fetch(req).then(function (res) {
            if (res && res.status === 200) {
              caches.open(CACHE_NAME).then(function (c) { c.put(req, res.clone()); });
            }
          }).catch(function () {});
          return cached;
        }
        return fetch(req).then(function (res) {
          if (res && res.status === 200) {
            var clone = res.clone();
            caches.open(CACHE_NAME).then(function (c) { c.put(req, clone); });
          }
          return res;
        }).catch(function () {
          return findInCache({ url: './index.html', mode: 'navigate' }).then(function (r) {
            return r || new Response(
              '<html dir="rtl"><body style="font-family:sans-serif;text-align:center;padding:40px;background:#f4f7f6;color:#333;">' +
              '<h1 style="color:#0056b3;">💧 شركة مياه طرطوس</h1>' +
              '<p>لا يوجد اتصال بالإنترنت</p>' +
              '<p style="font-size:14px;color:#666;">افتح التطبيق مرة واحدة وأنت متصل، ثم سيُخزَّن للاستخدام الأوفلاين.</p>' +
              '<button onclick="location.reload()" style="padding:12px 24px;font-size:16px;background:#0056b3;color:white;border:none;border-radius:8px;cursor:pointer;">🔄 إعادة المحاولة</button>' +
              '</body></html>',
              { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
            );
          });
        });
      })
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(function (cached) {
      if (cached) return cached;
      return fetch(req).then(function (res) {
        if (res && res.status === 200) {
          var clone = res.clone();
          caches.open(CACHE_NAME).then(function (c) { c.put(req, clone); });
        }
        return res;
      }).catch(function () {
        return new Response('', { status: 404 });
      });
    })
  );
});
