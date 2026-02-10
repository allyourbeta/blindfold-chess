const CACHE_NAME = 'blindfold-chess-v2';
const PIECE_BASE = 'https://raw.githubusercontent.com/lichess-org/lila/master/public/piece/cburnett/';
const PIECE_NAMES = ['wK','wQ','wR','wB','wN','wP','bK','bQ','bR','bB','bN','bP'];
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Crimson+Pro:wght@400;500;600&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.10.3/chess.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js',
  ...PIECE_NAMES.map(p => PIECE_BASE + p + '.svg'),
];

// Install: cache all core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching core assets');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  // Activate immediately, don't wait for old SW to die
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  // Take control of all open tabs immediately
  self.clients.claim();
});

// Fetch: serve from cache first, fall back to network
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request).then((response) => {
        // Cache successful GET responses for future offline use
        if (response.ok && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return response;
      }).catch(() => {
        // Offline and not cached — return a friendly error for navigation
        if (event.request.mode === 'navigate') {
          return new Response(
            '<h1>Offline</h1><p>Blindfold Chess is not yet cached. Connect to the internet and reload.</p>',
            { headers: { 'Content-Type': 'text/html' } }
          );
        }
      });
    })
  );
});
