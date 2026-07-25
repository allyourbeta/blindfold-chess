// Bump this whenever the app shell / precache list changes so browsers
// pick up a fresh install instead of reusing a stale cache.
const CACHE_NAME = 'blindfold-chess-v5';

const PIECE_FILES = [
  'wK', 'wQ', 'wR', 'wB', 'wN', 'wP',
  'bK', 'bQ', 'bR', 'bB', 'bN', 'bP',
].map((p) => `/pieces/${p}.svg`);

const AUDIO_CLIPS = [
  'king', 'queen', 'rook', 'bishop', 'knight', 'pawn',
  'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h',
  'nato-a', 'nato-b', 'nato-c', 'nato-d', 'nato-e', 'nato-f', 'nato-g', 'nato-h',
  '1', '2', '3', '4', '5', '6', '7', '8',
  'takes', 'to', 'from', 'check', 'checkmate',
  'castles-kingside', 'castles-queenside',
  'promotes-to', 'en-passant', 'stalemate', 'draw',
  'not-legal', 'ambiguous',
].map((id) => `/audio/${id}.wav`);

const APP_SHELL = [
  '/',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
  '/engine/stockfish.js',
  '/fonts/nunito-variable.woff2',
  ...AUDIO_CLIPS,
  ...PIECE_FILES,
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Best-effort: a single missing/slow asset shouldn't block install —
    // everything still gets cached opportunistically as it's fetched.
    await Promise.allSettled(APP_SHELL.map((url) => cache.add(url)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;

    try {
      const response = await fetch(event.request);
      // Only cache complete (200) responses — a 206 Partial Content reply
      // (audio elements issue Range requests) throws in Cache.put().
      if (response.status === 200) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(event.request, response.clone());
      }
      return response;
    } catch (error) {
      if (event.request.mode === 'navigate') {
        const fallback = await caches.match('/');
        if (fallback) return fallback;
        return new Response(
          '<h1>Offline</h1><p>Open Blindfold Chess once while connected so it can be cached for offline play.</p>',
          { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 503 },
        );
      }
      return new Response('', { status: 503, statusText: 'Offline' });
    }
  })());
});
