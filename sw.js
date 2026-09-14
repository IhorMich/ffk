const CACHE = 'ffk_v26';
const ASSETS = [
  './',
  './index.html',
  './css/app.css',
  './js/i18n.js',
  './js/rating.js',
  './js/storage.js',
  './js/app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './fonts/plus-jakarta-sans-latin-400-normal.woff2',
  './fonts/plus-jakarta-sans-latin-600-normal.woff2',
  './fonts/plus-jakarta-sans-latin-700-normal.woff2',
  './fonts/plus-jakarta-sans-latin-800-normal.woff2',
  './fonts/plus-jakarta-sans-latin-ext-400-normal.woff2',
  './fonts/plus-jakarta-sans-latin-ext-600-normal.woff2',
  './fonts/plus-jakarta-sans-latin-ext-700-normal.woff2',
  './fonts/plus-jakarta-sans-latin-ext-800-normal.woff2'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(ASSETS.map(async path => {
      try{
        const url = new URL(path, self.location).href;
        await cache.add(url);
      }catch(e){}
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('ffk_') && k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if(event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if(url.origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if(event.request.mode === 'navigate'){
      const page = await cache.match(new URL('./index.html', self.location).href) || await cache.match(new URL('./', self.location).href);
      if(page) return page;
    }
    const hit = await cache.match(event.request);
    if(hit) return hit;
    try{
      const res = await fetch(event.request);
      if(res && res.ok) cache.put(event.request, res.clone());
      return res;
    }catch(e){
      const fallback = await cache.match(new URL('./index.html', self.location).href);
      if(fallback) return fallback;
      throw e;
    }
  })());
});
