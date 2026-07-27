// Bump this whenever the app shell / precache list changes so browsers
// pick up a fresh install instead of reusing a stale cache.
const CACHE_NAME = 'blindfold-chess-v41';

/**
 * Maia's model + WASM runtime live in their own cache, deliberately never
 * touched by the `activate` cleanup below that wipes every non-CACHE_NAME
 * cache on a version bump. Without this, bumping CACHE_NAME for an
 * unrelated UI change would silently force a re-download of a multi-MB
 * payload on the next load -- exactly the mobile-data cost this app is
 * built to avoid. This cache is instead invalidated on its own terms: the
 * model entry is content-checked against MODELS.md's sha256 below, and the
 * runtime files change only when the onnxruntime-web dependency does (which
 * ships as part of a real code change anyway).
 */
const MODEL_CACHE_NAME = 'blindfold-chess-maia-v1';
const MODEL_URL = '/maia/models/maia_kdd_1900.onnx';
// MODELS.md: maia_kdd_1900.onnx.
const MODEL_SHA256 = '65ee89dcee614d2b7f5bf8fc5950e83050bf855ecb4d34f6e6214b09acc64572';
const MAIA_RUNTIME_ASSETS = ['/maia/ort/ort-wasm-simd-threaded.wasm', '/maia/ort/ort-wasm-simd-threaded.mjs'];

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
  'not-legal', 'ambiguous', 'not-understood',
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
    await Promise.all(
      keys.filter((key) => key !== CACHE_NAME && key !== MODEL_CACHE_NAME).map((key) => caches.delete(key)),
    );
    await self.clients.claim();
  })());
});

async function sha256Hex(buffer) {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Cache-first with a content check, not just a name check: on every read
 * (cached or freshly fetched) the model's bytes are hashed and compared
 * against MODELS.md's sha256. A cached entry that fails is evicted and
 * refetched once; a freshly-fetched one that fails is neither served nor
 * cached -- the model never runs unless its bytes are known-correct.
 */
async function handleModelRequest(request) {
  const cache = await caches.open(MODEL_CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) {
    const hex = await sha256Hex(await cached.clone().arrayBuffer());
    if (hex === MODEL_SHA256) return cached;
    await cache.delete(request); // corrupt cache entry -- fall through to a fresh fetch
  }

  let response;
  try {
    response = await fetch(request);
  } catch {
    return new Response('', { status: 503, statusText: 'Offline' });
  }
  if (response.status !== 200) return response;

  const hex = await sha256Hex(await response.clone().arrayBuffer());
  if (hex !== MODEL_SHA256) {
    return new Response('', { status: 502, statusText: 'Model checksum mismatch' });
  }
  await cache.put(request, response.clone());
  return response;
}

/** Cache-first, no content check (MODELS.md has no hash for these) -- durable for the same reason the model is. */
async function handleMaiaRuntimeAsset(request) {
  const cache = await caches.open(MODEL_CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.status === 200) await cache.put(request, response.clone());
    return response;
  } catch {
    return new Response('', { status: 503, statusText: 'Offline' });
  }
}

/**
 * Navigations go to the network first, everything else to the cache first.
 *
 * The app shell is served from '/', which never changes name between deploys.
 * Cache-first on that would pin every visitor to whichever build they happened
 * to load first, until CACHE_NAME was bumped by hand. Vite's asset filenames
 * are content-hashed, so cache-first is exactly right for them.
 */
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw error;
  }
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const path = new URL(event.request.url).pathname;
  if (path === MODEL_URL) {
    event.respondWith(handleModelRequest(event.request));
    return;
  }
  if (MAIA_RUNTIME_ASSETS.includes(path)) {
    event.respondWith(handleMaiaRuntimeAsset(event.request));
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        return await networkFirst(event.request);
      } catch {
        const fallback = await caches.match('/');
        if (fallback) return fallback;
        return new Response(
          '<h1>Offline</h1><p>Open Blindfold Chess once while connected so it can be cached for offline play.</p>',
          { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 503 },
        );
      }
    })());
    return;
  }

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
      return new Response('', { status: 503, statusText: 'Offline' });
    }
  })());
});
