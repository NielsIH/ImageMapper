/* global caches self */

const CACHE_NAME = 'image-mapper-v1'
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/app.css',
  './js/app.js'
  // Note: Map images and photos will be cached dynamically
]

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...')

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching static assets')
        return cache.addAll(STATIC_ASSETS)
      })
      .then(() => {
        console.log('Service Worker: Installation complete')
        // Force the waiting service worker to become the active service worker
        return self.skipWaiting()
      })
      .catch((error) => {
        console.error('Service Worker: Installation failed', error)
      })
  )
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...')

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('Service Worker: Deleting old cache', cacheName)
              return caches.delete(cacheName)
            }
            return null
          })
        )
      })
      .then(() => {
        console.log('Service Worker: Activation complete')
        // Ensure the service worker takes control immediately
        return self.clients.claim()
      })
  )
})

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
  // Only handle HTTP/HTTPS requests
  if (!event.request.url.startsWith('http')) {
    return
  }

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
            // Don't cache non-successful responses
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response
            }

            // Clone the response because it's a stream
            const responseToCache = response.clone()

            // Cache dynamic content (like uploaded maps)
            if (shouldCache(event.request.url)) {
              caches.open(CACHE_NAME)
                .then((cache) => {
                  cache.put(event.request, responseToCache)
                })
            }

            return response
          })
          .catch(() => {
            // If network fails and we don't have a cached version,
            // return a custom offline page for navigation requests
            if (event.request.mode === 'navigate') {
              return caches.match('./index.html')
            }

            // For other requests, you might want to return a default response
            return new Response('Offline - Content not available', {
              status: 503,
              statusText: 'Service Unavailable'
            })
          })
      })
  )
})

// Helper function to determine if a resource should be cached
function shouldCache (url) {
  // Cache images and other assets
  const urlObj = new URL(url)
  const pathname = urlObj.pathname

  // Cache image files (maps and photos will be handled differently)
  if (pathname.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
    return true
  }

  // Cache CSS and JS files
  if (pathname.match(/\.(css|js)$/i)) {
    return true
  }

  return false
}

// Handle background sync (for future use when syncing data to server)
self.addEventListener('sync', (event) => {
  console.log('Service Worker: Background sync triggered', event.tag)

  if (event.tag === 'sync-image-data') {
    event.waitUntil(
      syncImageData()
    )
  }
})

// Placeholder for future sync functionality
async function syncImageData () {
  console.log('Service Worker: Syncing image data...')
  // This will be implemented in later phases when we add server sync
  try {
    // Future: Upload pending data to server
    // const pendingData = await getPendingData();
    // await uploadToServer(pendingData);
    console.log('Service Worker: Sync completed')
  } catch (error) {
    console.error('Service Worker: Sync failed', error)
    throw error // This will cause the sync to be retried
  }
}

// Message handling for communication with main app
self.addEventListener('message', (event) => {
  console.log('Service Worker: Message received', event.data)

  if (event.data && event.data.type) {
    switch (event.data.type) {
      case 'SKIP_WAITING':
        self.skipWaiting()
        break
      case 'GET_VERSION':
        event.ports[0].postMessage({ version: CACHE_NAME })
        break
      case 'CACHE_MAP':
        // Future: Handle caching of uploaded maps
        cacheMapFile(event.data.mapData)
          .then(() => {
            event.ports[0].postMessage({ success: true })
          })
          .catch((error) => {
            event.ports[0].postMessage({ success: false, error: error.message })
          })
        break
      default:
        console.log('Service Worker: Unknown message type', event.data.type)
    }
  }
})

// Helper function for caching map files (to be implemented)
async function cacheMapFile (mapData) {
  // This will be implemented in Phase 1B when we handle file uploads
  console.log('Service Worker: Caching map file', mapData)
}
