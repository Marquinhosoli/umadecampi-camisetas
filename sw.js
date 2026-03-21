const CACHE_NAME = 'umadecampi-pwa-v1';
const urlsToCache = [
  './',
  './index.html',
  './styles.css',
  './script.js'
];

// Instala o Service Worker e salva os arquivos no cache do celular
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

// Intercepta as requisições (faz o app carregar mais rápido na próxima vez)
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request);
      })
  );
});
