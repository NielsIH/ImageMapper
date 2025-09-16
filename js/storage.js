/**
 * Image Mapper PWA - Storage System
 * Phase 1B: IndexedDB wrapper for map metadata storage
 */

/**
 * IndexedDB wrapper for managing map storage
 * Stores map metadata (not actual image files - those are referenced by File API)
 */
class MapStorage {
  constructor () {
    this.dbName = 'ImageMapperDB'
    this.version = 1
    this.db = null
    this.storeName = 'maps'
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
        console.log('MapStorage: Creating/upgrading database schema...')
        const db = event.target.result

        // Create maps object store if it doesn't exist
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, {
            keyPath: 'id'
          })

          // Create indexes for efficient querying
          store.createIndex('name', 'name', { unique: false })
          store.createIndex('createdDate', 'createdDate', { unique: false })
          store.createIndex('lastModified', 'lastModified', { unique: false })
          store.createIndex('isActive', 'isActive', { unique: false })

          console.log('MapStorage: Maps object store created with indexes')
        }
      }
    })
  }

  /**
   * Generate a unique ID for new maps
   */
  generateId () {
    return `map_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Add a new map to storage
   * @param {Object} mapData - Map metadata object
   * @returns {Promise<Object>} - The saved map object with generated ID
   */
  async addMap (mapData) {
    if (!this.db) {
      throw new Error('Storage not initialized')
    }

    const map = {
      id: this.generateId(),
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
      // Additional metadata for future features
      markers: [], // Will be used in later phases
      settings: {
        defaultZoom: 1,
        allowMarkers: true,
        ...mapData.settings
      }
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)
      const request = store.add(map)

      request.onsuccess = () => {
        console.log('MapStorage: Map added successfully', map.id)
        resolve(map)
      }

      request.onerror = () => {
        console.error('MapStorage: Failed to add map', request.error)
        reject(new Error(`Failed to save map: ${request.error}`))
      }
    })
  }

  /**
   * Get all maps from storage
   * @returns {Promise<Array>} - Array of all map objects
   */
  async getAllMaps () {
    if (!this.db) {
      throw new Error('Storage not initialized')
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly')
      const store = transaction.objectStore(this.storeName)
      const request = store.getAll()

      request.onsuccess = () => {
        const maps = request.result || []
        console.log(`MapStorage: Retrieved ${maps.length} maps`)
        resolve(maps)
      }

      request.onerror = () => {
        console.error('MapStorage: Failed to get maps', request.error)
        reject(new Error(`Failed to load maps: ${request.error}`))
      }
    })
  }

  /**
   * Get a specific map by ID
   * @param {string} id - Map ID
   * @returns {Promise<Object|null>} - Map object or null if not found
   */
  async getMap (id) {
    if (!this.db) {
      throw new Error('Storage not initialized')
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly')
      const store = transaction.objectStore(this.storeName)
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

    return new Promise(async (resolve, reject) => {
      try {
        // First get the existing map
        const existingMap = await this.getMap(id)
        if (!existingMap) {
          reject(new Error(`Map not found: ${id}`))
          return
        }

        // Merge updates with existing data
        const updatedMap = {
          ...existingMap,
          ...updates,
          id, // Ensure ID cannot be changed
          lastModified: new Date() // Always update modification time
        }

        const transaction = this.db.transaction([this.storeName], 'readwrite')
        const store = transaction.objectStore(this.storeName)
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
    })
  }

  /**
   * Delete a map from storage
   * @param {string} id - Map ID
   * @returns {Promise<boolean>} - Success status
   */
  async deleteMap (id) {
    if (!this.db) {
      throw new Error('Storage not initialized')
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)
      const request = store.delete(id)

      request.onsuccess = () => {
        console.log('MapStorage: Map deleted successfully', id)
        resolve(true)
      }

      request.onerror = () => {
        console.error('MapStorage: Failed to delete map', request.error)
        reject(new Error(`Failed to delete map: ${request.error}`))
      }
    })
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
      // First, deactivate all maps
      const allMaps = await this.getAllMaps()
      const updatePromises = allMaps.map(map => {
        if (map.isActive) {
          return this.updateMap(map.id, { isActive: false })
        }
        return Promise.resolve()
      })

      await Promise.all(updatePromises)

      // Then activate the selected map
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
      // Instead of using index, get all maps and find the active one
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

  /**
   * Get storage statistics
   * @returns {Promise<Object>} - Storage usage statistics
   */
  async getStorageStats () {
    try {
      const maps = await this.getAllMaps()
      const totalMaps = maps.length
      const totalFileSize = maps.reduce((sum, map) => sum + (map.fileSize || 0), 0)
      const activeMap = maps.find(map => map.isActive)

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
          : null
      }
    } catch (error) {
      console.error('MapStorage: Failed to get storage stats', error)
      return {
        totalMaps: 0,
        totalFileSize: 0,
        averageFileSize: 0,
        activeMapId: null,
        oldestMap: null,
        newestMap: null
      }
    }
  }

  /**
   * Clear all maps from storage (with confirmation)
   * @returns {Promise<boolean>} - Success status
   */
  async clearAllMaps () {
    if (!this.db) {
      throw new Error('Storage not initialized')
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)
      const request = store.clear()

      request.onsuccess = () => {
        console.log('MapStorage: All maps cleared successfully')
        resolve(true)
      }

      request.onerror = () => {
        console.error('MapStorage: Failed to clear maps', request.error)
        reject(new Error(`Failed to clear maps: ${request.error}`))
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
   * Check if storage is available and initialized
   * @returns {boolean} - Storage availability status
   */
  isAvailable () {
    return !!this.db && this.db.objectStoreNames.contains(this.storeName)
  }
}

// Export for use in other modules
window.MapStorage = MapStorage
