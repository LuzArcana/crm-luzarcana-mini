const CACHE = 'luzarcana-crm-v1';
const ASSETS = [
  '/',
  '/index.html',
  'https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600&family=Lato:wght@300;400;700&display=swap'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => {
      // Cachear solo los assets locales; las fuentes pueden fallar en install
      return c.addAll(['/', '/index.html']).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Las llamadas a /api siempre van a la red (nunca cachear datos del CRM)
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Para todo lo demás: red primero, caché como fallback
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
