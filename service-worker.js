/* global caches self */

// 🚨 IMPORTANT: You MUST update this version string whenever you deploy new changes!
// This will force the service worker to update and clear old caches.
// A good pattern is to use a date-based version like 'v2024-12-20-1'
const CACHE_NAME = 'image-mapper-v2025-09-16-38' // Updated version
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/app.css',
  './js/app.js',
  './js/storage.js',
  './js/ui/modals.js', // ✅ Fixed the typo - was '.js/ui/modals.js'
  './js/fileManager.js',
  './js/mapRenderer.js',
  './js/imageProcessor.js',
  './js/debug.js'
]
console.log('🚀 SERVICE WORKER SCRIPT LOADED - VERSION:', CACHE_NAME)

// Add more aggressive installation and debugging
self.addEventListener('install', (event) => {
  console.log(`Service Worker (${CACHE_NAME}): Installing...`)

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log(`Service Worker (${CACHE_NAME}): Caching static assets`)
        // Try to cache each asset individually to identify which one fails
        return Promise.all(
          STATIC_ASSETS.map(async (asset) => {
            try {
              await cache.add(asset)
              console.log(`✅ Cached: ${asset}`)
            } catch (error) {
              console.error(`❌ Failed to cache: ${asset}`, error)
              throw error // This will prevent installation
            }
          })
        )
      })
      .then(() => {
        console.log(`Service Worker (${CACHE_NAME}): Installation complete - FORCING SKIP WAITING`)
        return self.skipWaiting()
      })
      .catch((error) => {
        console.error(`Service Worker (${CACHE_NAME}): Installation failed`, error)
        throw error
      })
  )
})

// More aggressive activation
self.addEventListener('activate', (event) => {
  console.log(`Service Worker (${CACHE_NAME}): Activating...`)

  event.waitUntil(
    Promise.all([
      // Clear ALL caches
      caches.keys().then((cacheNames) => {
        console.log('Found caches:', cacheNames)
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log(`🗑️ Deleting old cache: ${cacheName}`)
              return caches.delete(cacheName)
            }
            return undefined
          })
        )
      }),
      // Take control immediately
      self.clients.claim()
    ]).then(() => {
      console.log(`✅ Service Worker (${CACHE_NAME}): Activation complete - TAKING CONTROL`)
      // Force reload all clients
      return self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          console.log('Sending reload message to client')
          client.postMessage({ type: 'SW_UPDATED', version: CACHE_NAME })
        })
      })
    })
  )
})

// Fetch event - serve from cache when offline, or fetch from network
self.addEventListener('fetch', (event) => {
  // Only handle HTTP/HTTPS requests and ignore chrome-extension:// etc.
  if (!event.request.url.startsWith('http') && !event.request.url.startsWith('https')) {
    return
  }

  // Handle cross-origin requests differently if needed, or simply return network fetch
  // For now, let's assume all requests can be cached or fetched.
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // Return cached version if available
        if (cachedResponse) {
          return cachedResponse
        }

        // Otherwise, fetch from network
        return fetch(event.request)
          .then((response) => {
            // Don't cache non-successful responses, non-GET, or opaque responses
            if (!response || response.status !== 200 || response.type !== 'basic' || event.request.method !== 'GET') {
              return response
            }

            // Clone the response because it's a stream and can only be consumed once
            const responseToCache = response.clone()

            // Cache dynamic content (like uploaded maps, or other resources determined by shouldCache)
            if (shouldCache(event.request.url)) {
              caches.open(CACHE_NAME)
                .then((cache) => {
                  cache.put(event.request, responseToCache)
                })
                .catch((error) => {
                  console.warn(`Service Worker (${CACHE_NAME}): Failed to cache dynamic asset: ${event.request.url}`, error)
                })
            }

            return response
          })
          .catch(() => {
            // If network fails and we don't have a cached version for the specific request,
            // return a fallback for navigation requests.
            if (event.request.mode === 'navigate') {
              // You should ideally have an offline.html page
              return caches.match('./index.html').catch(() => {
                console.error('Service Worker: Failed to retrieve index.html from cache during navigate fallback.')
                // As a last resort, return a generic offline response
                return new Response('<h1>You are offline!</h1><p>Content is not available offline.</p>', {
                  headers: { 'Content-Type': 'text/html' }
                })
              })
            }

            // For non-navigation requests (e.g., images, scripts), you might return a transparent image or a default JS
            return new Response(null, { status: 503, statusText: 'Offline - Resource not available' })
          })
      })
  )
})

