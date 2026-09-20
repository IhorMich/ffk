const CACHE = 'ffk_v285';
const ASSETS = [
  './',
  './index.html',
  './privacy.html',
  './css/app.css',
  './js/version.js',
  './js/i18n-coach-pl.js',
  './js/i18n-coach-es.js',
  './js/i18n-coach-de.js',
  './js/i18n-coach-it.js',
  './js/i18n-coach-fr.js',
  './js/i18n-coach-pt.js',
  './js/i18n.js',
  './js/rating.js',
  './js/metric-icons.js',
  './js/storage.js',
  './js/qrcode-lite.js',
  './js/coach-config.js',
  './js/vendor/supabase.js',
  './js/coach-store.js',
  './js/coach-cloud.js',
  './js/coach-push.js',
  './js/inbox-store.js',
  './js/parent-store.js',
  './js/parent-stats-store.js',
  './js/coach-ui.js',
  './js/parent-ui.js',
  './js/app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/intro-cup.png',
  './icons/intro-star.png',
  './icons/apple-touch-icon.png',
  './icons/metrics/assists.png',
  './icons/metrics/blocks.png',
  './icons/metrics/clearances.png',
  './icons/metrics/dribbles.png',
  './icons/metrics/duelslost.png',
  './icons/metrics/duelswon.png',
  './icons/metrics/goals.png',
  './icons/metrics/openings.png',
  './icons/metrics/passes.png',
  './icons/metrics/shots.png',
  './icons/metrics/tackles.png',
  './icons/metrics/conceded.png',
  './icons/metrics/gkpass.png',
  './icons/metrics/claims.png',
  './icons/metrics/saves.png',
  './icons/metrics/support.png',
  './icons/metrics/fouls.png',
  './icons/metrics/interceptions.png',
  './icons/metrics/chances.png',
  './icons/metrics/buildpass.png',
  './icons/metrics/losses.png',
  './icons/metrics/ledtogoal.png',
  './icons/metrics/badpass.png',
  './icons/metrics/badtouch.png',
  './icons/metrics/owngoal.png',
  './fonts/plus-jakarta-sans-latin-400-normal.woff2',
  './fonts/plus-jakarta-sans-latin-600-normal.woff2',
  './fonts/plus-jakarta-sans-latin-700-normal.woff2',
  './fonts/plus-jakarta-sans-latin-800-normal.woff2',
  './fonts/plus-jakarta-sans-latin-ext-400-normal.woff2',
  './fonts/plus-jakarta-sans-latin-ext-600-normal.woff2',
  './fonts/plus-jakarta-sans-latin-ext-700-normal.woff2',
  './fonts/plus-jakarta-sans-latin-ext-800-normal.woff2',
  './fonts/onest-cyrillic-400-normal.woff2',
  './fonts/onest-cyrillic-600-normal.woff2',
  './fonts/onest-cyrillic-700-normal.woff2',
  './fonts/onest-cyrillic-800-normal.woff2',
  './fonts/onest-cyrillic-ext-400-normal.woff2',
  './fonts/onest-cyrillic-ext-600-normal.woff2',
  './fonts/onest-cyrillic-ext-700-normal.woff2',
  './fonts/onest-cyrillic-ext-800-normal.woff2'
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
