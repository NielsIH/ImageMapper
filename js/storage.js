/* eslint-disable no-console */
/* global indexedDB */

/**
 * SnapSpot PWA - Storage System
 * Phase 1C: IndexedDB wrapper for map metadata, markers, and photos
 */

/**
 * IndexedDB wrapper for managing map storage
 * Stores map metadata, marker data, and photo data (blobs)
 */
export class MapStorage {
  constructor () {
    this.dbName = 'SnapSpotDB'
    this.version = 3 // Increment the database version for schema changes!
    this.db = null
    this.mapStoreName = 'maps' // Renamed for clarity
    this.markerStoreName = 'markers' // New store name
    this.photoStoreName = 'photos' // New store name
    this.keyPath = 'id' // Common keyPath for all stores
  }

  /**
   * Initialize IndexedDB connection and create object stores
   */
  async init () {
    return new Promise((resolve, reject) => {
      console.log('MapStorage: Initializing IndexedDB...')

      const request = indexedDB.open(this.dbName, this.version)

      request.onerror = () => {
        console.error('MapStorage: Failed to open IndexedDB', request.error)
        reject(new Error(`Failed to initialize storage: ${request.error}`))
      }

      request.onsuccess = () => {
        this.db = request.result
        console.log('MapStorage: IndexedDB initialized successfully')
        resolve()
      }

      request.onupgradeneeded = (event) => {
        console.log('MapStorage: Creating/upgrading database schema... Current version:', event.oldVersion, 'New version:', event.newVersion)
        const db = event.target.result
        const transaction = event.target.transaction // Get the transaction for this upgrade

        // Add event listeners to the upgrade transaction for better debugging
        transaction.oncomplete = () => {
          console.log('MapStorage: Upgrade transaction completed successfully.')
        }
        transaction.onerror = (e) => {
          console.error('MapStorage: Upgrade transaction ERROR:', e.target.error)
        }
        transaction.onabort = (e) => {
          console.error('MapStorage: Upgrade transaction ABORTED:', e.target.error)
        }

        // Create or upgrade maps object store
        let mapStore
        if (!db.objectStoreNames.contains(this.mapStoreName)) {
          mapStore = db.createObjectStore(this.mapStoreName, {
            keyPath: this.keyPath
          })
          mapStore.createIndex('name', 'name', { unique: false })
          mapStore.createIndex('createdDate', 'createdDate', { unique: false })
          mapStore.createIndex('lastModified', 'lastModified', { unique: false })
          mapStore.createIndex('isActive', 'isActive', { unique: false })
          mapStore.createIndex('imageHash', 'imageHash', { unique: false }) // NEW: Index for image hash
          console.log('MapStorage: Maps object store created/upgraded with indexes')
        } else {
          mapStore = transaction.objectStore(this.mapStoreName)
          // Check if index already exists. Add if not.
          if (!mapStore.indexNames.contains('imageHash')) {
            mapStore.createIndex('imageHash', 'imageHash', { unique: false })
            console.log('MapStorage: Added "imageHash" index to maps object store')
          }
        }

        // --- NEW: Create markers object store ---
        if (!db.objectStoreNames.contains(this.markerStoreName)) {
          const markerStore = db.createObjectStore(this.markerStoreName, {
            keyPath: this.keyPath
          })
          markerStore.createIndex('mapId', 'mapId', { unique: false }) // Index to quickly find markers for a map
          markerStore.createIndex('createdDate', 'createdDate', { unique: false })
          console.log('MapStorage: Markers object store created/upgraded with indexes')
        }

        // --- NEW: Create photos object store ---
        if (!db.objectStoreNames.contains(this.photoStoreName)) {
          const photoStore = db.createObjectStore(this.photoStoreName, {
            keyPath: this.keyPath
          })
          photoStore.createIndex('markerId', 'markerId', { unique: false }) // Index to quickly find photos for a marker
          photoStore.createIndex('createdDate', 'createdDate', { unique: false })
          console.log('MapStorage: Photos object store created/upgraded with indexes')
        }
      }
    })
  }

