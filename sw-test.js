const CACHE = 'pinforme-navi-test-pwa-v2';
const ASSETS = ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png', 'manifest-test.webmanifest'];
self.addEventListener('install', function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){ return c.addAll(ASSETS); }).then(function(){ return self.skipWaiting(); }));
});
self.addEventListener('activate', function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.map(function(k){ if (k !== CACHE) return caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});
self.addEventListener('fetch', function(e){
  if (e.request.method !== 'GET') return;
  var url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  if (e.request.mode === 'navigate') {
    // Pages: always fetch the latest from the network first; cache is only an offline fallback.
    e.respondWith(fetch(e.request).then(function(res){
      var copy = res.clone();
      caches.open(CACHE).then(function(c){ c.put(e.request, copy); });
      return res;
    }).catch(function(){
      return caches.match(e.request, {ignoreSearch: true});
    }));
    return;
  }
  var file = url.pathname.split('/').pop();
  if (ASSETS.indexOf(file) === -1) return;
  e.respondWith(caches.match(e.request).then(function(hit){
    return hit || fetch(e.request).then(function(res){
      var copy = res.clone();
      caches.open(CACHE).then(function(c){ c.put(e.request, copy); });
      return res;
    });
  }));
});
// redeploy trigger 2
