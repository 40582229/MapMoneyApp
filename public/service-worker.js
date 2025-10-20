// public/service-worker.js

const CACHE_NAME = 'map-tiles-cache-v4';
const MAX_AGE_DAYS = 20;
const MAX_AGE_MS = MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

const MAX_CACHE_SIZE_MB = 100; // MB
const MAX_CACHE_SIZE_BYTES = MAX_CACHE_SIZE_MB * 1024 * 1024;
const MAX_TILE_COUNT = 5000;

const STRATEGY = 'network-first'; // you requested network-first
const DEM_MAX_ZOOM = 12; // only cache AWS Terrarium DEM up to this zoom

// Patterns to detect tiles
const PATTERNS = {
  opentopomap:
    /https?:\/\/(?:\w+\.)*tile\.opentopomap\.org\/\d+\/\d+\/\d+\.png/,
  awsTerrarium:
    /https?:\/\/s3\.amazonaws\.com\/elevation-tiles-prod\/terrarium\/\d+\/\d+\/\d+\.png/,
  anyTile:
    /(tile\.opentopomap\.org|elevation-tiles-prod)\/terrarium|tile.*\/\d+\/\d+\/\d+\.png/,
};

// Extract zoom level from common {z}/{x}/{y}.png path
function extractZfromUrl(url) {
  // look for /{z}/{x}/{y}.png
  const m = url.match(/\/(\d+)\/\d+\/\d+\.png/);
  if (!m) return null;
  return parseInt(m[1], 10);
}

async function getCacheEntryInfo(cache) {
  // Return array of { request, response, timestamp, size }
  const entries = [];
  const requests = await cache.keys();
  for (const req of requests) {
    const res = await cache.match(req);
    if (!res) continue;
    // Get timestamp header if present
    const tsHeader = res.headers.get('sw-cache-timestamp');
    const ts = tsHeader ? parseInt(tsHeader, 10) : 0;
    // Calculate approximate size (try Content-Length; fallback to arrayBuffer)
    let size = 0;
    const cl = res.headers.get('content-length');
    if (cl) {
      size = parseInt(cl, 10);
    } else {
      try {
        const buf = await res.clone().arrayBuffer();
        size = buf.byteLength;
      } catch (err) {
        // opaque responses (no-cors) might fail; treat small approximate size
        size = 20000; // 20 KB fallback guess
      }
    }
    entries.push({ request: req, response: res, timestamp: ts, size });
  }
  return entries;
}

async function enforceCacheLimits() {
  const cache = await caches.open(CACHE_NAME);
  const entries = await getCacheEntryInfo(cache);

  // sort by oldest timestamp (0 last)
  entries.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

  // compute totals
  let totalSize = entries.reduce((s, e) => s + (e.size || 0), 0);
  let totalCount = entries.length;

  // Evict while over size or count
  let i = 0;
  while (
    (totalSize > MAX_CACHE_SIZE_BYTES || totalCount > MAX_TILE_COUNT) &&
    i < entries.length
  ) {
    const e = entries[i];
    try {
      await cache.delete(e.request);
      totalSize -= e.size || 0;
      totalCount -= 1;
    } catch (err) {
      // ignore delete error and continue
      console.warn('SW: error deleting cache entry', err);
    }
    i++;
  }
}

// Helper: check if request is a tile we care about
function isTileRequest(url) {
  return (
    PATTERNS.anyTile.test(url) ||
    PATTERNS.opentopomap.test(url) ||
    PATTERNS.awsTerrarium.test(url)
  );
}

function isAwsDem(url) {
  return PATTERNS.awsTerrarium.test(url);
}

// Check TTL for a cached response
function isFreshResponse(resp) {
  if (!resp) return false;
  const header = resp.headers.get('sw-cache-timestamp');
  if (!header) return false;
  const ts = parseInt(header, 10);
  return Date.now() - ts <= MAX_AGE_MS;
}

// When installing, claim immediately (optional)
self.addEventListener('install', (event) => {
  self.skipWaiting();
  console.log('SW: installed');
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim();
      console.log('SW: activated');
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = req.url;

  // Only handle GET tile requests
  if (req.method !== 'GET' || !isTileRequest(url)) {
    return;
  }

  // If it's AWS DEM, check zoom and maybe short-circuit caching
  const z = extractZfromUrl(url);
  const cacheDem = !(isAwsDem(url) && (z === null || z > DEM_MAX_ZOOM));

  if (STRATEGY === 'network-first') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(req);
        if (cached && isFreshResponse(cached)) {
          return cached;
        }
        try {
          // Only cache if ok and cacheDem allowed
            const netResp = await fetch(req);
          if (netResp && netResp.status >= 200 && netResp.status < 400) {
            if (cacheDem || !isAwsDem(url)) {
              try {

                const cache = await caches.open(CACHE_NAME);
                // attach timestamp header to stored response
                const clone = netResp.clone();
                const headers = new Headers(clone.headers);
                headers.set('sw-cache-timestamp', Date.now().toString());
                // store body with new headers
                const body = await clone.arrayBuffer();
                const stored = new Response(body, {
                  status: clone.status,
                  statusText: clone.statusText,
                  headers,
                });
                await cache.put(req, stored);
                // enforce limits asynchronously but don't block response too long
                enforceCacheLimits().catch((e) =>
                  console.warn('SW: cache cleanup failed', e),
                );
              } catch (err) {
                console.warn('SW: caching failed', err);
              }
            }
          }
          return netResp;
        } catch (networkError) {
          // Network failed: attempt to serve from cache
          const cache = await caches.open(CACHE_NAME);
          const cached = await cache.match(req);
          if (cached && isFreshResponse(cached)) {
            return cached;
          }
          // Return cached even if stale as ultimate fallback
          if (cached) return cached;
          // If nothing, throw so browser shows failure
          throw networkError;
        }
      })(),
    );
  } else {
    // fallback: offline-first (not requested but included)
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(req);
        if (cached && isFreshResponse(cached)) {
          return cached;
        }
        try {
          const networkResp = await fetch(req);
          if (
            networkResp &&
            networkResp.status >= 200 &&
            networkResp.status < 400
          ) {
            if (cacheDem || !isAwsDem(url)) {
              try {
                const clone = networkResp.clone();
                const headers = new Headers(clone.headers);
                headers.set('sw-cache-timestamp', Date.now().toString());
                const body = await clone.arrayBuffer();
                const stored = new Response(body, {
                  status: clone.status,
                  statusText: clone.statusText,
                  headers,
                });
                await cache.put(req, stored);
                enforceCacheLimits().catch((e) =>
                  console.warn('SW: cache cleanup failed', e),
                );
              } catch (err) {
                console.warn('SW: caching failed', err);
              }
            }
          }
          return networkResp;
        } catch (err) {
          // network fails -> use cache if any
          if (cached) return cached;
          throw err;
        }
      })(),
    );
  }
});

// Optional: message API to force cache cleanup or change settings
self.addEventListener('message', (evt) => {
  const { command } = evt.data || {};
  if (command === 'cleanup') {
    enforceCacheLimits()
      .then(() => {
        console.log('SW: cleanup complete');
        evt.source?.postMessage({ status: 'done' });
      })
      .catch((e) => {
        console.warn('SW: cleanup failed', e);
        evt.source?.postMessage({ status: 'error', error: String(e) });
      });
  }
});
