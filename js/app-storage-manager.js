/**
 * SnapSpot PWA - Storage and Display Manager
 * Handles storage initialization, map loading, display, and switching operations
 */

import { MapRenderer } from './mapRenderer.js'

export const StorageManager = {
  /**
   * Initialize the storage system
   * @param {SnapSpotApp} app - The main app instance
   */
  async initialize (app) {
    app.updateAppStatus('Initializing storage...')

    try {
      await app.storage.init()
      console.log('Storage system initialized successfully')

      // Only show migration overlay if migration is needed
      if (window.localStorage.getItem('snapspot_blob_migration_done') !== 'true') {
        app.showMigrationOverlay()
        await app.storage.migrateBlobDataToBase64()
        app.hideMigrationOverlay()
      }

      return true
    } catch (error) {
      app.hideMigrationOverlay && app.hideMigrationOverlay()
      console.error('Failed to initialize storage:', error)
      throw new Error(`Storage initialization failed: ${error.message}`)
    }
  },

  /**
   * Load maps from storage
   * @param {SnapSpotApp} app - The main app instance
   */
  async loadMaps (app) {
    app.updateAppStatus('Loading maps...')

    try {
      app.mapsList = await app.storage.getAllMaps()
      console.log(`Loaded ${app.mapsList.length} maps`)

      // Check for active map (with safer error handling)
      try {
        const activeMap = await app.storage.getActiveMap()
        if (activeMap) {
          app.currentMap = activeMap
          console.log('Active map loaded:', activeMap.name)

          // Try to display the active map
          // await this.displayMap(activeMap)
        }
      } catch (activeMapError) {
        console.warn('Could not load active map, continuing without:', activeMapError.message)
        app.currentMap = null
      }

      return app.mapsList
    } catch (error) {
      console.error('Failed to load maps:', error)
      app.mapsList = []
      // Don't throw here - let the app continue with empty maps list
      console.warn('Continuing with empty maps list due to storage error')
      return []
    }
  },

  /**
   * Display a map on the canvas
   * @param {SnapSpotApp} app - The main app instance
   * @param {Object} mapData - Map metadata from storage. Now includes imageData.
   */
  async displayMap (app, mapData) {
    console.log('--- displayMap() called for:', mapData.name, '---') // Keep this log
    if (!mapData) {
      console.warn('No map data provided for display')
      return
    }

    try {
      //  Ensure map display elements are visible BEFORE loading image into renderer
      const welcomeScreen = document.getElementById('welcome-screen')
      const mapDisplay = document.getElementById('map-display')
      if (welcomeScreen && mapDisplay) {
        welcomeScreen.classList.add('hidden')
        mapDisplay.classList.remove('hidden')
      }
      console.log('Displaying map:', mapData.name)
      app.updateAppStatus(`Loading map: ${mapData.name}`)

      let imageBlob = app.uploadedFiles.get(mapData.id)
      if (!imageBlob && mapData.imageData) {
        imageBlob = mapData.imageData
        console.log('Displaying map: Loaded image data from storage.')
        app.uploadedFiles.set(mapData.id, imageBlob)
      }

      if (imageBlob && imageBlob instanceof Blob) {
        await app.mapRenderer.loadMap(mapData, imageBlob) // This calls render() ONCE with no markers yet
        console.log('Map loaded from Blob successfully')
      } else {
        await app.mapRenderer.loadPlaceholder(mapData)
        console.log('Map placeholder loaded')
      }

      app.currentMap = mapData

      // Apply the rotation AFTER the map image is loaded into mapRenderer.
      // This call will itself trigger mapRenderer.render().
      if (app.mapRenderer) {
        app.mapRenderer.setMapRotation(app.mapCurrentRotation)
      }

      // Fetch, process, and set markers with max markers limit
      const fetchedMarkers = await app.storage.getMarkersForMap(app.currentMap.id)

      // Apply max markers limit (take the most recent N markers)
      let filteredMarkers = fetchedMarkers
      if (app.maxMarkersToShow > 0 && fetchedMarkers.length > app.maxMarkersToShow) {
        // Since getMarkersForMap returns markers sorted by createdDate (oldest first),
        // we take the last N markers to get the most recent ones
        filteredMarkers = fetchedMarkers.slice(-app.maxMarkersToShow)
        console.log(`App: Showing ${filteredMarkers.length} of ${fetchedMarkers.length} markers (limited by max markers setting)`)
      }

      app.markers = await Promise.all(filteredMarkers.map(async marker => {
        const photoCount = await app.storage.getMarkerPhotoCount(marker.id)
        return {
          ...marker,
          hasPhotos: photoCount > 0
        }
      }))

      app.mapRenderer.setMarkers(app.markers)
      console.log('--- app.js: setMarkers() called with', app.markers.length, 'markers ---')

      // CRITICAL: Call render once more AFTER markers are set, to ensure they are drawn.
      app.mapRenderer.render()

      app.updateAppStatus(`Map displayed: ${mapData.name}`)
    } catch (error) {
      console.error('Failed to display map:', error)
      app.showErrorMessage('Map Display Error', `Failed to display map "${mapData.name}": ${error.message}`)
    }
  },

  /**
   * Switch to a different map
   * @param {SnapSpotApp} app - The main app instance
   * @param {string} mapId - ID of map to switch to
   */
  async switchToMap (app, mapId) {
    try {
      console.log('Switching to map:', mapId)

      const map = app.mapsList.find(m => m.id === mapId)
      if (!map) {
        throw new Error('Map not found')
      }

      // Set as active map
      await app.storage.setActiveMap(mapId)

      // Display the map
      await StorageManager.displayMap(app, map)

      // Update current map reference
      app.currentMap = map

      console.log('Successfully switched to map:', map.name)
    } catch (error) {
      console.error('Failed to switch map:', error)
      app.showErrorMessage('Map Switch Error', error.message)
    }
  },

  /**
   * Check if welcome screen should be shown
   * @param {SnapSpotApp} app - The main app instance
   */
  checkWelcomeScreen (app) {
    const welcomeScreen = document.getElementById('welcome-screen')
    const mapDisplay = document.getElementById('map-display')
    const addFirstMapBtn = document.getElementById('btn-add-first-map')
    console.log('--- checkWelcomeScreen() called --- Maps count:', app.mapsList.length, 'CurrentMap:', app.currentMap ? app.currentMap.id : 'none')

    if (app.mapsList.length === 0 || !app.currentMap) { // Only show if genuinely no maps or no active map
      welcomeScreen?.classList.remove('hidden')
      mapDisplay?.classList.add('hidden')
      app.updateAppStatus('No maps - Upload your first map')

      if (addFirstMapBtn) {
        addFirstMapBtn.innerHTML = '📁 Upload First Map'
      }
    } else {
      // If there are maps AND an active map, the welcome screen should NOT be shown
      // and displayMap() should have been called (which hides welcome and shows map).
      // This 'else' branch of checkWelcomeScreen() should ideally not be reachable
      // if init() logic is correct. But it acts as a safeguard.
      welcomeScreen?.classList.add('hidden')
      mapDisplay?.classList.remove('hidden')
      app.updateAppStatus(`${app.mapsList.length} maps available`)

      if (addFirstMapBtn) {
        addFirstMapBtn.innerHTML = '📁 Upload New Map'
      }
    }
    // Remove the redundant setTimeout blocks related to canvas setup here.
    // displayMap() and setMapRotation() handle the rendering.
  },

  /**
   * Get current map display info
   * @param {SnapSpotApp} app - The main app instance
   */
  getCurrentMapInfo (app) {
    return {
      map: app.currentMap,
      renderer: app.mapRenderer ? app.mapRenderer.getViewState() : null,
      hasFile: app.currentMap ? app.uploadedFiles.has(app.currentMap.id) : false
    }
  },

  /**
   * Delete a map from storage and update UI
   * @param {SnapSpotApp} app - The main app instance
   * @param {string} mapId - The ID of the map to delete
   */
  async deleteMap (app, mapId) {
    if (!mapId) {
      console.error('deleteMap: No mapId provided.')
      app.showErrorMessage('Error', 'No map selected for deletion.')
      return
    }
    try {
      app.showLoading('Deleting map...')
      const wasActiveMap = app.currentMap && app.currentMap.id === mapId
      // const willBeEmpty = app.mapsList.length <= 1 // Check if this is the last map
      if (confirm('Are you sure you want to delete this map? This action cannot be undone.')) { // eslint-disable-line no-undef
        await app.storage.deleteMap(mapId) // Delete from IndexedDB
        app.thumbnailCache.delete(mapId) // Clear from thumbnail cache
        app.uploadedFiles.delete(mapId) // Clear from uploaded files cache
        await StorageManager.loadMaps(app) // Reload all maps from storage to get updated list
        if (app.mapsList.length === 0) {
          // If no maps left, reset currentMap and show welcome screen
          app.currentMap = null
          StorageManager.checkWelcomeScreen(app)
          app.mapRenderer.dispose() // Clean up renderer resources
          app.mapRenderer = new MapRenderer('map-canvas') // Re-initialize for empty state
          app.showNotification('All maps deleted. Ready for new upload.', 'info')
        } else if (wasActiveMap) {
          // If the deleted map was active, activate the first available map
          const firstMap = app.mapsList[0]
          if (firstMap) {
            await app.storage.setActiveMap(firstMap.id)
            await StorageManager.displayMap(app, firstMap)
            app.showNotification(`Active map changed to: ${firstMap.name}`, 'info')
          } else {
            // Fallback if somehow no other map is found (shouldn't happen with mapsList.length > 0)
            app.currentMap = null
            StorageManager.checkWelcomeScreen(app)
            app.mapRenderer.dispose()
            app.mapRenderer = new MapRenderer('map-canvas')
          }
        }
        app.showNotification('Map deleted successfully.', 'success')
        // REMOVE THIS LINE: The decision to re-open the map management modal
        // belongs to the onMapDelete callback, not deleteMap itself.
        // await app.showMapManagementModal() // Re-open modal to update map list
      }
    } catch (error) {
      console.error('Error deleting map:', error)
      app.showErrorMessage('Deletion Failed', `Failed to delete map: ${error.message}`)
    } finally {
      app.hideLoading()
    }
  }
}
