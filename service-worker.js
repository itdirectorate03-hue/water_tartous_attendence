var CACHE_NAME = 'attendance-pwa-v7';
var CORE_ASSETS = ['./', './index.html'];
var OPTIONAL_ASSETS = ['./manifest.json', './icon.svg', './icon-192.png', './icon-512.png'];

// ==================== التثبيت ====================
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

// ==================== التفعيل ====================
self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.map(function (k) { if (k !== CACHE_NAME) return caches.delete(k); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

// ==================== البحث في الكاش بعدة مسارات ====================
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

// ==================== اعتراض الطلبات ====================
self.addEventListener('fetch', function (e) {
  var req = e.request;
  
  // تجاهل الطلبات غير GET
  if (req.method !== 'GET') return;
  
  // تجاهل طلبات Google (Apps Script / Drive)
  if (req.url.indexOf('script.google.com') !== -1 ||
      req.url.indexOf('drive.google.com') !== -1 ||
      req.url.indexOf('googleusercontent.com') !== -1 ||
      req.url.indexOf('googleapis.com') !== -1) {
    return;
  }

  // ✅ للصفحة الرئيسية: Cache-First
  if (req.mode === 'navigate' || req.destination === 'document') {
    e.respondWith(
      findInCache(req).then(function (cached) {
        if (cached) {
          // حدّث في الخلفية لو الشبكة متاحة
          fetch(req).then(function (res) {
            if (res && res.status === 200) {
              caches.open(CACHE_NAME).then(function (c) { c.put(req, res.clone()); });
            }
          }).catch(function () {});
          return cached;
        }
        // غير موجود → جرّب الشبكة
        return fetch(req).then(function (res) {
          if (res && res.status === 200) {
            var clone = res.clone();
            caches.open(CACHE_NAME).then(function (c) { c.put(req, clone); });
          }
          return res;
        }).catch(function () {
          // لا كاش ولا شبكة → صفحة بديلة عربية
          return findInCache({ url: './index.html', mode: 'navigate' }).then(function (r) {
            return r || new Response(
              '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8">' +
              '<meta name="viewport" content="width=device-width,initial-scale=1">' +
              '<title>شركة مياه طرطوس - أوفلاين</title>' +
              '<style>' +
              'body{font-family:"Segoe UI",Tahoma,sans-serif;text-align:center;padding:40px 20px;background:#f4f7f6;color:#333;margin:0}' +
              'h1{color:#0056b3;font-size:1.5rem}' +
              '.box{max-width:400px;margin:0 auto;background:white;padding:30px;border-radius:12px;box-shadow:0 4px 15px rgba(0,0,0,0.08)}' +
              'button{padding:12px 24px;font-size:16px;background:#0056b3;color:white;border:none;border-radius:8px;margin-top:20px;cursor:pointer;font-weight:bold}' +
              'button:hover{background:#004494}' +
              '.icon{font-size:60px;margin-bottom:15px}' +
              '.hint{font-size:13px;color:#666;margin-top:15px;line-height:1.6}' +
              '</style></head><body>' +
              '<div class="box">' +
              '<div class="icon">💧</div>' +
              '<h1>شركة مياه طرطوس</h1>' +
              '<p style="font-size:16px;font-weight:bold;">لا يوجد اتصال بالإنترنت</p>' +
              '<p class="hint">افتح التطبيق مرة واحدة وأنت متصل بالإنترنت، ثم سيُخزَّن للاستخدام الأوفلاين.</p>' +
              '<button onclick="location.reload()">🔄 إعادة المحاولة</button>' +
              '</div>' +
              '</body></html>',
              { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
            );
          });
        });
      })
    );
    return;
  }

  // ✅ لبقية الملفات: Cache-First
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

// ==================== رسائل من الصفحة (اختياري) ====================
self.addEventListener('message', function (event) {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});