// Helper function to determine if a resource should be cached dynamically
function shouldCache (url) {
  const urlObj = new URL(url)
  const pathname = urlObj.pathname

  // Explicitly cache debug.js if it's not already in STATIC_ASSETS
  if (pathname.endsWith('/debug.js')) {
    return true
  }

  // Cache recognized image types
  if (pathname.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
    return true
  }

  // Cache recognized font types
  if (pathname.match(/\.(woff|woff2|ttf|eot|otf)$/i)) {
    return true
  }

  // Cache CSS and JS files that are not already in STATIC_ASSETS
  if (pathname.match(/\.(css|js)$/i) && !STATIC_ASSETS.some(asset => asset.endsWith(pathname))) {
    return true
  }

  // Add other dynamic caching rules as needed
  // For example, if you fetch some API data that should be cached for offline use:
  // if (pathname.startsWith('/api/data')) { return true; }

  return false
}

// Handle background sync (for future use when syncing data to server)
self.addEventListener('sync', (event) => {
  console.log(`Service Worker (${CACHE_NAME}): Background sync triggered`, event.tag)

  if (event.tag === 'sync-image-data') {
    event.waitUntil(
      syncImageData()
    )
  }
})

// Placeholder for future sync functionality
async function syncImageData () {
  console.log(`Service Worker (${CACHE_NAME}): Syncing image data...`)
  // This will be implemented in later phases when we add server sync
  try {
    // Future: Upload pending data to server
    // const pendingData = await getPendingData();
    // await uploadToServer(pendingData);
    console.log(`Service Worker (${CACHE_NAME}): Sync completed`)
  } catch (error) {
    console.error(`Service Worker (${CACHE_NAME}): Sync failed`, error)
    throw error // This will cause the sync to be retried
  }
}

// Message handling for communication with main app
self.addEventListener('message', (event) => {
  console.log(`Service Worker (${CACHE_NAME}): Message received`, event.data)

  if (event.data && event.data.type) {
    switch (event.data.type) {
      case 'SKIP_WAITING':
        // This is typically handled by self.skipWaiting() in install,
        // but can be used for explicit message-driven skip.
        console.log(`Service Worker (${CACHE_NAME}): Skipping waiting - requested by client`)
        self.skipWaiting()
        break
      case 'GET_VERSION':
        // Respond with the current cache version
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({ version: CACHE_NAME })
        }
        break
      case 'CACHE_MAP':
        // Future: Handle caching of uploaded maps
        if (event.data.mapData) {
          cacheMapFile(event.data.mapData)
            .then(() => {
              if (event.ports && event.ports[0]) {
                event.ports[0].postMessage({ success: true, message: 'Map file cached successfully' })
              }
            })
            .catch((error) => {
              console.error(`Service Worker (${CACHE_NAME}): Failed to cache map file`, error)
              if (event.ports && event.ports[0]) {
                event.ports[0].postMessage({ success: false, error: error.message, message: 'Failed to cache map file' })
              }
            })
        }
        break
      default:
        console.log(`Service Worker (${CACHE_NAME}): Unknown message type`, event.data.type)
    }
  }
})

// Helper function for caching map files (to be implemented)
async function cacheMapFile (mapData) {
  // This will be implemented in Phase 1B when we handle file uploads in the client side
  console.log(`Service Worker (${CACHE_NAME}): Request to cache map file with data:`, mapData)

  // Example: If mapData contains a URL to an image, you can fetch and cache it here.
  // if (mapData && mapData.url) {
  //   const response = await fetch(mapData.url);
  //   if (!response.ok) throw new Error('Failed to fetch map image for caching');
  //   const cache = await caches.open(CACHE_NAME);
  //   await cache.put(mapData.url, response);
  //   console.log(`Service Worker (${CACHE_NAME}): Map image ${mapData.url} cached.`);
  // }
}