  /**
   * Generate a unique ID for new items
   * @param {string} prefix - Prefix for the ID (e.g., 'map', 'marker', 'photo')
   * @returns {string} - Unique ID
   */
  generateId (prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Add a new map to storage
   * @param {Object} mapData - Map metadata object
   * @param {string} mapData.id - (Optional) Pre-defined ID for the map. If not provided, a new one is generated.
   * @param {string} mapData.imageHash - The SHA256 hash of the map image content.
   * @param {Blob} mapData.imageData - The actual image Blob for the map.
   * @returns {Promise<Object>} - The saved map object with generated ID
   */
  async addMap (mapData) {
    if (!this.db) {
      throw new Error('Storage not initialized')
    }

    // Ensure imageData is a Blob if provided. This is crucial.
    if (mapData.imageData !== null && mapData.imageData !== undefined && !(mapData.imageData instanceof Blob)) {
      throw new Error('MapStorage: imageData must be a Blob object if provided (or null/undefined).')
    }

    const map = {
      id: mapData.id || this.generateId('map'),
      name: mapData.name || 'Untitled Map',
      description: mapData.description || '',
      fileName: mapData.fileName || '',
      filePath: mapData.filePath || '',
      width: mapData.width || 0,
      height: mapData.height || 0,
      fileSize: mapData.fileSize || 0,
      fileType: mapData.fileType || '',
      createdDate: new Date(),
      lastModified: new Date(),
      isActive: mapData.isActive || false,
      imageHash: mapData.imageHash || null,
      imageData: mapData.imageData || null, // RE-ADDED: Store the actual image Blob itself
      settings: {
        defaultZoom: 1,
        allowMarkers: true,
        ...mapData.settings
      }
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.mapStoreName], 'readwrite')
      const store = transaction.objectStore(this.mapStoreName)

      const request = store.put(map)

      request.onsuccess = () => {
        console.log('MapStorage: Map added/updated successfully', map.id)
        resolve(map)
      }

      request.onerror = () => {
        console.error('MapStorage: Failed to add/update map', request.error)
        reject(new Error(`Failed to save map: ${request.error}`))
      }
    })
  }

  /**
   * Get all maps from storage, enriched with marker count.\n   * This method fetches raw map data and calculates marker counts.\n   * Thumbnail Data URL generation is left to the application logic (e.g., App.js).\n   * @returns {Promise<Array<Object>>} - Array of all map objects, each including a 'markerCount' property.\n   */
  async getAllMaps () { // Modified to include markerCount and full map object
    if (!this.db) {
      throw new Error('Storage not initialized')
    }

    const transaction = this.db.transaction([this.mapStoreName, this.markerStoreName], 'readonly')
    const mapStore = transaction.objectStore(this.mapStoreName)
    const markerStore = transaction.objectStore(this.markerStoreName) // Need marker store for count

    // Fetch all raw map objects
    const allMapsRaw = await new Promise((resolve, reject) => {
      const request = mapStore.getAll()
      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => reject(request.error)
    })

    // Enrich each map with its marker count
    const mapsWithDetails = await Promise.all(allMapsRaw.map(async (map) => {
      const markers = await new Promise((resolve, reject) => {
        const request = markerStore.index('mapId').getAll(map.id)
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      const markerCount = markers.length

      return {
        ...map, // Spread the entire raw map object
        markerCount // Add or overwrite markerCount property
      }
    }))

    console.log(`MapStorage: Retrieved ${mapsWithDetails.length} maps with marker counts.`)
    return mapsWithDetails
  }

  /**
   * Get a specific map by ID
   * @param {string} id - Map ID
   * @returns {Promise<Object|null>} - Map object (including imageData) or null if not found
   */
  async getMap (id) {
    if (!this.db) {
      throw new Error('Storage not initialized')
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.mapStoreName], 'readonly')
      const store = transaction.objectStore(this.mapStoreName)
      const request = store.get(id)

      request.onsuccess = () => {
        const map = request.result
        console.log('MapStorage: Retrieved map', id, map ? 'found' : 'not found')
        resolve(map || null)
      }

      request.onerror = () => {
        console.error('MapStorage: Failed to get map', request.error)
        reject(new Error(`Failed to load map: ${request.error}`))
      }
    })
  }

  // NEW: Get maps by imageHash
  /**
   * Get maps by imageHash
   * @param {string} imageHash - The SHA256 hash of the map image content.
   * @returns {Promise<Array<Object>>} - Array of map objects matching the hash.
   */
  async getMapsByImageHash (imageHash) {
    if (!this.db) {
      throw new Error('Storage not initialized')
    }
    if (!imageHash) {
      return [] // No hash provided, no maps to find
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.mapStoreName], 'readonly')
      const store = transaction.objectStore(this.mapStoreName)
      const index = store.index('imageHash') // Use the new index
      const request = index.getAll(imageHash)

      request.onsuccess = () => {
        const maps = request.result || []
        console.log(`MapStorage: Retrieved ${maps.length} maps for image hash ${imageHash}`)
        resolve(maps)
      }

      request.onerror = () => {
        console.error('MapStorage: Failed to get maps by image hash', request.error)
        reject(new Error(`Failed to load maps by image hash: ${request.error}`))
      }
    })
  }

  /**
   * Update an existing map
   * @param {string} id - Map ID
   * @param {Object} updates - Object with properties to update
   * @returns {Promise<Object>} - Updated map object
   */
  async updateMap (id, updates) {
    if (!this.db) {
      throw new Error('Storage not initialized')
    }

    return new Promise((resolve, reject) => {
      const update = async () => {
        try {
          const existingMap = await this.getMap(id)
          if (!existingMap) {
            reject(new Error(`Map not found: ${id}`))
            return
          }

          const updatedMap = {
            ...existingMap,
            ...updates,
            id,
            lastModified: new Date()
          }

          const transaction = this.db.transaction([this.mapStoreName], 'readwrite')
          const store = transaction.objectStore(this.mapStoreName)
          const request = store.put(updatedMap)

          request.onsuccess = () => {
            console.log('MapStorage: Map updated successfully', id)
            resolve(updatedMap)
          }

          request.onerror = () => {
            console.error('MapStorage: Failed to update map', request.error)
            reject(new Error(`Failed to update map: ${request.error}`))
          }
        } catch (error) {
          reject(error)
        }
      }
      update()
    })
  }

  /**
   * Delete a map from storage (and all associated markers and photos)
   * @param {string} id - Map ID
   * @returns {Promise<boolean>} - Success status
   */
  async deleteMap (id) {
    if (!this.db) {
      throw new Error('Storage not initialized')
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.mapStoreName, this.markerStoreName, this.photoStoreName], 'readwrite')
      const mapStore = transaction.objectStore(this.mapStoreName)
      // const markerStore = transaction.objectStore(this.markerStoreName)
      // const photoStore = transaction.objectStore(this.photoStoreName)

      const deleteMarkersAndMap = async () => {
        try {
          // Delete associated markers and their photos
          const markers = await this.getMarkersForMap(id, transaction) // Pass transaction
          const markerDeletePromises = markers.map(marker => this._deleteMarkerInternal(marker.id, transaction))
          await Promise.all(markerDeletePromises)

          // Delete the map itself
          const deleteMapRequest = mapStore.delete(id)
          deleteMapRequest.onsuccess = () => {
            console.log('MapStorage: Map deleted successfully', id)
          }
          deleteMapRequest.onerror = (event) => {
            console.error('MapStorage: Failed to delete map', event.target.error)
            reject(new Error(`Failed to delete map: ${event.target.error}`))
          }

          transaction.oncomplete = () => resolve(true)
          transaction.onerror = (event) => reject(new Error(`Transaction failed: ${event.target.error}`))
          transaction.onabort = (event) => reject(new Error(`Transaction aborted: ${event.target.error}`))
        } catch (error) {
          reject(error)
        }
      }
      deleteMarkersAndMap()
    })
  }

  /**
   * Internal helper to delete a marker and its associated photos within an existing transaction.
   * @param {string} markerId
   * @param {IDBTransaction} [transaction] - Optional existing transaction
   * @private
   */
  async _deleteMarkerInternal (markerId, transaction = null) {
    if (!this.db) {
      throw new Error('Storage not initialized')
    }

    let t
    if (transaction) {
      t = transaction
    } else {
      t = this.db.transaction([this.markerStoreName, this.photoStoreName], 'readwrite')
    }

    const markerStore = t.objectStore(this.markerStoreName)
    const photoStore = t.objectStore(this.photoStoreName)

    // Delete associated photos
    const photos = await this.getPhotosForMarker(markerId, t) // Pass transaction
    const photoDeletePromises = photos.map(photo => {
      return new Promise((resolve, reject) => {
        const req = photoStore.delete(photo.id)
        req.onsuccess = () => resolve()
        req.onerror = (e) => reject(e)
      })
    })
    await Promise.all(photoDeletePromises)

    // Delete the marker itself
    await new Promise((resolve, reject) => {
      const req = markerStore.delete(markerId)
      req.onsuccess = () => resolve()
      req.onerror = (e) => reject(e)
    })

    if (!transaction) { // Only complete if transaction was created here
      return new Promise((resolve, reject) => {
        t.oncomplete = () => resolve()
        t.onerror = (e) => reject(e)
        t.onabort = (e) => reject(e)
      })
    }
  }

  /**
   * Set a map as active (and deactivate all others)
   * @param {string} id - Map ID to set as active
   * @returns {Promise<Object>} - Updated active map object
   */
  async setActiveMap (id) {
    if (!this.db) {
      throw new Error('Storage not initialized')
    }

    try {
      const allMaps = await this.getAllMaps()
      const updatePromises = allMaps.map(map => {
        if (map.isActive && map.id !== id) {
          return this.updateMap(map.id, { isActive: false })
        }
        return Promise.resolve()
      })

      await Promise.all(updatePromises)

      const activeMap = await this.updateMap(id, { isActive: true })
      console.log('MapStorage: Active map set to', id)
      return activeMap
    } catch (error) {
      console.error('MapStorage: Failed to set active map', error)
      throw error
    }
  }

  /**
   * Get the currently active map
   * @returns {Promise<Object|null>} - Active map object or null
   */
  async getActiveMap () {
    if (!this.db) {
      throw new Error('Storage not initialized')
    }

    try {
      const allMaps = await this.getAllMaps()
      const activeMap = allMaps.find(map => map.isActive === true)

      console.log('MapStorage: Active map retrieved', activeMap ? activeMap.id : 'none')
      return activeMap || null
    } catch (error) {
      console.error('MapStorage: Failed to get active map', error)
      throw new Error(`Failed to get active map: ${error.message}`)
    }
  }

  /**
   * Get maps sorted by creation date (newest first)
   * @returns {Promise<Array>} - Sorted array of map objects
   */
  async getMapsSortedByDate () {
    const maps = await this.getAllMaps()
    return maps.sort((a, b) => new Date(b.createdDate) - new Date(a.createdDate))
  }

  /**
   * Search maps by name (case-insensitive)
   * @param {string} searchTerm - Search term
   * @returns {Promise<Array>} - Array of matching map objects
   */
  async searchMaps (searchTerm) {
    const maps = await this.getAllMaps()
    const term = searchTerm.toLowerCase()
    return maps.filter(map =>
      map.name.toLowerCase().includes(term) ||
      map.description.toLowerCase().includes(term)
    )
  }

  // ========================================

  // NEW: Marker Storage Methods

  // ========================================

  /**
   * Add a new marker to storage
   * @param {Object} markerData - Marker data object (x, y, mapId, etc.)
   * @returns {Promise<Object>} - The saved marker object
   */
  async addMarker (markerData) {
    if (!this.db) {
      throw new Error('Storage not initialized')
    }
    const marker = {
      id: this.generateId('marker'),
      mapId: markerData.mapId,
      x: markerData.x, // Map X coordinate (image pixel)
      y: markerData.y, // Map Y coordinate (image pixel)
      createdDate: new Date(),
      lastModified: new Date(),
      description: markerData.description || '',
      photoIds: [] // Array of photo IDs linked to this marker
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.markerStoreName], 'readwrite')
      const store = transaction.objectStore(this.markerStoreName)
      const request = store.add(marker)

      request.onsuccess = () => {
        console.log('MapStorage: Marker added successfully', marker.id)
        resolve(marker)
      }

      request.onerror = () => {
        console.error('MapStorage: Failed to add marker', request.error)
        reject(new Error(`Failed to save marker: ${request.error}`))
      }
    })
  }

  /**
   * Get all markers for a specific map, sorted by createdDate.
   * @param {string} mapId - The ID of the map
   * @param {IDBTransaction} [transaction] - Optional existing transaction
   * @returns {Promise<Array>} - Array of marker objects, sorted by createdDate ascending
   */
  async getMarkersForMap (mapId, transaction = null) {
    if (!this.db) {
      throw new Error('Storage not initialized')
    }

    return new Promise((resolve, reject) => {
      let t = transaction
      if (!t) {
        t = this.db.transaction([this.markerStoreName], 'readonly')
      }
      const store = t.objectStore(this.markerStoreName)
      // Use the 'createdDate' index and open a cursor to iterate in order
      const index = store.index('createdDate')
      const markers = []

      // To filter by mapId AND sort by createdDate:
      // We can't directly use index.getAll(mapId) if we want to sort by createdDate index.
      // We need to iterate over the createdDate index and filter by mapId.
      const request = index.openCursor(null, 'next') // Iterate all by createdDate

      request.onsuccess = (event) => {
        const cursor = event.target.result
        if (cursor) {
          if (cursor.value.mapId === mapId) {
            markers.push(cursor.value)
          }
          cursor.continue()
        } else {
          // Cursor finished, and markers are already in createdDate order
          console.log(`MapStorage: Retrieved ${markers.length} markers for map ${mapId}, sorted by creation date.`)
          resolve(markers)
        }
      }

      request.onerror = () => {
        console.error('MapStorage: Failed to get and sort markers for map', request.error)
        reject(new Error(`Failed to load and sort markers: ${request.error}`))
      }
    })
  }

  /**
   * Get a specific marker by ID
   * @param {string} markerId - The ID of the marker
   * @returns {Promise<Object|null>} - Marker object or null if not found
   */
  async getMarker (markerId) {
    if (!this.db) {
      throw new Error('Storage not initialized')
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.markerStoreName], 'readonly')
      const store = transaction.objectStore(this.markerStoreName)
      const request = store.get(markerId)

      request.onsuccess = () => {
        const marker = request.result
        console.log('MapStorage: Retrieved marker', markerId, marker ? 'found' : 'not found')
        resolve(marker || null)
      }

      request.onerror = () => {
        console.error('MapStorage: Failed to get marker', request.error)
        reject(new Error(`Failed to load marker: ${request.error}`))
      }
    })
  }

  /**
   * NEW: Get the number of photos associated with a specific marker diluted.
   * @param {string} markerId - The ID of the marker.
   * @param {IDBTransaction} [transaction] - Optional existing transaction.
   * @returns {Promise<number>} - The count of photos for the marker.
   */
  async getMarkerPhotoCount (markerId, transaction = null) {
    if (!this.db) {
      throw new Error('Storage not initialized')
    }

    return new Promise((resolve, reject) => {
      let t = transaction
      if (!t) {
        t = this.db.transaction([this.photoStoreName], 'readonly')
      }
      const store = t.objectStore(this.photoStoreName)
      const index = store.index('markerId')
      // Use count() for efficiency, instead of getAll()
      const request = index.count(markerId)

      request.onsuccess = () => {
        resolve(request.result) // result is the count
      }

      request.onerror = () => {
        console.error('MapStorage: Failed to get photo count for marker', request.error)
        reject(new Error(`Failed to load photo count: ${request.error}`))
      }
    })
  }

  /**
   * Update an existing marker
   * @param {string} markerId - Marker ID
   * @param {Object} updates - Object with properties to update
   * @returns {Promise<Object>} - Updated marker object
   */
  async updateMarker (markerId, updates) {
    if (!this.db) {
      throw new Error('Storage not initialized')
    }

    return new Promise((resolve, reject) => {
      const update = async () => {
        try {
          const existingMarker = await this.getMarker(markerId)
          if (!existingMarker) {
            reject(new Error(`Marker not found: ${markerId}`))
            return
          }

          const updatedMarker = {
            ...existingMarker,
            ...updates,
            id: markerId,
            lastModified: new Date()
          }

          const transaction = this.db.transaction([this.markerStoreName], 'readwrite')
          const store = transaction.objectStore(this.markerStoreName)
          const request = store.put(updatedMarker)

          request.onsuccess = () => {
            console.log('MapStorage: Marker updated successfully', markerId)
            resolve(updatedMarker)
          }

          request.onerror = () => {
            console.error('MapStorage: Failed to update marker', request.error)
            reject(new Error(`Failed to update marker: ${request.error}`))
          }
        } catch (error) {
          reject(error)
        }
      }
      update()
    })
  }

  /**
   * Delete a marker (and its associated photos)
   * @param {string} markerId - The ID of the marker to delete
   * @returns {Promise<boolean>} - Success status
   */
  async deleteMarker (markerId) {
    if (!this.db) {
      throw new Error('Storage not initialized')
    }
    return this._deleteMarkerInternal(markerId) // Use the internal helper
  }

  /**
   * Get all markers across all maps
   * @returns {Promise<Array>} - Array of all marker objects
   */
  async getAllMarkers () {
    if (!this.db) {
      throw new Error('Storage not initialized')
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.markerStoreName], 'readonly')
      const store = transaction.objectStore(this.markerStoreName)
      const request = store.getAll()

      request.onsuccess = () => {
        const markers = request.result || []
        console.log(`MapStorage: Retrieved ${markers.length} total markers`)
        resolve(markers)
      }

      request.onerror = () => {
        console.error('MapStorage: Failed to get all markers', request.error)
        reject(new Error(`Failed to load all markers: ${request.error}`))
      }
    })
  }
  // ========================================

  // NEW: Photo Storage Methods

  // ========================================

  /**
   * Add a new photo to storage
   * @param {Object} photoData - Photo data object (imageData, markerId, etc.)
   * @returns {Promise<Object>} - The saved photo object
   */
  async addPhoto (photoData) {
    if (!this.db) {
      throw new Error('Storage not initialized')
    }
    if (!(photoData.imageData instanceof Blob)) {
      throw new Error('PhotoStorage: imageData must be a Blob object.')
    }
    const photo = {
      id: this.generateId('photo'),
      markerId: photoData.markerId,
      imageData: photoData.imageData, // The actual image Blob
      thumbnailData: photoData.thumbnailData || null, // Optional thumbnail Blob or Data URL
      fileName: photoData.fileName || 'Untitled Photo',
      fileType: photoData.fileType || 'image/jpeg',
      fileSize: photoData.fileSize || 0,
      createdDate: new Date(),
      description: photoData.description || ''
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.photoStoreName], 'readwrite')
      const store = transaction.objectStore(this.photoStoreName)
      const request = store.add(photo)

      request.onsuccess = () => {
        console.log('MapStorage: Photo added successfully', photo.id)
        resolve(photo)
      }

      request.onerror = () => {
        console.error('MapStorage: Failed to add photo', request.error)
        reject(new Error(`Failed to save photo: ${request.error}`))
      }
    })
  }

  /**
   * Get all photos for a specific marker
   * @param {string} markerId - The ID of the marker
   * @param {IDBTransaction} [transaction] - Optional existing transaction
   * @returns {Promise<Array>} - Array of photo objects
   */
  async getPhotosForMarker (markerId, transaction = null) {
    if (!this.db) {
      throw new Error('Storage not initialized')
    }

    return new Promise((resolve, reject) => {
      let t = transaction
      if (!t) {
        t = this.db.transaction([this.photoStoreName], 'readonly')
      }
      const store = t.objectStore(this.photoStoreName)
      const index = store.index('markerId')
      const request = index.getAll(markerId)

      request.onsuccess = () => {
        const photos = request.result || []
        console.log(`MapStorage: Retrieved ${photos.length} photos for marker ${markerId}`)
        resolve(photos)
      }

      request.onerror = () => {
        console.error('MapStorage: Failed to get photos for marker', request.error)
        reject(new Error(`Failed to load photos: ${request.error}`))
      }
    })
  }

  /**
   * Get a specific photo by ID
   * @param {string} photoId - The ID of the photo
   * @returns {Promise<Object|null>} - Photo object or null if not found
   */
  async getPhoto (photoId) {
    if (!this.db) {
      throw new Error('Storage not initialized')
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.photoStoreName], 'readonly')
      const store = transaction.objectStore(this.photoStoreName)
      const request = store.get(photoId)

      request.onsuccess = () => {
        const photo = request.result
        console.log('MapStorage: Retrieved photo', photoId, photo ? 'found' : 'not found')
        resolve(photo || null)
      }

      request.onerror = () => {
        console.error('MapStorage: Failed to get photo', request.error)
        reject(new Error(`Failed to load photo: ${request.error}`))
      }
    })
  }

  /**
   * Delete a photo by ID
   * @param {string} photoId - The ID of the photo to delete
   * @returns {Promise<boolean>} - Success status
   */
  async deletePhoto (photoId) {
    if (!this.db) {
      throw new Error('Storage not initialized')
    }

    return new Promise((resolve, reject) => {
      // Need to also update the marker that references this photo
      // For now, simple delete. Later, we'll implement this more robustly
      // to remove photoId from marker.photoIds array.

      const transaction = this.db.transaction([this.photoStoreName, this.markerStoreName], 'readwrite')
      const photoStore = transaction.objectStore(this.photoStoreName)
      const markerStore = transaction.objectStore(this.markerStoreName)

      photoStore.get(photoId).onsuccess = (event) => {
        const photoToDelete = event.target.result
        if (photoToDelete && photoToDelete.markerId) {
          markerStore.get(photoToDelete.markerId).onsuccess = (e) => {
            const marker = e.target.result
            if (marker) {
              marker.photoIds = marker.photoIds.filter(id => id !== photoId)
              markerStore.put(marker) // Update marker
            }
          }
        }
      }

      const request = photoStore.delete(photoId)

      request.onsuccess = () => {
        console.log('MapStorage: Photo deleted successfully', photoId)
        resolve(true)
      }

      request.onerror = () => {
        console.error('MapStorage: Failed to delete photo', request.error)
        reject(new Error(`Failed to delete photo: ${request.error}`))
      }
    })
  }

  /**
   * Get all photos across all maps and markers
   * @returns {Promise<Array>} - Array of all photo objects
   */
  async getAllPhotos () {
    if (!this.db) {
      throw new Error('Storage not initialized')
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.photoStoreName], 'readonly')
      const store = transaction.objectStore(this.photoStoreName)
      const request = store.getAll()

      request.onsuccess = () => {
        const photos = request.result || []
        console.log(`MapStorage: Retrieved ${photos.length} total photos`)
        resolve(photos)
      }

      request.onerror = () => {
        console.error('MapStorage: Failed to get all photos', request.error)
        reject(new Error(`Failed to load all photos: ${request.error}`))
      }
    })
  }

  /**
   * Get all photos across all maps and markers, each enriched with its associated marker and map context.\n   *\n   * @returns {Promise<Array<Object>>} - Array of enriched photo objects. Each object\n   *   represents a unique photo record and includes:\n   *   {\n   *     id: photo.id,                  // The unique ID of the photo record\n   *     markerId: photo.markerId,      // The ID of the marker this photo record is attached to\n   *     mapId: map.id,                 // The ID of the map the marker belongs to\n   *     mapName: map.name,             // The name of the map\n   *     markerDescription: marker.description, // Description of the associated marker\n   *     fileName: photo.fileName,\n   *     thumbnailData: photo.thumbnailData,\n   *     imageData: photo.imageData,    // The full image blob (use with caution due to size)\n   *     // ... other original photo properties\n   *   }\n   */
  async getAllPhotosWithContext () {
    if (!this.db) {
      throw new Error('Storage not initialized')
    }

    return new Promise((resolve, reject) => {
      ;(async () => {
        try {
          const transaction = this.db.transaction([this.photoStoreName, this.markerStoreName, this.mapStoreName], 'readonly')
          const photoStore = transaction.objectStore(this.photoStoreName)
          const markerStore = transaction.objectStore(this.markerStoreName)
          const mapStore = transaction.objectStore(this.mapStoreName)

          // Fetch all photos
          const allPhotos = await new Promise((resolve, reject) => {
            const req = photoStore.getAll()
            req.onsuccess = () => resolve(req.result || [])
            req.onerror = (e) => {
              console.error('MapStorage: Error fetching all photos:', e)
              reject(e)
            }
          })

          const enrichedPhotos = []
          for (const photo of allPhotos) {
            // Each photo record has a single markerId
            if (!photo.markerId) {
              console.warn(`MapStorage: Photo record ${photo.id} does not have a markerId. Skipping enrichment.`)
              continue
            }

            // Fetch the marker for this photo
            const marker = await new Promise((resolve, reject) => {
              const req = markerStore.get(photo.markerId)
              req.onsuccess = () => resolve(req.result)
              req.onerror = (e) => {
                console.error(`MapStorage: Error fetching marker ${photo.markerId} for photo ${photo.id}:`, e)
                reject(e)
              }
            })

            if (!marker) {
              console.warn(`MapStorage: Marker ${photo.markerId} not found for photo record ${photo.id}. Skipping enrichment.`)
              continue
            }
            if (!marker.mapId) {
              console.warn(`MapStorage: Marker ${marker.id} does not have a mapId. Skipping enrichment for photo record ${photo.id}.`)
              continue
            }

            // Fetch the map for this marker
            const map = await new Promise((resolve, reject) => {
              const req = mapStore.get(marker.mapId)
              req.onsuccess = () => resolve(req.result)
              req.onerror = (e) => {
                console.error(`MapStorage: Error fetching map ${marker.mapId} for marker ${marker.id}:`, e)
                reject(e)
              }
            })

            if (!map) {
              console.warn(`MapStorage: Map ${marker.mapId} not found for marker ${marker.id} and photo record ${photo.id}. Skipping enrichment.`)
              continue
            }

            enrichedPhotos.push({
              // Spread all original photo properties
              ...photo,
              // Add context properties for easy access
              mapId: map.id,
              mapName: map.name,
              markerDescription: marker.description || 'No marker description'
              // Note: photo.markerId is already part of the original photo object
            })
          }

          console.log(`MapStorage: Retrieved ${enrichedPhotos.length} enriched photo entries with context.`)
          resolve(enrichedPhotos)
        } catch (error) {
          console.error('MapStorage: Failed to get all photos with context', error)
          reject(new Error(`Failed to load enriched photo entries: ${error.message}`))
        }
      })()
    })
  }

  /**
   * Get all photos for a specific map across all its markers.
   * @param {string} mapId - The ID of the map.
   * @returns {Promise<Array>} - Array of photo objects for the given map.
   */
  async getPhotosForMap (mapId) {
    if (!this.db) {
      throw new Error('Storage not initialized')
    }

    return new Promise((resolve, reject) => {
      ;(async () => {
        try {
          const transaction = this.db.transaction([this.markerStoreName, this.photoStoreName], 'readonly')
          const markerStore = transaction.objectStore(this.markerStoreName)
          const photoStore = transaction.objectStore(this.photoStoreName)

          // 1. Get all markers for the given mapId
          const markers = await new Promise((resolve, reject) => {
            const markersRequest = markerStore.index('mapId').getAll(mapId)

            markersRequest.onsuccess = () => resolve(markersRequest.result || [])
            markersRequest.onerror = (e) => reject(e)
          })
          const allPhotoIds = new Set()
          markers.forEach(marker => {
            if (marker.photoIds) {
              marker.photoIds.forEach(photoId => allPhotoIds.add(photoId))
            }
          })

          // 2. Fetch all unique photo objects based on collected photoIds

          const photoPromises = Array.from(allPhotoIds).map(photoId => {
            return new Promise((resolve, reject) => {
              const photoRequest = photoStore.get(photoId)

              photoRequest.onsuccess = () => resolve(photoRequest.result)
              photoRequest.onerror = (e) => reject(e)
            })
          })

          const photos = (await Promise.all(photoPromises)).filter(photo => photo != null)
          console.log(`MapStorage: Retrieved ${photos.length} photos for map ${mapId}`)
          resolve(photos)
        } catch (error) {
          console.error('MapStorage: Failed to get photos for map', error)
          reject(new Error(`Failed to load photos for map: ${error.message}`))
        }
      })()
    })
  }

  // ========================================

  // Remaining Utility Methods

  // ========================================

  /**
   * Get storage statistics
   * @returns {Promise<Object>} - Storage usage statistics
   */
  async getStorageStats () {
    try {
      const maps = await this.getAllMaps() // Changed to this.mapStoreName
      const totalMaps = maps.length
      const totalFileSize = maps.reduce((sum, map) => sum + (map.fileSize || 0), 0)
      const activeMap = maps.find(map => map.isActive)

      const markers = await this.getAllMarkers() // Uses new marker functions
      const photos = await this.getAllPhotos() // Uses new photo functions
      const totalMarkers = markers.length
      const totalPhotos = photos.length
      // Be careful about photo.imageData being very large, ensure file size is stored
      const totalPhotoSize = photos.reduce((sum, photo) => sum + (photo.fileSize || 0), 0)

      return {
        totalMaps,
        totalFileSize,
        averageFileSize: totalMaps > 0 ? Math.round(totalFileSize / totalMaps) : 0,
        activeMapId: activeMap ? activeMap.id : null,
        oldestMap: totalMaps > 0
          ? maps.reduce((oldest, map) =>
            new Date(map.createdDate) < new Date(oldest.createdDate) ? map : oldest
          )
          : null,
        newestMap: totalMaps > 0
          ? maps.reduce((newest, map) =>
            new Date(map.createdDate) > new Date(newest.createdDate) ? map : newest
          )
          : null,
        totalMarkers,
        totalPhotos,
        totalPhotoSize
      }
    } catch (error) {
      console.error('MapStorage: Failed to get storage stats', error)
      return {
        totalMaps: 0,
        totalFileSize: 0,
        averageFileSize: 0,
        activeMapId: null,
        oldestMap: null,
        newestMap: null,
        totalMarkers: 0,
        totalPhotos: 0,
        totalPhotoSize: 0
      }
    }
  }

  /**
   * Clear all maps from storage (with confirmation) - NOW CLEARS ALL OBJECT STORES
   * @returns {Promise<boolean>} - Success status
   */
  async clearAllMaps () {
    if (!this.db) {
      throw new Error('Storage not initialized')
    }

    return new Promise((resolve, reject) => {
      // Clear all three object stores
      const transaction = this.db.transaction([this.mapStoreName, this.markerStoreName, this.photoStoreName], 'readwrite')
      const mapStore = transaction.objectStore(this.mapStoreName)
      const markerStore = transaction.objectStore(this.markerStoreName)
      const photoStore = transaction.objectStore(this.photoStoreName)

      const reqMapClear = mapStore.clear()
      const reqMarkerClear = markerStore.clear()
      const reqPhotoClear = photoStore.clear()

      let clearedCount = 0
      const totalStores = 3

      const checkCompletion = () => {
        clearedCount++
        if (clearedCount === totalStores) {
          console.log('MapStorage: All object stores cleared successfully')
          resolve(true)
        }
      }

      reqMapClear.onsuccess = checkCompletion
      reqMarkerClear.onsuccess = checkCompletion
      reqPhotoClear.onsuccess = checkCompletion

      reqMapClear.onerror = (e) => reject(new Error(`Failed to clear maps: ${e.target.error}`))
      reqMarkerClear.onerror = (e) => reject(new Error(`Failed to clear markers: ${e.target.error}`))
      reqPhotoClear.onerror = (e) => reject(new Error(`Failed to clear photos: ${e.target.error}`))

      transaction.onerror = (event) => {
        console.error('MapStorage: Transaction failed to clear all stores', event.target.error)
        reject(new Error(`Failed to clear all stores: ${event.target.error}`))
      }
    })
  }

  /**
   * Saves or updates a map in storage. Respects the ID provided in mapData.
   * If mapData does not contain an 'id', it will be treated as a new map and
   * the ID will be generated (by delegating to addMap).
   * @param {Object} mapData - The map object to save, must contain 'id' for updates.
   * @param {string} mapData.imageHash - The SHA256 hash of the map image content.
   * @param {Blob} mapData.imageData - The actual image Blob for the map.
   * @returns {Promise<Object>} - The saved/updated map object.
   */
  async saveMap (mapData) {
    if (!this.db) {
      throw new Error('Storage not initialized')
    }
    // If no ID is provided in mapData, delegate to addMap which generates a new ID.
    if (!mapData.id) {
      console.warn('MapStorage: mapData provided without ID to saveMap, delegating to addMap.')
      return this.addMap(mapData)
    }

    // Ensure imageData is a Blob if provided. This is crucial.
    // An update might not provide imageData if it's just updating other metadata,
    // so we get it from existingMap if not provided.
    if (mapData.imageData !== null && mapData.imageData !== undefined && !(mapData.imageData instanceof Blob)) {
      throw new Error('MapStorage: imageData must be a Blob object if provided (or null/undefined).')
    }

    const transaction = this.db.transaction([this.mapStoreName], 'readwrite')
    const store = transaction.objectStore(this.mapStoreName)

    return new Promise((resolve, reject) => {
      store.get(mapData.id).onsuccess = async (event) => {
        const existingMap = event.target.result

        const mapToSave = {
          id: mapData.id,
          name: mapData.name || (existingMap ? existingMap.name : 'Untitled Map'),
          description: mapData.description || (existingMap ? existingMap.description : ''),
          fileName: mapData.fileName || (existingMap ? existingMap.fileName : ''),
          filePath: mapData.filePath || (existingMap ? existingMap.filePath : ''),
          width: mapData.width || (existingMap ? existingMap.width : 0),
          height: mapData.height || (existingMap ? existingMap.height : 0),
          fileSize: mapData.fileSize || (existingMap ? existingMap.fileSize : 0),
          fileType: mapData.fileType || (existingMap ? existingMap.fileType : ''),
          createdDate: mapData.createdDate ? new Date(mapData.createdDate) : (existingMap ? existingMap.createdDate : new Date()),
          lastModified: new Date(),
          isActive: mapData.isActive !== undefined ? mapData.isActive : (existingMap ? existingMap.isActive : false),
          imageHash: mapData.imageHash || (existingMap ? existingMap.imageHash : null),
          imageData: mapData.imageData || (existingMap ? existingMap.imageData : null), // RE-ADDED: Ensure imageData is carried over
          settings: {
            defaultZoom: 1,
            allowMarkers: true,
            ...(existingMap ? existingMap.settings : {}), // Merge existing settings
            ...mapData.settings
          }
        }

        const request = store.put(mapToSave)

        request.onsuccess = () => {
          console.log('MapStorage: Map saved/updated successfully', mapToSave.id)
          transaction.commit?.() // Commit if available
          resolve(mapToSave)
        }

        request.onerror = () => {
          console.error('MapStorage: Failed to save/update map', request.error)
          transaction.abort?.() // Abort if available
          reject(new Error(`Failed to save map: ${request.error}`))
        }
      }
      store.get(mapData.id).onerror = (error) => {
        console.error('MapStorage: Failed to retrieve existing map during saveMap', error)
        reject(new Error(`Failed to retrieve existing map for saving: ${error.message}`))
      }
    })
  }

  /**
   * Saves or updates a marker in storage. Respects the ID provided in markerData.
   * If markerData does not contain an 'id', it will be treated as a new marker and
   * the ID will be generated (by delegating to addMarker).\n   * @param {Object} markerData - The marker object to save, must contain 'id' for updates.\n   * @returns {Promise<Object>} - The saved/updated marker object.\n   */
  async saveMarker (markerData) {
    if (!this.db) {
      throw new Error('Storage not initialized')
    }
    // If no ID is provided in markerData, delegate to addMarker.
    if (!markerData.id) {
      console.warn('MapStorage: markerData provided without ID to saveMarker, delegating to addMarker.')
      return this.addMarker(markerData)
    }
    const markerToSave = {
      id: markerData.id, // Use the provided ID
      mapId: markerData.mapId,
      x: markerData.x,
      y: markerData.y,
      createdDate: markerData.createdDate ? new Date(markerData.createdDate) : new Date(),
      lastModified: new Date(), // Always update lastModified on save
      description: markerData.description || '',
      photoIds: markerData.photoIds || [] // Ensure it's an array
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.markerStoreName], 'readwrite')
      const store = transaction.objectStore(this.markerStoreName)
      const request = store.put(markerToSave) // Use put()

      request.onsuccess = () => {
        console.log('MapStorage: Marker saved/updated successfully', markerToSave.id)
        resolve(markerToSave)
      }

      request.onerror = () => {
        console.error('MapStorage: Failed to save/update marker', request.error)
        reject(new Error(`Failed to save marker: ${request.error}`))
      }
    })
  }

  /**
   * Saves or updates a photo in storage. Respects the ID provided in photoData.
   * If photoData does not contain an 'id', it will be treated as a new photo and
   * the ID will be generated (by delegating to addPhoto).\n   * @param {Object} photoData - The photo object to save, must contain 'id' for updates.\n   * @returns {Promise<Object>} - The saved/updated photo object.\n   */
  async savePhoto (photoData) {
    if (!this.db) {
      throw new Error('Storage not initialized')
    }
    // If no ID is provided in photoData, delegate to addPhoto.
    if (!photoData.id) {
      console.warn('MapStorage: photoData provided without ID to savePhoto, delegating to addPhoto.')
      return this.addPhoto(photoData)
    }
    if (!(photoData.imageData instanceof Blob)) { // imageData MUST be a Blob for storage
      throw new Error('PhotoStorage: imageData must be a Blob object for saving (or null/undefined).')
    }

    const photoToSave = {
      id: photoData.id, // Use the provided ID
      markerId: photoData.markerId,
      imageData: photoData.imageData,
      thumbnailData: photoData.thumbnailData || null, // Already Base64 or null
      fileName: photoData.fileName || 'Untitled Photo',
      fileType: photoData.fileType || 'image/jpeg',
      fileSize: photoData.fileSize || 0,
      createdDate: photoData.createdDate ? new Date(photoData.createdDate) : new Date(),
      description: photoData.description || ''
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.photoStoreName], 'readwrite')
      const store = transaction.objectStore(this.photoStoreName)
      const request = store.put(photoToSave) // Use put()

      request.onsuccess = () => {
        console.log('MapStorage: Photo saved/updated successfully', photoToSave.id)
        resolve(photoToSave)
      }

      request.onerror = () => {
        console.error('MapStorage: Failed to save/update photo', request.error)
        reject(new Error(`Failed to save photo: ${request.error}`))
      }
    })
  }

  /**
   * Close the database connection
   */
  close () {
    if (this.db) {
      this.db.close()
      this.db = null
      console.log('MapStorage: Database connection closed')
    }
  }

  /**
   * Check if storage is available and initialized, including new stores
   * @returns {boolean} - Storage availability status
   */
  isAvailable () {
    return !!this.db &&
           this.db.objectStoreNames.contains(this.mapStoreName) &&
           this.db.objectStoreNames.contains(this.markerStoreName) &&
           this.db.objectStoreNames.contains(this.photoStoreName)
  }
}
