const CACHE = 'pinforme-navi-prod-v1';
const ASSETS = ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png', 'manifest.webmanifest'];
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
// App-icon badge counter, shared with the page (the page writes the true
// unread count here whenever it reconciles; the worker increments on push).
function badgeDb(){
  return new Promise(function(resolve, reject){
    var req = indexedDB.open('pinforme-badge', 1);
    req.onupgradeneeded = function(){ req.result.createObjectStore('kv'); };
    req.onsuccess = function(){ resolve(req.result); };
    req.onerror = function(){ reject(req.error); };
  });
}
function badgeGet(){
  return badgeDb().then(function(db){
    return new Promise(function(resolve){
      var tx = db.transaction('kv', 'readonly').objectStore('kv').get('count');
      tx.onsuccess = function(){ resolve(tx.result || 0); };
      tx.onerror = function(){ resolve(0); };
    });
  }).catch(function(){ return 0; });
}
function badgeSet(n){
  return badgeDb().then(function(db){
    return new Promise(function(resolve){
      var tx = db.transaction('kv', 'readwrite').objectStore('kv').put(n, 'count');
      tx.onsuccess = function(){ resolve(); };
      tx.onerror = function(){ resolve(); };
    });
  }).catch(function(){});
}
function applyBadge(n){
  if (!('setAppBadge' in self.navigator)) return Promise.resolve();
  var p = n > 0 ? self.navigator.setAppBadge(n) : self.navigator.clearAppBadge();
  return Promise.resolve(p).catch(function(){});
}
self.addEventListener('push', function(e){
  var data = {};
  try { data = e.data ? e.data.json() : {}; } catch (err) {}
  var title = data.title || 'PINFORME';
  // The notification shows the title only; the body is read inside the app.
  var options = {
    body: 'タップして内容を確認できます',
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    data: { url: data.url || 'index.html' }
  };
  var shown = self.registration.showNotification(title, options);
  var badged = badgeGet().then(function(n){
    var next = n + 1;
    return badgeSet(next).then(function(){ return applyBadge(next); });
  });
  e.waitUntil(Promise.all([shown, badged]));
});
self.addEventListener('notificationclick', function(e){
  e.notification.close();
  var target = (e.notification.data && e.notification.data.url) || 'index.html';
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list){
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (c.url.indexOf('pinforme-measurement') !== -1 && 'focus' in c) return c.focus();
    }
    if (clients.openWindow) return clients.openWindow(target);
  }));
});
