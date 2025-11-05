/**
 * SnapSpot PWA - Main Application
 * Phase 1B: File Management and Storage
 */

/* global
        alert
        Image
        localStorage
        FileReader
        confirm
        */

// --- Module Imports ---
import { MapStorage } from './storage.js'
import { FileManager } from './fileManager.js'
import { MapRenderer } from './mapRenderer.js'
import { ImageProcessor } from './imageProcessor.js'
import { HtmlReportGenerator } from './HtmlReportGenerator.js'
import { MapDataExporterImporter } from './MapDataExporterImporter.js'
import { SearchManager } from './searchManager.js' // NEW import
import { ModalManager } from './ui/modals.js' // Note the path for ModalManager
// --- End Module Imports ---

class SnapSpotApp {
  constructor () {
    this.isOnline = navigator.onLine
    this.serviceWorkerReady = false
    this.storage = new MapStorage()
    this.fileManager = new FileManager()
    this.modalManager = new ModalManager()
    this.searchManager = new SearchManager(this.modalManager, {
      searchMaps: (query) => this.searchMaps(query),
      searchPhotos: (query) => this.searchPhotos(query),
      deleteMap: (mapId) => this.deleteMap(mapId),
      exportHtmlReport: (mapId) => this.exportHtmlReport(mapId),
      exportJsonMap: (mapId) => this.exportJsonMap(mapId),
      onSearchFileSelect: () => this.handleSearchFileSelection(),
      onViewImageInViewer: (id, type) => this.handleViewImageInViewer(id, type),
      onShowPhotoOnMap: (photoData) => this.onShowPhotoOnMap(photoData)
    })

    this.mapRenderer = new MapRenderer('map-canvas')
    this.currentMap = null
    this.mapsList = []
    this.isLoading = false
    this.uploadedFiles = new Map()
    this.thumbnailCache = new Map()
    this.imageProcessor = new ImageProcessor()
    const savedPhotoQuality = parseFloat(localStorage.getItem('defaultPhotoQuality'))
    const initialPhotoQuality = isNaN(savedPhotoQuality) ? 0.5 : savedPhotoQuality

    this.imageCompressionSettings = {
      map: {
        maxWidth: 1920,
        maxHeight: 1920,
        quality: 0.8
      },
      photo: {
        maxWidth: 1000,
        maxHeight: 1000,
        quality: initialPhotoQuality
      },
      thumbnail: {
        maxSize: 100,
        quality: 0.7
      }
    }
    // Marker Size Control
    this.markerDisplaySizeKey = 'normal'
    this.markerSizeCycle = ['normal', 'large', 'extraLarge']
    this.markerSizeLabelMap = {
      normal: 'Normal Markers',
      large: 'Large Markers',
      extraLarge: 'XL Markers'
    }
    // Max Markers Display Setting
    this.maxMarkersToShow = parseInt(localStorage.getItem('maxMarkersToShow')) || 0
    // (for Map Rotation Feature):
    this.mapCurrentRotation = 0
    // Define the cycle for rotation in degrees
    this.rotationCycle = [0, 90, 180, 270]
    // : App Behavior Settings
    this.autoCloseMarkerDetails = localStorage.getItem('autoCloseMarkerDetails') === 'true' || false
    this.allowDuplicatePhotos = localStorage.getItem('allowDuplicatePhotos') === 'true' || false
    this.notificationsEnabled = localStorage.getItem('notificationsEnabled') === 'true' || true

    // New properties for map interaction (Phase 1C)
    this.isDragging = false // Flag to indicate if map is being dragged
    this.lastX = 0 // Last X coordinate of mouse/touch for panning
    this.lastY = 0 // Last Y coordinate of mouse/touch for panning
    this.initialPinchDistance = 0 // Distance between two touches for pinch-zoom
    this.lastScale = 1 // Scale at the start of a pinch gesture
    this.activeTouches = new Map() // Stores active touch points for multi-touch

    this.markers = [] //  Array to hold markers for the current map
    // state properties for marker dragging
    this.isDraggingMarker = false
    this.draggedMarkerId = null
    this.dragStartMapX = 0 // Marker's map X at start of drag
    this.dragStartMapY = 0 // Marker's map Y at start of drag
    this.initialMouseX = 0 // Mouse X at start of drag
    this.initialMouseY = 0 // Mouse Y at start of drag
    // State to track the type of interaction
    this.interactionType = 'none' // 'none', 'map_pan', 'marker_drag', 'pinch_zoom'

    this.showCrosshair = true
    this.markersLocked = true
    // Initialize app when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.init())
    } else {
      this.init()
    }
  }

  /**
   * Initialize the application
   */
  async init () {
    console.log('SnapSpot App: Initializing...')

    try {
      // Set up event listeners
      this.setupEventListeners()

      // Update connection status
      this.updateConnectionStatus()

      // Check service worker status
      await this.checkServiceWorker()

      // Initialize storage system
      await this.initializeStorage()

      // Load existing maps FIRST. This populates this.mapsList AND this.currentMap.
      await this.loadMaps()

      // Restore preference states. These should NOT trigger any re-renders,
      // just load values from localStorage. The actual application of these
      // preferences to the renderer will happen when displayMap is called.
      this.restoreCrosshairState()
      this.restoreMarkerLockState()
      this.restoreMarkerSizeState()
      this.restoreNotificationsState() // NEW: Restore notifications state
      // this.mapCurrentRotation is set here, but NOT applied to mapRenderer yet.
      this.restoreMapRotationState()

      // Now, and ONLY now, decide whether to display a map or the welcome screen.
      if (this.currentMap) {
        console.log('App: Active map detected. Calling displayMap().')
        // displayMap will:
        // 1. load image into mapRenderer (setting originalImageData)
        // 2. call mapRenderer.setMapRotation(this.mapCurrentRotation) (applying rotation)
        // 3. fetch markers
        // 4. call mapRenderer.setMarkers()
        // 5. call mapRenderer.render() (the final render with image and markers)
        await this.displayMap(this.currentMap)

        // Ensure welcome screen is hidden and map display visible
        document.getElementById('welcome-screen')?.classList.add('hidden')
        document.getElementById('map-display')?.classList.remove('hidden')
        this.updateAppStatus(`${this.mapsList.length} maps available`)
      } else {
        console.log('App: No active map. Calling checkWelcomeScreen().')
        // checkWelcomeScreen will correctly show the welcome elements.
        this.checkWelcomeScreen()
      }
      // Initialize app state (this should be the final status update, not intermediate ones)
      this.updateAppStatus('Ready')

      console.log('SnapSpot App: Initialization complete')
    } catch (error) {
      console.error('SnapSpot App: Initialization failed', error)
      this.updateAppStatus('Error: Initialization failed')
      this.showErrorMessage('Failed to initialize app', error.message)
    }
  }

  /**
     * Set up all event listeners
     */
  setupEventListeners () {
    // Connection status monitoring
    window.addEventListener('online', () => this.handleConnectionChange(true))
    window.addEventListener('offline', () => this.handleConnectionChange(false))

    // Button event listeners
    this.setupButtonListeners()

    // Keyboard shortcuts
    this.setupKeyboardShortcuts()

    // Touch and mouse events for future map interaction
    this.setupMapInteractionListeners()
  }

  /**
     * Set up button click listeners
     */
  setupButtonListeners () {
    // Search button
    const searchBtn = document.getElementById('btn-search')
    if (searchBtn) {
      searchBtn.addEventListener('click', () => this.searchManager.openSearchModal())
    }
    // Settings button
    const settingsBtn = document.getElementById('btn-settings')
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => this.showSettings())
    }

    // Add first map button
    const addFirstMapBtn = document.getElementById('btn-add-first-map')
    if (addFirstMapBtn) {
      addFirstMapBtn.addEventListener('click', () => this.showUploadModal()) // <<< Changed to call showUploadModal directly
    }

    // Zoom controls
    const zoomInBtn = document.getElementById('btn-zoom-in')
    const zoomOutBtn = document.getElementById('btn-zoom-out')

    if (zoomInBtn) {
      zoomInBtn.addEventListener('click', () => this.zoomIn())
    }

    if (zoomOutBtn) {
      zoomOutBtn.addEventListener('click', () => this.zoomOut())
    }

    // Place marker button
    const placeMarkerBtn = document.getElementById('btn-place-marker')
    if (placeMarkerBtn) {
      placeMarkerBtn.addEventListener('click', () => this.placeMarker())
    }

    // Toggle Marker Lock button
    const toggleMarkerLockBtn = document.getElementById('btn-toggle-marker-lock')
    if (toggleMarkerLockBtn) {
      toggleMarkerLockBtn.addEventListener('click', () => this.toggleMarkerLockState())
    }
    //  Toggle Map Rotation button
    const toggleMapRotationBtn = document.getElementById('btn-toggle-map-rotation')
    if (toggleMapRotationBtn) {
      toggleMapRotationBtn.addEventListener('click', () => this.toggleMapRotation())
    }
    // Toggle Marker Size button
    const toggleMarkerSizeBtn = document.getElementById('btn-toggle-marker-size')
    if (toggleMarkerSizeBtn) {
      toggleMarkerSizeBtn.addEventListener('click', () => this.toggleMarkerSize())
    }

    // Gallery button
    const galleryBtn = document.getElementById('btn-gallery')
    if (galleryBtn) {
      galleryBtn.addEventListener('click', () => this.showMapPhotoGallery())
    }
  }

  /**
     * Set up keyboard shortcuts
     */
  setupKeyboardShortcuts () {
    document.addEventListener('keydown', (event) => {
      // Only handle shortcuts when not typing in input fields
      if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
        return
      }

      switch (event.key) {
        case '+':
        case '=':
          event.preventDefault()
          this.zoomIn()
          break
        case '-':
          event.preventDefault()
          this.zoomOut()
          break
        case 'Escape':
          event.preventDefault()
          this.closeModals()
          break
      }
    })
  }

  /**
   * Set up map interaction listeners (for future phases)
   */
  setupMapInteractionListeners () {
    const mapContainer = document.getElementById('map-container')
    if (!mapContainer) return

    // Mouse events
    mapContainer.addEventListener('mousedown', (event) => this.handleMapMouseDown(event))
    mapContainer.addEventListener('mousemove', (event) => this.handleMapMouseMove(event))
    mapContainer.addEventListener('mouseup', (event) => this.handleMapMouseUp(event))
    mapContainer.addEventListener('mouseleave', (event) => this.handleMapMouseUp(event)) // Stop dragging if mouse leaves container
    mapContainer.addEventListener('wheel', (event) => this.handleMapWheel(event))

    // Touch events
    mapContainer.addEventListener('touchstart', (event) => this.handleMapTouchStart(event))
    mapContainer.addEventListener('touchmove', (event) => this.handleMapTouchMove(event))
    mapContainer.addEventListener('touchend', (event) => this.handleMapTouchEnd(event))
    mapContainer.addEventListener('touchcancel', (event) => this.handleMapTouchEnd(event)) // Handle touch interruptions

    // Prevent context menu on map
    mapContainer.addEventListener('contextmenu', (event) => event.preventDefault())
  }

  /**
     * Handle connection status changes
     */
  handleConnectionChange (isOnline) {
    this.isOnline = isOnline
    this.updateConnectionStatus()

    if (isOnline) {
      console.log('Connection restored')
      this.updateAppStatus('Online - Ready to sync')
    } else {
      console.log('Connection lost - Working offline')
      this.updateAppStatus('Offline mode')
    }
  }

  /**
     * Update connection status display
     */
  updateConnectionStatus () {
    const statusElement = document.getElementById('connection-status')
    if (statusElement) {
      if (this.isOnline) {
        statusElement.textContent = 'Online'
        statusElement.className = 'connection-status'
      } else {
        statusElement.textContent = 'Offline Ready'
        statusElement.className = 'connection-status offline'
      }
    }
  }

  /**
     * Update app status display
     */
  updateAppStatus (status) {
    const statusElement = document.getElementById('app-status')
    if (statusElement) {
      statusElement.textContent = status
    }
    console.log('App Status:', status)
  }

  /**
 * Check service worker status
 */
  async checkServiceWorker () {
    console.log('🔍 Starting service worker check...')

    if ('serviceWorker' in navigator) {
      try {
        // IMMEDIATE logging of current state
        console.log('✅ Service Worker API available')

        // Check current controller
        if (navigator.serviceWorker.controller) {
          console.log('🔧 Service Worker is currently active')
          console.log('   Script URL:', navigator.serviceWorker.controller.scriptURL)

          // Get current version immediately
          const messageChannel = new MessageChannel()
          messageChannel.port1.onmessage = (event) => {
            console.log('📦 CURRENT SERVICE WORKER VERSION:', event.data.version)
          }

          navigator.serviceWorker.controller.postMessage(
            { type: 'GET_VERSION' },
            [messageChannel.port2]
          )
        } else {
          console.log('❌ No active service worker controller')
        }

        // Get all registrations
        const registrations = await navigator.serviceWorker.getRegistrations()
        console.log('📋 Service Worker registrations found:', registrations.length)
        registrations.forEach((reg, index) => {
          console.log(`   Registration ${index}:`)
          console.log('     Scope:', reg.scope)
          console.log('     Active:', reg.active?.scriptURL || 'None')
          console.log('     Installing:', reg.installing?.scriptURL || 'None')
          console.log('     Waiting:', reg.waiting?.scriptURL || 'None')
        })

        // Wait for service worker to be ready
        const registration = await navigator.serviceWorker.ready
        this.serviceWorkerReady = true
        console.log('✅ Service Worker ready')

        // Listen for service worker messages (for forced updates)
        navigator.serviceWorker.addEventListener('message', (event) => {
          console.log('📨 Message from service worker:', event.data)
          if (event.data && event.data.type === 'SW_UPDATED') {
            console.log('🔄 Service worker updated, reloading...', event.data.version)
            this.updateAppStatus('App updated - reloading...')
            setTimeout(() => {
              window.location.reload()
            }, 1000)
          }
        })

        // Listen for service worker updates
        registration.addEventListener('updatefound', () => {
          console.log('🆕 Service Worker update found!')
          const newWorker = registration.installing
          if (newWorker) {
            console.log('📥 New service worker installing:', newWorker.scriptURL)

            newWorker.addEventListener('statechange', () => {
              console.log('🔄 New service worker state changed to:', newWorker.state)

              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('✅ New service worker installed - updating app')
                this.updateAppStatus('Updating app to new version...')

                // Send skip waiting message
                newWorker.postMessage({ type: 'SKIP_WAITING' })

                // Reload after delay
                setTimeout(() => {
                  console.log('🔄 Reloading page to apply update')
                  window.location.reload()
                }, 1000)
              } else if (newWorker.state === 'activated') {
                console.log('🎉 New service worker activated')
              }
            })
          }
        })

        // Listen for controller changes
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          console.log('🔄 Service Worker controller changed')
          if (!document.hidden) {
            console.log('🔄 Page visible - reloading to apply new service worker')
            window.location.reload()
          } else {
            console.log('👁️ Page hidden - will reload on next visit')
          }
        })

        // Log final status
        console.log('✅ Service worker setup complete')
      } catch (error) {
        console.error('❌ Service Worker setup failed:', error)
        console.warn('Service Worker not available or failed to register', error)
      }
    } else {
      console.log('❌ Service Workers not supported in this browser')
    }
  }

  /**
     * Show loading overlay
     */
  showLoading (message = 'Loading...') {
    const overlay = document.getElementById('loading-overlay')
    const text = document.getElementById('loading-text')

    if (overlay) {
      overlay.classList.remove('hidden')
    }

    if (text) {
      text.textContent = message
    }
  }

  /**
     * Hide loading overlay
     */
  hideLoading () {
    const overlay = document.getElementById('loading-overlay')
    if (overlay) {
      overlay.classList.add('hidden')
    }
  }

  /**
  * Displays the App Settings modal.
  * @param {string} [initialTab='general-settings'] - The ID of the tab to initially open.
  */
  async showSettings (initialTab = 'general-settings') {
    this.showLoading('Loading settings...', false)
    try {
      // Load maps from storage (now returns maps with markerCount)
      this.mapsList = await this.storage.getAllMaps() // No change needed here for app.loadMaps
      // Prepare maps with thumbnails and marker counts for display
      const mapsWithDetails = await this._getPreparedMapsForDisplay(this.mapsList)
      // Separate active map for sorting
      let activeMap = null
      const currentActiveMapId = this.currentMap ? this.currentMap.id : null
      if (currentActiveMapId) {
        const activeMapIndex = mapsWithDetails.findIndex(map => map.id === currentActiveMapId)
        if (activeMapIndex !== -1) {
          activeMap = mapsWithDetails.splice(activeMapIndex, 1)[0]
        }
      }
      // Sort remaining maps by name alphabetically
      mapsWithDetails.sort((a, b) => a.name.localeCompare(b.name))
      // Prepend active map if it exists
      if (activeMap) {
        mapsWithDetails.unshift(activeMap)
      }

      const settingsCallbacks = {
        onClearAllAppData: () => this.clearAllAppData(), // Already implemented for danger zone
        // Maps Management Callbacks:
        onMapSelected: async (mapId) => {
          await this.switchToMap(mapId)
          this.updateAppStatus(`Switched to map: ${this.currentMap.name}`)
          if (this.modalManager.getTopModalId() === 'settings-modal') {
            this.modalManager.closeTopModal()
          }
        },
        onMapDelete: async (mapId) => {
          await this.deleteMap(mapId)
          // showSettings will be called again by onSettingsModalRefresh after deletion
        },
        onAddNewMap: () => {
          this.showUploadModal() // Calls the existing method to show the map upload modal
        },
        onExportHtmlMap: async (mapId) => {
          await this.exportHtmlReport(mapId) // Calls your existing method
        },
        onExportJsonMap: async (mapId) => {
          await this.exportJsonMap(mapId) // Calls your existing method
        },
        onSettingsModalRefresh: (tabToReopen) => {
          // This callback is triggered after an action (like map deletion)
          // that requires re-rendering the maps list within the settings modal.
          // We close the current settings modal and immediately re-open it
          // to the specified tab to show the updated list.
          if (this.modalManager.getTopModalId() === 'settings-modal') {
            this.modalManager.closeTopModal() // Close current instance
          }
          // Re-open settings modal, ensuring the Maps Management tab is active
          this.showSettings(tabToReopen)
        },
        //  Pass the consolidated image viewer callback
        onViewImageInViewer: (id, type) => this.handleViewImageInViewer(id, type), // <-- NEW LINE

        //  Data Management Callbacks
        onImportData: async (file) => {
          await this.handleImportFile(file)
          this.updateAppStatus('Data import complete.', 'success') // Set status as success
          // Trigger a refresh of the settings modal to show the updated map list
          settingsCallbacks.onSettingsModalRefresh('maps-management-settings')
        },
        //  Map Display Callbacks
        isCrosshairEnabled: () => this.isCrosshairEnabled(),
        onToggleCrosshair: (enabled) => {
          this.toggleCrosshair(enabled)
        },
        //  Image Processing Callbacks
        getPhotoQuality: () => this.getPhotoQuality(),
        setPhotoQuality: (qualityPercentage) => {
          this.setPhotoQuality(qualityPercentage)
        },
        //  App Behavior Callbacks
        getAutoCloseMarkerDetails: () => this.getAutoCloseMarkerDetails(),
        setAutoCloseMarkerDetails: (value) => {
          this.setAutoCloseMarkerDetails(value)
        },
        getAllowDuplicatePhotos: () => this.getAllowDuplicatePhotos(),
        setAllowDuplicatePhotos: (value) => {
          this.setAllowDuplicatePhotos(value)
        },
        // Max Markers Display Callbacks
        getMaxMarkersToShow: () => this.getMaxMarkersToShow(),
        setMaxMarkersToShow: (maxMarkers) => {
          this.setMaxMarkersToShow(maxMarkers)
        },
        // General Settings Callbacks
        getNotificationsEnabled: () => this.getNotificationsEnabled(),
        setNotificationsEnabled: (value) => {
          this.setNotificationsEnabled(value)
        }
      }
      // Create and display the settings modal
      this.modalManager.createSettingsModal(
        settingsCallbacks,
        mapsWithDetails, // Pass prepared maps data including markerCount
        currentActiveMapId, // Pass active map ID
        () => { // onClose callback for the settings modal itself
          this.updateAppStatus('Settings closed')
        },
        initialTab // Pass the initial tab to open
      )
      this.updateAppStatus('Settings displayed')
    } catch (error) {
      console.error('App: Error showing settings modal:', error)
      this.showErrorMessage('Failed to open settings', error.message)
    } finally {
      this.hideLoading() // Hide loading indicator regardless of success/failure
    }
  }

  /**
     * Prepares an array of map objects for display in the UI.
     * This includes generating/retrieving thumbnail Data URLs and ensuring marker counts are present.
     * This method centralizes data preparation logic used by both settings modal and search results.
     * @param {Array<Object>} rawMaps - An array of raw map objects (from Storage.getAllMaps(), which now includes markerCount).
     * @returns {Promise<Array<Object>>} An array of map objects prepared for UI display.
     * @private
     */
  async _getPreparedMapsForDisplay (rawMaps) {
    return Promise.all(rawMaps.map(async (map) => {
      let thumbnailDataUrl = this.thumbnailCache.get(map.id)
      // If no thumbnail in cache and map data is a Blob (from storage)
      if (!thumbnailDataUrl && map.imageData instanceof Blob) {
        try {
          // Use a smaller size for thumbnails displayed in lists
          const mapThumbnailSettings = this.imageCompressionSettings.thumbnail
          thumbnailDataUrl = await this.imageProcessor.generateThumbnailDataUrl(map.imageData, mapThumbnailSettings.maxSize)
          if (thumbnailDataUrl) {
            this.thumbnailCache.set(map.id, thumbnailDataUrl)
          }
        } catch (thumbError) {
          console.warn(`App: Failed to generate thumbnail for map ${map.id}:`, thumbError)
          thumbnailDataUrl = null
        }
      } else if (!map.imageData || !(map.imageData instanceof Blob)) {
        // If map.imageData is null/undefined or not a Blob, explicitly set thumbnail to null
        thumbnailDataUrl = null
      }
      // Return map object with the generated/cached thumbnailDataUrl
      return { ...map, thumbnailDataUrl }
    }))
  }

  /**
     * Searches for maps based on a query.
     * Fetches all maps, prepares them for display (including thumbnails),
     * and then filters this prepared list based on the search query.
     * @param {string} query The search term.
     * @returns {Promise<Array<Object>>} An array of filtered map data, including thumbnailDataUrl.
     */
  async searchMaps (query) {
    console.log('App: Performing map search for query:', query)
    const lowerCaseQuery = query.toLowerCase()

    // 1. Get all maps from storage (now includes markerCount from storage.getAllMaps())
    const allMapsWithCounts = await this.storage.getAllMaps()

    // 2. Prepare all maps with thumbnails, using the reusable method
    const allMapsPrepared = await this._getPreparedMapsForDisplay(allMapsWithCounts)

    // 3. Filter this prepared list based on the search query
    const filteredMaps = allMapsPrepared.filter(map =>
      map.name.toLowerCase().includes(lowerCaseQuery) ||
      (map.description && map.description.toLowerCase().includes(lowerCaseQuery)) || // Existing
      (map.fileName && map.fileName.toLowerCase().includes(lowerCaseQuery)) //  Also search by fileName
    )

    console.log(`App: Found ${filteredMaps.length} maps matching query "${query}".`)
    return filteredMaps
  }

  // to handle file selection specifically for search
  async handleSearchFileSelection () {
    try {
      // Replicate the successful pattern: close modal, then delay
      if (this.modalManager.getTopModalId() === 'search-modal') {
        this.modalManager.closeTopModal()
      }
      await new Promise(resolve => setTimeout(resolve, 350)) // Ensure modal is truly gone

      // Now, call fileManager.selectFiles. The file picker will appear.
      const selectedFiles = await this.fileManager.selectFiles(false, true) // (allowMultiple = false, acceptImagesOnly = true)
      this.showLoading('Processing file for search...')

      if (selectedFiles === null || selectedFiles.length === 0) {
        this.showNotification('File selection cancelled.', 'info')
        return
      }

      const selectedFile = selectedFiles[0]

      // Re-open the search modal if it was closed, to show results within it
      // This will also trigger the performSearch logic if initialQuery is set
      this.searchManager.openSearchModal(selectedFile.name)
    } catch (error) {
      console.error('Error selecting file for search:', error)
      this.showErrorMessage('File Selection Error', `Failed to select file for search: ${error.message}`)
      // Re-open the search modal if an error occurred after closing it
      this.searchManager.openSearchModal()
    } finally {
      this.hideLoading() // Always hide loading in the end
    }
  }

  /**
   * Searches for photos by filename (case-insensitive).
   * @param {string} query - The search query.
   * @returns {Promise<Array>} - An array of enriched photo objects matching the query.
   */
  async searchPhotos (query) {
    if (!query) {
      return []
    }
    const searchTerm = query.toLowerCase()
    const allEnrichedPhotos = await this.storage.getAllPhotosWithContext()

    // Generate thumbnails for each photo before returning them
    const preparedPhotos = await Promise.all(allEnrichedPhotos.map(async (photo) => {
      let thumbnailDataUrl = this.thumbnailCache.get(photo.id)
      if (!thumbnailDataUrl && photo.imageData instanceof Blob) {
        try {
          const photoThumbnailSettings = this.imageCompressionSettings.thumbnail
          thumbnailDataUrl = await this.imageProcessor.generateThumbnailDataUrl(photo.imageData, photoThumbnailSettings.maxSize)
          if (thumbnailDataUrl) {
            this.thumbnailCache.set(photo.id, thumbnailDataUrl)
          }
        } catch (thumbError) {
          console.warn(`App: Failed to generate thumbnail for photo ${photo.id}:`, thumbError)
          thumbnailDataUrl = null
        }
      }
      return { ...photo, thumbnailDataUrl }
    }))

    return preparedPhotos.filter(photo =>
      photo.fileName.toLowerCase().includes(searchTerm)
    )
  }

  /**
   * Handles displaying a photo on its respective map, focusing on the associated marker.
   * @param {Object} photoData - The enriched photo object containing mapId, markerId, etc.
   */
  async onShowPhotoOnMap (photoData) {
    if (!photoData || !photoData.mapId || !photoData.markerId) {
      console.error('App: Invalid photoData for onShowPhotoOnMap', photoData)
      return
    }

    this.showLoading(`Showing photo ${photoData.fileName} on map ${photoData.mapName}...`)

    try {
      // 1. Switch to the map where the photo's marker is located
      // This will also trigger mapRenderer to load and render the correct map.
      await this.switchToMap(photoData.mapId)

      // 2. Fetch the marker to get its coordinates
      const marker = await this.storage.getMarker(photoData.markerId)
      if (marker) {
        // Close search modal if it's open, as we're navigating to the map
        this.modalManager.closeTopModal() // This closes the search modal

        // 3. Pan and zoom the map to center on the marker
        // The `panAndZoomToCoordinates` method will be added to MapRenderer.
        const targetZoomFactor = 1.5 // Example: zoom to 1.5 times the current scale, or an absolute scale
        this.mapRenderer.panAndZoomToCoordinates(marker.x, marker.y, targetZoomFactor)

        // 4. Highlight the marker to draw attention to it
        // The `highlightMarker` method will be added to MapRenderer.
        this.mapRenderer.highlightMarker(marker.id)

        this.showNotification(`Focused on marker for photo "${photoData.fileName}"`, 'info')
        console.log(`App: Focused on marker ${marker.id} on map ${photoData.mapId} for photo ${photoData.id}`)
      } else {
        console.warn(`App: Marker ${photoData.markerId} not found for photo ${photoData.id}. Cannot focus on marker.`)
        this.showNotification(`Could not find marker for photo "${photoData.fileName}" on map.`, 'warning')
      }
    } catch (error) {
      console.error(`App: Error showing photo ${photoData.id} on map:`, error)
      this.showErrorMessage('Error Showing Photo on Map', `Failed to show photo on map: ${error.message}`)
    } finally {
      this.hideLoading()
    }
  }

  /**
   * Returns the current photo quality setting (for images attached to markers).
   * @returns {number} Photo quality as a decimal (0.1-1.0).
   */
  getPhotoQuality () {
    return this.imageCompressionSettings.photo.quality
  }

  /**
   * Sets a new photo quality and persists it.
   * @param {number} quality - The new photo quality as a percentage (10-100).
   */
  setPhotoQuality (qualityPercentage) {
    // Convert percentage (10-100) to decimal (0.1-1.0)
    const decimalQuality = qualityPercentage / 100

    // Ensure quality is within valid range (0.1 to 1.0)
    const clampedQuality = Math.max(0.1, Math.min(1.0, decimalQuality))

    this.imageCompressionSettings.photo.quality = clampedQuality
    localStorage.setItem('defaultPhotoQuality', clampedQuality) // Persist the decimal value
    this.showNotification(`Image quality for markers set to ${qualityPercentage}%.`, 'info')
    console.log('Image quality for markers set to:', clampedQuality)
  }

  /**
   * Returns whether the marker details modal should auto-close after adding photos.
   * @returns {boolean}
   */
  getAutoCloseMarkerDetails () {
    return this.autoCloseMarkerDetails
  }

  /**
   * Sets whether the marker details modal should auto-close after adding photos and persists it.
   * @param {boolean} value - true to auto-close, false otherwise.
   */
  setAutoCloseMarkerDetails (value) {
    this.autoCloseMarkerDetails = value
    localStorage.setItem('autoCloseMarkerDetails', value)
    this.showNotification(`Auto-close marker details: ${this.autoCloseMarkerDetails ? 'Enabled' : 'Disabled'}.`, 'info')
    console.log('Auto-close marker details:', this.autoCloseMarkerDetails)
  }

  /**
   * Returns whether adding duplicate photos to markers is allowed.
   * @returns {boolean}
   */
  getAllowDuplicatePhotos () {
    return this.allowDuplicatePhotos
  }

  /**
   * Sets whether adding duplicate photos to markers is allowed and persists it.
   * @param {boolean} value - true to allow, false otherwise.
   */
  setAllowDuplicatePhotos (value) {
    this.allowDuplicatePhotos = value
    localStorage.setItem('allowDuplicatePhotos', value)
    this.showNotification(`Allow duplicate photos: ${this.allowDuplicatePhotos ? 'Enabled' : 'Disabled'}.`, 'info')
    console.log('Allow duplicate photos:', this.allowDuplicatePhotos)
  }

  /**
 * Get the maximum number of markers to display on the map
 * @returns {number} - Maximum markers (0 = unlimited)
 */
  getMaxMarkersToShow () {
    return this.maxMarkersToShow
  }

  /**
   * Set the maximum number of markers to display on the map
   * @param {number} maxMarkers - Maximum markers to show (0 = unlimited)
   */
  setMaxMarkersToShow (maxMarkers) {
    this.maxMarkersToShow = maxMarkers
    localStorage.setItem('maxMarkersToShow', maxMarkers.toString())
    console.log(`App: Max markers to show set to: ${maxMarkers === 0 ? 'unlimited' : maxMarkers}`)

    // If we have a current map loaded, refresh the marker display
    if (this.currentMap) {
      this.refreshMarkersDisplay()
    }
  }

  /**
   * Refresh the markers display with current max markers setting
   */
  async refreshMarkersDisplay () {
    if (!this.currentMap) return

    try {
      // Re-fetch and filter markers based on current setting
      const fetchedMarkers = await this.storage.getMarkersForMap(this.currentMap.id)

      // Apply max markers limit (take the most recent N markers)
      let filteredMarkers = fetchedMarkers
      if (this.maxMarkersToShow > 0 && fetchedMarkers.length > this.maxMarkersToShow) {
        // Since getMarkersForMap already returns markers sorted by createdDate (oldest first),
        // we take the last N markers to get the most recent ones
        filteredMarkers = fetchedMarkers.slice(-this.maxMarkersToShow)
      }

      // Process markers with photo status
      this.markers = await Promise.all(filteredMarkers.map(async marker => {
        const photoCount = await this.storage.getMarkerPhotoCount(marker.id)
        return {
          ...marker,
          hasPhotos: photoCount > 0
        }
      }))

      this.mapRenderer.setMarkers(this.markers)
      this.mapRenderer.render()

      console.log(`App: Displaying ${this.markers.length} of ${fetchedMarkers.length} total markers`)
    } catch (error) {
      console.error('Failed to refresh markers display:', error)
    }
  }

  /**
     * Add first map - Phase 1B implementation
     */
  async addFirstMap () {
    console.log('Add first map clicked')
    this.updateAppStatus('Opening file upload...')

    try {
      await this.showUploadModal()
    } catch (error) {
      console.error('Error opening upload modal:', error)
      this.showErrorMessage('Failed to open upload', error.message)
    }
  }

  /**
     * Show map list - Phase 1B implementation
     */
  async showMapList () {
    console.log('Map list clicked')
    this.updateAppStatus('Loading maps...')

    try {
      // The old logic for directly calling createMapsListModal from here is removed.
      // Instead, we just call the dedicated displayMapsList method.
      await this.displayMapsListInternal() // <--- Call the new internal method
      this.updateAppStatus('Maps list displayed')
    } catch (error) {
      console.error('Error showing map list:', error)
      this.showErrorMessage('Failed to load maps', error.message)
    } finally {
      this.hideLoading() // Ensure loading indicator is hidden
    }
  }

  /**
   * Delete a map from storage and update UI.
   * @param {string} mapId - The ID of the map to delete.
   */
  async deleteMap (mapId) {
    if (!mapId) {
      console.error('deleteMap: No mapId provided.')
      this.showErrorMessage('Error', 'No map selected for deletion.')
      return
    }
    try {
      this.showLoading('Deleting map...')
      const wasActiveMap = this.currentMap && this.currentMap.id === mapId
      // const willBeEmpty = this.mapsList.length <= 1 // Check if this is the last map
      if (confirm('Are you sure you want to delete this map? This action cannot be undone.')) {
        await this.storage.deleteMap(mapId) // Delete from IndexedDB
        this.thumbnailCache.delete(mapId) // Clear from thumbnail cache
        this.uploadedFiles.delete(mapId) // Clear from uploaded files cache
        await this.loadMaps() // Reload all maps from storage to get updated list
        if (this.mapsList.length === 0) {
          // If no maps left, reset currentMap and show welcome screen
          this.currentMap = null
          this.checkWelcomeScreen()
          this.mapRenderer.dispose() // Clean up renderer resources
          this.mapRenderer = new MapRenderer('map-canvas') // Re-initialize for empty state
          this.showNotification('All maps deleted. Ready for new upload.', 'info')
        } else if (wasActiveMap) {
          // If the deleted map was active, activate the first available map
          const firstMap = this.mapsList[0]
          if (firstMap) {
            await this.storage.setActiveMap(firstMap.id)
            await this.displayMap(firstMap)
            this.showNotification(`Active map changed to: ${firstMap.name}`, 'info')
          } else {
            // Fallback if somehow no other map is found (shouldn't happen with mapsList.length > 0)
            this.currentMap = null
            this.checkWelcomeScreen()
            this.mapRenderer.dispose()
            this.mapRenderer = new MapRenderer('map-canvas')
          }
        }
        this.showNotification('Map deleted successfully.', 'success')
        // REMOVE THIS LINE: The decision to re-open the map management modal
        // belongs to the onMapDelete callback, not deleteMap itself.
        // await this.showMapManagementModal() // Re-open modal to update map list
      }
    } catch (error) {
      console.error('Error deleting map:', error)
      this.showErrorMessage('Deletion Failed', `Failed to delete map: ${error.message}`)
    } finally {
      this.hideLoading()
    }
  }

  // Call this method from your settings modal or another appropriate place.
  async clearAllAppData () {
    if (!window.confirm('Are you sure you want to delete ALL maps, markers, and photos from this app? This action cannot be undone.')) {
      this.showNotification('Clear all data cancelled.', 'info')
      return
    }

    this.showLoading('Clearing all app data...')
    try {
      // 1. Clear IndexedDB data
      await this.storage.clearAllMaps()
      console.log('App: IndexedDB data cleared.')

      // 2. Clear localStorage data (preferences)
      localStorage.removeItem('markersLocked')
      localStorage.removeItem('mapRotation')
      localStorage.removeItem('markerDisplaySize')
      localStorage.removeItem('showCrosshair')
      localStorage.removeItem('mapControlsMinimized')
      // Add any other localStorage items here
      console.log('App: localStorage data cleared.')

      // 3. Clear Cache API (Service Worker caches)
      if ('caches' in window) {
        const cacheNames = await window.caches.keys()
        await Promise.all(cacheNames.map(cacheName => window.caches.delete(cacheName)))
        console.log('App: Cache API data cleared.')
      }

      // 4. Optionally, unregister Service Worker (might not be necessary for just clearing data)
      // if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      //   const registration = await navigator.serviceWorker.getRegistration()
      //   if (registration) {
      //     await registration.unregister()
      //     console.log('App: Service Worker unregistered.')
      //   }
      // }

      this.showNotification('All app data has been cleared. The app will now reload.', 'success')
      this.hideLoading()
      // Full page reload to ensure a clean state
      window.location.reload(true) // Pass true to force a reload from the server (bypassing cache)
    } catch (error) {
      console.error('App: Error clearing all app data:', error)
      this.showErrorMessage('Clear Data Failed', `Failed to clear all app data: ${error.message}`)
    } finally {
      this.hideLoading()
    }
  }

  /**
   * Zoom in on map
   */
  zoomIn () {
    if (this.mapRenderer && this.currentMap) {
      // Use the center of the canvas as the zoom center for button clicks
      const centerX = this.mapRenderer.canvas.width / 2
      const centerY = this.mapRenderer.canvas.height / 2
      this.mapRenderer.zoom(1.2, centerX, centerY) // Zoom by 20%
      console.log('Zoomed in')
      this.updateAppStatus('Zoomed in')
    } else {
      console.log('No map loaded for zoom')
      this.updateAppStatus('No map to zoom')
    }
  }

  /**
   * Zoom out on map
   */
  zoomOut () {
    if (this.mapRenderer && this.currentMap) {
      // Use the center of the canvas as the zoom center for button clicks
      const centerX = this.mapRenderer.canvas.width / 2
      const centerY = this.mapRenderer.canvas.height / 2
      this.mapRenderer.zoom(0.8, centerX, centerY) // Zoom out by 20%
      console.log('Zoomed out')
      this.updateAppStatus('Zoomed out')
    } else {
      console.log('No map loaded for zoom')
      this.updateAppStatus('No map to zoom')
    }
  }

  /**
   * Place a new marker at the center of the current map view.
   */
  async placeMarker () {
    if (!this.currentMap || !this.mapRenderer.imageData) {
      console.warn('Cannot place marker: No map loaded or image data unavailable.')
      this.showNotification('Please load a map first before placing a marker.', 'warning')
      return
    }

    // Check if we're in migration mode for reference marker placement
    if (this.isInMigrationModeForExport) {
      // In migration mode, place a reference marker instead of a regular marker
      this.showLoading('Placing reference marker...')
      
      try {
        const centerX = this.mapRenderer.canvas.width / 2
        const centerY = this.mapRenderer.canvas.height / 2
        
        // Call the mapRenderer method to place a reference marker at the center
        await this.mapRenderer.placeMigrationReferenceMarkerAtScreenCoords(centerX, centerY)
        
        this.showNotification('Reference marker placed successfully!', 'success')
        this.updateAppStatus('Reference marker added')
      } catch (error) {
        console.error('Failed to place reference marker:', error)
        this.showErrorMessage('Error Placing Reference Marker', error.message)
      } finally {
        this.hideLoading()
      }
    } else {
      // Regular marker placement
      this.showLoading('Placing marker...')

      try {
        const centerX = this.mapRenderer.canvas.width / 2
        const centerY = this.mapRenderer.canvas.height / 2

        // Convert canvas center coordinates to map (image) coordinates
        const mapCoords = this.mapRenderer.screenToMap(centerX, centerY)

        if (!mapCoords) {
          throw new Error('Failed to convert screen coordinates to map coordinates.')
        }

        const newMarker = {
          mapId: this.currentMap.id,
          x: mapCoords.x,
          y: mapCoords.y,
          description: `Marker at ${mapCoords.x.toFixed(0)}, ${mapCoords.y.toFixed(0)}` // Default description
        }

        const savedMarker = await this.storage.addMarker(newMarker)
        this.markers.push(savedMarker) // Add to local array
        this.mapRenderer.setMarkers(this.markers) // Update mapRenderer
        this.mapRenderer.render() // Re-render to show the new marker

        this.showNotification('Marker placed successfully!', 'success')
        this.updateAppStatus('Marker added')
        console.log('Placed new marker:', savedMarker)
      } catch (error) {
        console.error('Failed to place marker:', error)
        this.showErrorMessage('Error Placing Marker', error.message)
      } finally {
        this.hideLoading()
      }
    }
  }

  /**
   *  Toggles the marker lock state.
   */
  toggleMarkerLockState () {
    this.markersLocked = !this.markersLocked
    if (this.mapRenderer) {
      this.mapRenderer.setMarkersEditable(!this.markersLocked) // MapRenderer takes 'editable' state
    }
    localStorage.setItem('markersLocked', this.markersLocked)
    this.updateMarkerLockButtonUI()
    this.showNotification(`Markers are now ${this.markersLocked ? 'locked' : 'unlocked'} for editing.`, 'info')
    console.log('Markers lock state toggled. Locked:', this.markersLocked)
  }

  /**
   *  Restores the saved state of marker locking from localStorage.
   */
  restoreMarkerLockState () {
    const savedState = localStorage.getItem('markersLocked')
    if (savedState !== null) {
      this.markersLocked = (savedState === 'true') // localStorage stores strings
    } else {
      // Default state if nothing found in localStorage (initially locked)
      this.markersLocked = true
    }

    if (this.mapRenderer) {
      this.mapRenderer.setMarkersEditable(!this.markersLocked)
    }
    this.updateMarkerLockButtonUI() // Update button text/icon on load
    console.log('Restored markers lock state:', this.markersLocked)
  }

  /**
   *  Updates the text and icon of the marker lock button based on current state.
   */
  updateMarkerLockButtonUI () {
    const toggleMarkerLockBtn = document.getElementById('btn-toggle-marker-lock')
    if (toggleMarkerLockBtn) {
      // const btnTextSpan = toggleMarkerLockBtn.querySelector('.btn-text')
      if (this.markersLocked) {
        toggleMarkerLockBtn.title = 'Unlock markers position'
        toggleMarkerLockBtn.innerHTML = '🔒 <span class="btn-text">Markers Locked</span>'
        toggleMarkerLockBtn.classList.remove('active') // Optional: remove an 'active' class if you style unlocked state
      } else {
        toggleMarkerLockBtn.title = 'Lock markers position'
        toggleMarkerLockBtn.innerHTML = '🔓 <span class="btn-text">Markers Unlocked</span>'
        toggleMarkerLockBtn.classList.add('active') // Optional: add an 'active' class for unlocked state
      }
    }
  }

  /**
   *  Toggles the map's rotation.
   */
  toggleMapRotation () {
    // Find current index in the rotation cycle
    const currentIndex = this.rotationCycle.indexOf(this.mapCurrentRotation)
    // Calculate next index, wrapping around to 0
    const nextIndex = (currentIndex + 1) % this.rotationCycle.length
    this.mapCurrentRotation = this.rotationCycle[nextIndex]

    if (this.mapRenderer) {
      this.mapRenderer.setMapRotation(this.mapCurrentRotation) // FIX IS HERE
    }
    localStorage.setItem('mapRotation', this.mapCurrentRotation)
    this.updateMapRotationButtonUI()
    this.showNotification(`Map rotation set to ${this.mapCurrentRotation} degrees.`, 'info')
    console.log('Map rotation toggled. Current rotation:', this.mapCurrentRotation)
  }

  /**
   *  Restores the saved map rotation from localStorage.
   */
  restoreMapRotationState () {
    const savedRotation = localStorage.getItem('mapRotation')
    // Ensure savedRotation is a number and is one of our valid cycle values
    const rotationAsNumber = parseInt(savedRotation, 10)
    if (!isNaN(rotationAsNumber) && this.rotationCycle.includes(rotationAsNumber)) {
      this.mapCurrentRotation = rotationAsNumber
    } else {
      this.mapCurrentRotation = 0 // Default to 0 degrees if invalid or not found
    }

    if (this.mapRenderer) {
      this.mapRenderer.setMapRotation(this.mapCurrentRotation) // FIX IS HERE
    }
    this.updateMapRotationButtonUI() // Update button text/icon on load
    console.log('Restored map rotation state:', this.mapCurrentRotation)
  }

  /**
   *  Updates the text and icon of the map rotation button based on current state.
   */
  updateMapRotationButtonUI () {
    const toggleMapRotationBtn = document.getElementById('btn-toggle-map-rotation')
    if (toggleMapRotationBtn) {
      toggleMapRotationBtn.title = `Map rotation: ${this.mapCurrentRotation}°`
      toggleMapRotationBtn.innerHTML = `🔄 <span class="btn-text">Rotation ${this.mapCurrentRotation}°</span>`
    }
  }

  /**
   * Toggles the display size of markers.
   */
  toggleMarkerSize () {
    const currentIndex = this.markerSizeCycle.indexOf(this.markerDisplaySizeKey)
    const nextIndex = (currentIndex + 1) % this.markerSizeCycle.length
    this.markerDisplaySizeKey = this.markerSizeCycle[nextIndex]

    if (this.mapRenderer) {
      this.mapRenderer.setMarkerDisplaySize(this.markerDisplaySizeKey)
    }
    localStorage.setItem('markerDisplaySize', this.markerDisplaySizeKey)
    this.updateMarkerSizeButtonUI()
    this.showNotification(`Marker size set to ${this.markerDisplaySizeKey}.`, 'info')
    console.log('Marker size toggled. Current size:', this.markerDisplaySizeKey)
  }

  /**
   *  Restores the saved marker display size from localStorage.
   */
  restoreMarkerSizeState () {
    const savedSize = localStorage.getItem('markerDisplaySize')
    if (savedSize && this.markerSizeCycle.includes(savedSize)) {
      this.markerDisplaySizeKey = savedSize
    } else {
      this.markerDisplaySizeKey = 'normal' // Default if invalid or not found
    }

    if (this.mapRenderer) {
      this.mapRenderer.setMarkerDisplaySize(this.markerDisplaySizeKey)
    }
    this.updateMarkerSizeButtonUI() // Update button text/icon on load
    console.log('Restored marker size state:', this.markerDisplaySizeKey)
  }

  /**
   *  Updates the text and icon of the marker size button based on current state.
   */
  updateMarkerSizeButtonUI () {
    const toggleMarkerSizeBtn = document.getElementById('btn-toggle-marker-size')
    if (toggleMarkerSizeBtn) {
      const label = this.markerSizeLabelMap[this.markerDisplaySizeKey] || 'Size'
      toggleMarkerSizeBtn.title = `Current Marker Size: ${this.markerDisplaySizeKey}`
      toggleMarkerSizeBtn.innerHTML = `📏 <span class="btn-text">${label}</span>`
    }
  }

  /**
   * Toggles the visibility of the crosshair on the map.
   * If 'forceState' is provided, sets it to that state instead of toggling.
   * @param {boolean} [forceState] - Optional. If provided, sets crosshair visibility to this state.
   */
  toggleCrosshair (forceState) { // JavaScript Standard Style: no semicolons
    const newState = typeof forceState === 'boolean' ? forceState : !this.showCrosshair

    this.showCrosshair = newState
    if (this.mapRenderer) {
      this.mapRenderer.toggleCrosshair(this.showCrosshair) // Pass the explicit state
    }
    localStorage.setItem('showCrosshair', this.showCrosshair)
    this.showNotification(`Crosshair ${this.showCrosshair ? 'enabled' : 'disabled'}.`, 'info')
    console.log('Crosshair toggled. State:', this.showCrosshair)
  }

  /**
   * Returns the current state of the crosshair visibility.
   * This is a getter needed for the settings UI to display the correct initial state.
   * @returns {boolean}
   */
  isCrosshairEnabled () {
    return this.showCrosshair
  }

  /**
   *  Restores the saved state of the crosshair from localStorage.
   */
  restoreCrosshairState () {
    const savedState = localStorage.getItem('showCrosshair')
    if (savedState !== null) {
      this.showCrosshair = (savedState === 'true') // localStorage stores strings
    } else {
      // Default state if nothing found in localStorage (initially true)
      this.showCrosshair = true // Assuming default state is true as configured in constructor
      localStorage.setItem('showCrosshair', this.showCrosshair) // Save default to localStorage
    }

    if (this.mapRenderer) {
      this.mapRenderer.toggleCrosshair(this.showCrosshair)
    }
    console.log('Restored crosshair state:', this.showCrosshair)
  }

  /**
   * Restores the saved state of notifications from localStorage.
   */
  restoreNotificationsState () {
    const savedState = localStorage.getItem('notificationsEnabled')
    if (savedState !== null) {
      this.notificationsEnabled = (savedState === 'true')
    } else {
      // Default state if nothing found in localStorage (initially true)
      this.notificationsEnabled = true
      localStorage.setItem('notificationsEnabled', this.notificationsEnabled)
    }
    console.log('Restored notifications state:', this.notificationsEnabled)
  }

  /**
   * Close any open modals
   */
  closeModals () {
    console.log('Closing modals')
    this.modalManager.closeAllModals()
  }

  // ========================================
  // Map Interaction Handlers Phase 1C - Updated for Marker Dragging
  // ========================================

  /**
   * Helper to detect if a click/touch event is on a marker.
   * Returns the marker object if found, otherwise null.
   * MODIFIED: To support dynamic marker sizes.
   * @param {number} clientX - The clientX coordinate of the event.
   * @param {number} clientY - The clientY coordinate of the event.
   * @returns {Object|null} The marker object if hit, otherwise null.
   */
  getMarkerAtPoint (clientX, clientY) {
    if (!this.mapRenderer || !this.markers || this.markers.length === 0) {
      console.log('getMarkerAtPoint: No renderer, markers, or empty markers array')
      return null
    }

    console.log(`getMarkerAtPoint: Checking ${this.markers.length} markers at client coordinates (${clientX}, ${clientY}) - In migration mode: ${this.isInMigrationModeForExport}`)

    const canvasRect = this.mapRenderer.canvas.getBoundingClientRect()
    const screenX = clientX - canvasRect.left
    const screenY = clientY - canvasRect.top

    // MODIFIED: Get the current marker radius from mapRenderer
    const currentMarkerSize = this.mapRenderer.getCurrentMarkerDisplaySize()
    // Define a hit area radius around the marker (e.g., marker radius + some padding)
    const hitRadius = currentMarkerSize.radius + 5 // Use current radius plus 5px padding

    console.log(`  Screen coordinates: (${screenX}, ${screenY}), hitRadius: ${hitRadius}`)

    for (let i = this.markers.length - 1; i >= 0; i--) { // Iterate backwards to hit top-most marker first
      const marker = this.markers[i]
      const markerScreenCoords = this.mapRenderer.mapToScreen(marker.x, marker.y)

      if (markerScreenCoords) {
        const dx = screenX - markerScreenCoords.x
        const dy = screenY - markerScreenCoords.y
        const distance = Math.sqrt(dx * dx + dy * dy)

        console.log(`  Marker ${marker.id}: map pos (${marker.x}, ${marker.y}), screen pos (${markerScreenCoords.x}, ${markerScreenCoords.y}), distance: ${distance}, hitRadius: ${hitRadius}`)

        if (distance <= hitRadius) {
          console.log(`  Hit detected for marker ${marker.id}`)
          return marker
        }
      }
    }
    
    console.log('  No marker hit detected')
    return null
  }

  /**
   * Handle mouse down event on the map container for panning OR marker dragging.
   */
  handleMapMouseDown (event) {
    if (!this.currentMap || event.button !== 0) return // Only left click and if map is loaded

    console.log(`handleMapMouseDown: In migration mode: ${this.isInMigrationModeForExport}, markersLocked: ${this.markersLocked}`)

    this.initialDownX = event.clientX
    this.initialDownY = event.clientY

    const clickedMarker = this.getMarkerAtPoint(event.clientX, event.clientY)

    console.log(`handleMapMouseDown: clickedMarker=${!!clickedMarker}, markersLocked=${this.markersLocked}`)

    // MODIFIED: Only allow marker dragging if markers are NOT locked
    if (clickedMarker && !this.markersLocked) {
      this.interactionType = 'marker_drag'
      this.isDraggingMarker = true
      this.draggedMarkerId = clickedMarker.id
      this.dragStartMapX = clickedMarker.x
      this.dragStartMapY = clickedMarker.y
      console.log('Interaction start: Marker drag detected for:', clickedMarker.id)
    } else {
      this.interactionType = 'map_pan'
      this.isDragging = true
      this.lastX = event.clientX
      this.lastY = event.clientY
      console.log('Interaction start: Map pan detected.')
    }

    // Prevent text selection during drag
    const mapContainer = document.getElementById('map-container')
    if (mapContainer) {
      mapContainer.style.cursor = 'grabbing'
      mapContainer.style.userSelect = 'none'
    }
  }

  /**
   * Handle mouse move event on the map container for panning OR marker dragging.
   */
  async handleMapMouseMove (event) {
    event.preventDefault() // Prevent default behavior like text selection if mouse is down

    if (this.interactionType === 'marker_drag' && this.draggedMarkerId) {
      const deltaX = event.clientX - this.initialDownX
      const deltaY = event.clientY - this.initialDownY

      //  Use screenVectorToMapVector to get the deltas in map's original coordinate system
      const { mapDeltaX, mapDeltaY } = this.mapRenderer.screenVectorToMapVector(deltaX, deltaY)

      const currentMarkerMapX = this.dragStartMapX + mapDeltaX
      const currentMarkerMapY = this.dragStartMapY + mapDeltaY

      const markerIndex = this.markers.findIndex(m => m.id === this.draggedMarkerId)
      if (markerIndex !== -1) {
        this.markers[markerIndex].x = currentMarkerMapX
        this.markers[markerIndex].y = currentMarkerMapY
        this.mapRenderer.setMarkers(this.markers)
        this.mapRenderer.render()
      }
    } else if (this.interactionType === 'map_pan') {
      const deltaX = event.clientX - this.lastX
      const deltaY = event.clientY - this.lastY
      this.mapRenderer.pan(deltaX, deltaY)
      this.lastX = event.clientX
      this.lastY = event.clientY
    }
  }

  /**
   * Handle mouse up event on the map container to finalize interaction.
   */
  async handleMapMouseUp (event) {
    const mapContainer = document.getElementById('map-container')
    if (mapContainer) {
      mapContainer.style.cursor = 'grab'
      mapContainer.style.userSelect = 'auto'
    }

    const mouseUpX = event.clientX
    const mouseUpY = event.clientY

    const CLICK_THRESHOLD = 5 // Pixels
    const distanceMoved = Math.sqrt(
      Math.pow(mouseUpX - this.initialDownX, 2) +
      Math.pow(mouseUpY - this.initialDownY, 2)
    )

    if (this.interactionType === 'marker_drag' && this.draggedMarkerId) {
      // Interaction started as a marker drag
      const markerToSave = this.markers.find(m => m.id === this.draggedMarkerId)
      if (markerToSave) {
        if (distanceMoved < CLICK_THRESHOLD) {
          // It was a short drag, treat as a click to open details
          console.log('Marker clicked (via short drag):', markerToSave.id)
          // During migration mode, don't show details for reference markers
          if (!this.isInMigrationModeForExport) {
            this.showMarkerDetails(markerToSave.id)
          }
        } else {
          // It was an actual drag, save its new position
          try {
            await this.updateMarkerPosition(markerToSave, markerToSave.x, markerToSave.y)
            this.showNotification('Marker moved and saved.', 'success')
          } catch (error) {
            console.error('Failed to save dragged marker position:', error)
            this.showErrorMessage('Save Error', 'Failed to save marker position.')
          }
        }
      }
    } else if (this.interactionType === 'map_pan') {
      // Interaction started as a map pan
      if (distanceMoved < CLICK_THRESHOLD) {
        // It was a very short pan, potentially a click on empty space or a marker
        const clickedMarker = this.getMarkerAtPoint(mouseUpX, mouseUpY)
        if (clickedMarker) {
          console.log('Marker clicked (via short map pan interaction):', clickedMarker.id)
          // During migration mode, don't show details for reference markers
          if (!this.isInMigrationModeForExport) {
            this.showMarkerDetails(clickedMarker.id)
          }
        } else {
          console.log('Map or empty space clicked (via short map pan interaction).')
        }
      } else {
        console.log('Map pan ended.')
      }
    }
    // No 'else' here. If interactionType was 'none' or 'pinch_zoom' and it's mouseup,
    // we don't treat it as a click/drag, as those interactions are handled by specific branches
    // or simply reset below. 'pinch_zoom' is solely a touch event.

    // Reset interaction state
    this.interactionType = 'none'
    this.isDragging = false
    this.isDraggingMarker = false
    this.draggedMarkerId = null
    this.initialPinchDistance = 0
    this.lastScale = 1
    console.log('Interaction state reset.')
  }

  /**
   * Handle mouse wheel event for zooming.
   */
  handleMapWheel (event) {
    if (!this.currentMap) return

    event.preventDefault()

    const mapRect = this.mapRenderer.canvas.getBoundingClientRect()
    const mouseX = event.clientX - mapRect.left
    const mouseY = event.clientY - mapRect.top

    let zoomFactor = 1.1
    if (event.deltaY > 0) {
      zoomFactor = 1 / zoomFactor
    }

    this.mapRenderer.zoom(zoomFactor, mouseX, mouseY)
    console.log('Map wheel - zoomed')
  }

  /**
   * Handle touch start event for panning AND marker dragging.
   */
  handleMapTouchStart (event) {
    if (!this.currentMap) return

    event.preventDefault()

    this.initialDownX = event.touches[0] ? event.touches[0].clientX : 0
    this.initialDownY = event.touches[0] ? event.touches[0].clientY : 0

    // Store all active touches
    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i]
      this.activeTouches.set(touch.identifier, {
        x: touch.clientX,
        y: touch.clientY,
        initialX: touch.clientX, // Keep initial position for distance calculation for each touch
        initialY: touch.clientY
      })
    }

    if (this.activeTouches.size === 1) { // Single touch for panning or marker dragging
      console.log(`handleMapTouchStart: In migration mode: ${this.isInMigrationModeForExport}, markersLocked: ${this.markersLocked}`)
      
      const touch = event.changedTouches[0]
      const touchedMarker = this.getMarkerAtPoint(touch.clientX, touch.clientY)

      console.log(`handleMapTouchStart: touchedMarker=${!!touchedMarker}, markersLocked=${this.markersLocked}`)

      // MODIFIED: Only allow marker dragging if markers are NOT locked
      if (touchedMarker && !this.markersLocked) {
        this.interactionType = 'marker_drag'
        this.isDraggingMarker = true
        this.draggedMarkerId = touchedMarker.id
        this.dragStartMapX = touchedMarker.x
        this.dragStartMapY = touchedMarker.y
        console.log('Interaction start: Touch marker drag detected for:', touchedMarker.id)
      } else {
        this.interactionType = 'map_pan'
        this.isDragging = true
        this.lastX = touch.clientX
        this.lastY = touch.clientY
        console.log('Interaction start: Touch map pan detected.')
      }
    } else if (this.activeTouches.size === 2) { // Two touches for pinch-zoom
      this.interactionType = 'pinch_zoom'
      const touches = Array.from(this.activeTouches.values())
      const dist = this.getDistance(touches[0], touches[1])
      this.initialPinchDistance = dist
      this.lastScale = this.mapRenderer.scale
      console.log('Interaction start: Pinch zoom detected.')
    }
  }

  /**
   * Handle touch move event forPanning OR marker dragging OR pinch-zoom.
   */
  async handleMapTouchMove (event) {
    if (!this.currentMap) return

    event.preventDefault()

    // Update active touches' current positions
    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i]
      if (this.activeTouches.has(touch.identifier)) {
        const storedTouch = this.activeTouches.get(touch.identifier)
        storedTouch.x = touch.clientX
        storedTouch.y = touch.clientY
      }
    }

    // --- Dynamic interaction type adjustment for multi-touch (e.g., pan to pinch-zoom) ---
    if (this.activeTouches.size === 2 && this.interactionType !== 'pinch_zoom') {
      // If a second touch just came in while we were panning or dragging a marker
      this.interactionType = 'pinch_zoom'
      const touches = Array.from(this.activeTouches.values())
      this.initialPinchDistance = this.getDistance(touches[0], touches[1])
      this.lastScale = this.mapRenderer.scale
      this.isDragging = false // Stop map panning
      this.isDraggingMarker = false // Stop marker dragging
      console.log('Interaction type changed to: Pinch zoom.')
      return // Skip further processing until next move event
    }

    if (this.interactionType === 'pinch_zoom' && this.activeTouches.size === 2) {
      const touches = Array.from(this.activeTouches.values())
      const currentDistance = this.getDistance(touches[0], touches[1])

      if (this.initialPinchDistance === 0) { // Safety check; should be set in touchStart or above
        this.initialPinchDistance = currentDistance
        this.lastScale = this.mapRenderer.scale
        return
      }

      const scaleFactor = currentDistance / this.initialPinchDistance
      const newScale = this.lastScale * scaleFactor

      const centerX = (touches[0].x + touches[1].x) / 2
      const centerY = (touches[0].y + touches[1].y) / 2

      this.mapRenderer.zoom(null, centerX, centerY, newScale)
      console.log('Touch move - pinch-zoom')
    } else if (this.interactionType === 'marker_drag' && this.draggedMarkerId && this.activeTouches.size === 1) {
      const touch = Array.from(this.activeTouches.values())[0]

      const deltaX = touch.x - this.initialDownX
      const deltaY = touch.y - this.initialDownY

      //  Use screenVectorToMapVector for touch events as well
      const { mapDeltaX, mapDeltaY } = this.mapRenderer.screenVectorToMapVector(deltaX, deltaY)

      const currentMarkerMapX = this.dragStartMapX + mapDeltaX
      const currentMarkerMapY = this.dragStartMapY + mapDeltaY

      const markerIndex = this.markers.findIndex(m => m.id === this.draggedMarkerId)
      if (markerIndex !== -1) {
        this.markers[markerIndex].x = currentMarkerMapX
        this.markers[markerIndex].y = currentMarkerMapY
        this.mapRenderer.setMarkers(this.markers)
        this.mapRenderer.render()
      }
      console.log('Touch move - marker dragging')
    } else if (this.interactionType === 'map_pan' && this.activeTouches.size === 1) {
      const touch = Array.from(this.activeTouches.values())[0]

      const deltaX = touch.x - this.lastX
      const deltaY = touch.y - this.lastY
      this.mapRenderer.pan(deltaX, deltaY)
      this.lastX = touch.x
      this.lastY = touch.y
      console.log('Touch move - map panning')
    }
  }

  /**
   * Handle touch end event to finalize interaction.
   */
  async handleMapTouchEnd (event) {
    if (!this.currentMap) return

    const currentInteractionType = this.interactionType
    const currentDraggedMarkerId = this.draggedMarkerId

    // Get the touch that ended for potential tap detection
    const endedTouch = event.changedTouches[0]
    const touchEndX = endedTouch ? endedTouch.clientX : 0
    const touchEndY = endedTouch ? endedTouch.clientY : 0

    const CLICK_THRESHOLD = 10 // Pixels for touch

    // Calculate distance moved from initial touch start for the *specific* touch that ended
    let distanceMoved = Infinity
    if (endedTouch) {
      const initialTouchDataForEndedTouch = Array.from(this.activeTouches.values()).find(t => t.identifier === endedTouch.identifier) || { initialX: this.initialDownX, initialY: this.initialDownY }
      distanceMoved = Math.sqrt(
        Math.pow(endedTouch.clientX - initialTouchDataForEndedTouch.initialX, 2) +
        Math.pow(endedTouch.clientY - initialTouchDataForEndedTouch.initialY, 2)
      )
    }

    // Remove ended touches from activeTouches map
    for (let i = 0; i < event.changedTouches.length; i++) {
      this.activeTouches.delete(event.changedTouches[i].identifier)
    }

    if (currentInteractionType === 'marker_drag' && currentDraggedMarkerId) {
      // Interaction started as a marker drag
      const markerToSave = this.markers.find(m => m.id === currentDraggedMarkerId)
      if (markerToSave) {
        if (distanceMoved < CLICK_THRESHOLD) {
          // It was a short drag, treat as a tap to open details
          console.log('Marker tapped (via short touch drag):', markerToSave.id)
          // During migration mode, don't show details for reference markers
          if (!this.isInMigrationModeForExport) {
            this.showMarkerDetails(markerToSave.id)
          }
        } else {
          // It was an actual drag, save its new position
          try {
            await this.updateMarkerPosition(markerToSave, markerToSave.x, markerToSave.y)
            this.showNotification('Marker moved and saved.', 'success')
          } catch (error) {
            console.error('Failed to save dragged marker position:', error)
            this.showErrorMessage('Save Error', 'Failed to save marker position.')
          }
        }
      }
    } else if (currentInteractionType === 'map_pan') {
      // Interaction started as a map pan
      if (distanceMoved < CLICK_THRESHOLD) {
        // It was a very short pan, potentially a click on empty map space
        const clickedMarker = this.getMarkerAtPoint(touchEndX, touchEndY)
        if (clickedMarker) {
          console.log('Marker tapped (via short map pan interaction):', clickedMarker.id)
          // During migration mode, don't show details for reference markers
          if (!this.isInMigrationModeForExport) {
            this.showMarkerDetails(clickedMarker.id)
          }
        } else {
          console.log('Map or empty space tapped (via short map pan interaction).')
        }
      } else {
        console.log('Map pan ended.')
      }
    } // No 'else' here. Pure taps (interactionType 'none') and pinch_zoom are handled by specific flow.

    // Reset interaction state if all touches are gone or only one remains after pinch
    if (this.activeTouches.size === 0) {
      this.interactionType = 'none'
      this.isDragging = false // Reset these intermediate flags
      this.isDraggingMarker = false
      this.draggedMarkerId = null
      this.initialPinchDistance = 0
      this.lastScale = 1
      console.log('Interaction state reset.')
    } else if (this.activeTouches.size === 1 && currentInteractionType === 'pinch_zoom') {
      // If we were pinch-zooming and one finger lifted, the remaining one can start a pan
      this.interactionType = 'map_pan'
      this.isDragging = true
      this.isDraggingMarker = false // Ensure marker dragging is off
      const remainingTouch = Array.from(this.activeTouches.values())[0]
      this.lastX = remainingTouch.x
      this.lastY = remainingTouch.y
      // Reset pinch specific flags
      this.initialPinchDistance = 0
      this.lastScale = 1
      console.log('Switched from pinch_zoom to map_pan with remaining touch.')
    } else {
      // For any other multi-touch scenario where touches remain (e.g., 2 remaining after 3 began, or 2 remaining because one lifted from pinch_zoom)
      // The state remains as determined by the active touches. We simply clean up the now-lifted touch.
      // This path shouldn't lead to opening the modal again.
      this.isDragging = false
      this.isDraggingMarker = false
      this.draggedMarkerId = null
      this.initialPinchDistance = 0 // If some touches lifted, existing pinch might be invalid
      this.lastScale = 1
      console.log('Multi-touch interaction ongoing or unexpected state after a touch ended.')
    }
  }

  /**
   * Helper function to calculate distance between two touch points.
   */
  getDistance (touch1, touch2) {
    const dx = touch1.x - touch2.x
    const dy = touch1.y - touch2.y
    return Math.sqrt(dx * dx + dy * dy)
  }

  // ========================================
  // Utility Methods
  // ========================================

  /**
   * Returns whether notifications are enabled.
   * @returns {boolean}
   */
  getNotificationsEnabled () {
    return this.notificationsEnabled
  }

  /**
   * Sets whether notifications are enabled and persists it.
   * @param {boolean} value - true to enable notifications, false otherwise.
   */
  setNotificationsEnabled (value) {
    this.notificationsEnabled = value
    localStorage.setItem('notificationsEnabled', value)
    this.showNotification(`Notifications: ${this.notificationsEnabled ? 'Enabled' : 'Disabled'}.`, 'info')
    console.log('Notifications enabled:', this.notificationsEnabled)
  }

  /**
   * Show a proper toast notification to the user.
   * @param {string} message - The message to display.
   * @param {'info'|'success'|'warning'|'error'} [type='info'] - The type of notification.
   * @param {number} [duration=3000] - Duration in milliseconds before it starts to fade out.
   */
  showNotification (message, type = 'info', duration = 3000) {
    // Only show notification if enabled
    if (!this.notificationsEnabled) {
      console.log(`Notification suppressed (disabled): ${message}`)
      return
    }

    console.log(`${type.toUpperCase()} Notification: ${message}`)
    this.updateAppStatus(message) // Keep updating app status for console/debug

    const notificationContainer = document.getElementById('notification-container')
    if (!notificationContainer) {
      console.warn('Notification container not found. Skipping toast notification.')
      return
    }

    const toast = document.createElement('div')
    toast.classList.add('notification-toast', type)

    // Add an icon based on type (you can use whatever icon system you prefer, e.g., emojis or Font Awesome)
    let icon = ''
    switch (type) {
      case 'success': icon = '✅'; break
      case 'warning': icon = '⚠️'; break
      case 'error': icon = '❌'; break
      case 'info':
      default: icon = 'ℹ️'; break
    }

    toast.innerHTML = `<span class="icon">${icon}</span> <span class="message">${message}</span>`

    // Append to container
    notificationContainer.appendChild(toast)

    // Set a timeout to remove the toast after its animation completes (duration + fadeOut animation time)
    // The CSS animation has 0.3s fadeSlideIn, 2.5s delay, 0.5s fadeOut = 3.3s total animation
    // So, duration + animation delay + fadeout time
    const totalDisplayTime = duration + 500 // 500ms for fadeOut animation
    setTimeout(() => {
      // It's possible the user closed it manually or it was removed by another action, so check if it still exists
      if (toast.parentNode) {
        toast.remove()
      }
    }, totalDisplayTime)
  }

  /**
     * Check if the app is running as a PWA
     */
  isPWA () {
    return window.matchMedia && window.matchMedia('(display-mode: standalone)').matches
  }

  /**
     * Get app version info
     */
  getVersionInfo () {
    return {
      phase: '1B',
      version: '0.3.0',
      features: ['PWA Foundation', 'Offline Ready', 'Service Worker', 'IndexedDB Storage', 'File Upload System', 'Map Management'],
      upcomingFeatures: ['Map Display', 'Pan/Zoom Controls', 'Marker System']
    }
  }

  // ========================================
  // Phase 1B: Storage System Methods
  // ========================================

  /**
   * Initialize the storage system
   */
  async initializeStorage () {
    this.updateAppStatus('Initializing storage...')

    try {
      await this.storage.init()
      console.log('Storage system initialized successfully')
      return true
    } catch (error) {
      console.error('Failed to initialize storage:', error)
      throw new Error(`Storage initialization failed: ${error.message}`)
    }
  }

  /**
   * Load maps from storage
   */
  async loadMaps () {
    this.updateAppStatus('Loading maps...')

    try {
      this.mapsList = await this.storage.getAllMaps()
      console.log(`Loaded ${this.mapsList.length} maps`)

      // Check for active map (with safer error handling)
      try {
        const activeMap = await this.storage.getActiveMap()
        if (activeMap) {
          this.currentMap = activeMap
          console.log('Active map loaded:', activeMap.name)

          // Try to display the active map
          // await this.displayMap(activeMap)
        }
      } catch (activeMapError) {
        console.warn('Could not load active map, continuing without:', activeMapError.message)
        this.currentMap = null
      }

      return this.mapsList
    } catch (error) {
      console.error('Failed to load maps:', error)
      this.mapsList = []
      // Don't throw here - let the app continue with empty maps list
      console.warn('Continuing with empty maps list due to storage error')
      return []
    }
  }

  /**
   * Check if welcome screen should be shown
   */
  checkWelcomeScreen () {
    const welcomeScreen = document.getElementById('welcome-screen')
    const mapDisplay = document.getElementById('map-display')
    const addFirstMapBtn = document.getElementById('btn-add-first-map')
    console.log('--- checkWelcomeScreen() called --- Maps count:', this.mapsList.length, 'CurrentMap:', this.currentMap ? this.currentMap.id : 'none')

    if (this.mapsList.length === 0 || !this.currentMap) { // Only show if genuinely no maps or no active map
      welcomeScreen?.classList.remove('hidden')
      mapDisplay?.classList.add('hidden')
      this.updateAppStatus('No maps - Upload your first map')

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
      this.updateAppStatus(`${this.mapsList.length} maps available`)

      if (addFirstMapBtn) {
        addFirstMapBtn.innerHTML = '📁 Upload New Map'
      }
    }
    // Remove the redundant setTimeout blocks related to canvas setup here.
    // displayMap() and setMapRotation() handle the rendering.
  }

  /**
   * Test storage system with mock data (temporary for Phase 1B)
   */
  async testStorageSystem () {
    this.showLoading('Testing storage system...')

    try {
      // Create a test map
      const testMap = {
        name: 'Test Map ' + new Date().toLocaleTimeString(),
        description: 'A test map to verify storage functionality',
        fileName: 'test-map.jpg',
        filePath: '/mock/path/test-map.jpg',
        width: 1920,
        height: 1080,
        fileSize: 245760, // 240KB
        fileType: 'image/jpeg',
        isActive: this.mapsList.length === 0 // Make first map active
      }

      const savedMap = await this.storage.addMap(testMap)
      console.log('Test map saved:', savedMap)

      // Reload maps list
      await this.loadMaps()

      // Update UI
      this.checkWelcomeScreen()

      this.showNotification(`Test map "${savedMap.name}" added successfully!`, 'success')
      this.updateAppStatus('Storage test completed')
    } catch (error) {
      console.error('Storage test failed:', error)
      throw error
    } finally {
      this.hideLoading()
    }
  }

  /**
   * Format file size for display
   */
  formatFileSize (bytes) {
    if (bytes === 0) return '0 Bytes'

    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  /**
   * Show error message to user
   */
  showErrorMessage (title, message) {
    console.error(title + ':', message)
    alert(title + '\n\n' + message)
    this.updateAppStatus('Error: ' + title)
  }

  // ========================================
  // Phase 1B: File Upload System
  // ========================================

  /**
   * Show upload modal for selecting and processing map files
   */
  async showUploadModal () {
    console.log('Opening upload modal...')

    const modal = this.modalManager.createUploadModal(
      // onUpload callback
      async (mapData, file) => {
        await this.handleMapUpload(mapData, file)
      },
      // onCancel callback
      () => {
        console.log('Upload cancelled')
        this.updateAppStatus('Upload cancelled')
      }
    )

    this.updateAppStatus('Select a map image to upload')
    return modal
  }

  /**
   * Handle map upload from the modal
   * @param {Object} mapData - Processed map metadata from FileManager (currently processed basic file info)
   * @param {File} originalFile - Original file object (important, this will be the Blob from ImageProcessor now)
   */
  async handleMapUpload (mapData, originalFile) { // Renamed 'file' to 'originalFile' for clarity
    console.log('Handling map upload:', mapData.name)

    try {
      this.updateAppStatus('Processing and saving map image...')

      // --- NEW STEP: Process the image for storage ---
      const processedImageBlob = await this.imageProcessor.processImage(originalFile, {
        maxWidth: this.imageCompressionSettings.map.maxWidth, // Max width for storing
        maxHeight: this.imageCompressionSettings.map.maxHeight, // Max height for storing
        quality: this.imageCompressionSettings.map.quality, // JPEG quality
        // You can consider 'image/webp' here if you want, but check browser compatibility for Canvas toBlob
        outputFormat: originalFile.type.startsWith('image/') ? originalFile.type : 'image/jpeg'
      })

      console.log('Original size:', originalFile.size, 'Processed size:', processedImageBlob.size)

      // We need to update mapData with the *new* dimensions and size of the processed image
      // To get the new dimensions easily, we can load the blob back into an image temporarily
      const processedImg = await new Promise((resolve, reject) => {
        const url = URL.createObjectURL(processedImageBlob)
        const img = new Image()
        img.onload = () => {
          URL.revokeObjectURL(url)
          resolve(img)
        }
        img.onerror = reject
        img.src = url
      })

      // Update mapData with the processed image details
      mapData.width = processedImg.width
      mapData.height = processedImg.height
      mapData.fileSize = processedImageBlob.size
      mapData.fileType = processedImageBlob.type
      // -----------------------------------------------

      // If this is set as active, deactivate other maps first
      if (mapData.isActive && this.mapsList.length > 0) {
        console.log('Setting as active map, deactivating others...')
      }

      // Save to storage (now including the processedImageBlob)
      const storageData = {
        name: mapData.name,
        description: mapData.description,
        fileName: mapData.fileName,
        filePath: mapData.filePath, // Consider if filePath is still relevant now it's a blob
        width: mapData.width, // Updated with processed dimensions
        height: mapData.height, // Updated with processed dimensions
        fileSize: mapData.fileSize, // Updated with processed size
        fileType: mapData.fileType, // Updated with processed type
        isActive: mapData.isActive,
        imageHash: mapData.imageHash, // Include imageHash for duplicate detection
        settings: mapData.settings,
        imageData: processedImageBlob // --- Store the actual BLOB data ---
      }

      const savedMap = await this.storage.addMap(storageData)
      console.log('Map saved successfully:', savedMap.id)

      // Store the *ORIGINAL* file reference (or the processed blob) for immediate rendering
      // We will now store the processed blob for immediate rendering too
      this.uploadedFiles.set(savedMap.id, processedImageBlob) // Changed from originalFile to processedImageBlob

      // Set as active if requested
      if (mapData.isActive) {
        await this.storage.setActiveMap(savedMap.id)
      }

      // Reload maps list
      await this.loadMaps()

      // Update UI
      this.checkWelcomeScreen()

      // Load and display the map if it's active
      if (mapData.isActive) {
        await this.displayMap(savedMap) // savedMap now contains imageData
      }

      // Show success message
      this.showNotification(`Map "${savedMap.name}" uploaded successfully!`, 'success')
      this.updateAppStatus(`Map uploaded: ${savedMap.name}`)

      console.log('Map upload completed successfully')
    } catch (error) {
      console.error('Map upload failed:', error)
      this.showErrorMessage('Map Upload Error', `Failed to save map: ${error.message}`)
      throw new Error(`Failed to save map: ${error.message}`)
    } finally {
      this.hideLoading() // Ensure loading indicator is hidden after processing
    }
  }

  /**
   * Add a test mode button for development
   */
  async addTestMap () {
    console.log('Adding test map (development mode)')

    try {
      await this.testStorageSystem()
    } catch (error) {
      console.error('Error adding test map:', error)
      this.showErrorMessage('Failed to add test map', error.message)
    }
  }

  /**
   * Display a map on the canvas
   * @param {Object} mapData - Map metadata from storage. Now includes imageData.
   * MODIFIED: To correctly determine and pass `hasPhotos` status to markers using getMarkerPhotoCount.
   * ALSO MODIFIED: To apply map rotation initially.
   */
  async displayMap (mapData) {
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
      this.updateAppStatus(`Loading map: ${mapData.name}`)

      let imageBlob = this.uploadedFiles.get(mapData.id)
      if (!imageBlob && mapData.imageData) {
        imageBlob = mapData.imageData
        console.log('Displaying map: Loaded image data from storage.')
        this.uploadedFiles.set(mapData.id, imageBlob)
      }

      if (imageBlob && imageBlob instanceof Blob) {
        await this.mapRenderer.loadMap(mapData, imageBlob) // This calls render() ONCE with no markers yet
        console.log('Map loaded from Blob successfully')
      } else {
        await this.mapRenderer.loadPlaceholder(mapData)
        console.log('Map placeholder loaded')
      }

      this.currentMap = mapData

      // Apply the rotation AFTER the map image is loaded into mapRenderer.
      // This call will itself trigger mapRenderer.render().
      if (this.mapRenderer) {
        this.mapRenderer.setMapRotation(this.mapCurrentRotation)
      }

      // Fetch, process, and set markers with max markers limit
      const fetchedMarkers = await this.storage.getMarkersForMap(this.currentMap.id)

      // Apply max markers limit (take the most recent N markers)
      let filteredMarkers = fetchedMarkers
      if (this.maxMarkersToShow > 0 && fetchedMarkers.length > this.maxMarkersToShow) {
        // Since getMarkersForMap returns markers sorted by createdDate (oldest first),
        // we take the last N markers to get the most recent ones
        filteredMarkers = fetchedMarkers.slice(-this.maxMarkersToShow)
        console.log(`App: Showing ${filteredMarkers.length} of ${fetchedMarkers.length} markers (limited by max markers setting)`)
      }

      this.markers = await Promise.all(filteredMarkers.map(async marker => {
        const photoCount = await this.storage.getMarkerPhotoCount(marker.id)
        return {
          ...marker,
          hasPhotos: photoCount > 0
        }
      }))

      this.mapRenderer.setMarkers(this.markers)
      console.log('--- app.js: setMarkers() called with', this.markers.length, 'markers ---')

      // CRITICAL: Call render once more AFTER markers are set, to ensure they are drawn.
      this.mapRenderer.render()

      this.updateAppStatus(`Map displayed: ${mapData.name}`)
    } catch (error) {
      console.error('Failed to display map:', error)
      this.showErrorMessage('Map Display Error', `Failed to display map "${mapData.name}": ${error.message}`)
    }
  }

  /**
   * Switch to a different map
   * @param {string} mapId - ID of map to switch to
   */
  async switchToMap (mapId) {
    try {
      console.log('Switching to map:', mapId)

      const map = this.mapsList.find(m => m.id === mapId)
      if (!map) {
        throw new Error('Map not found')
      }

      // Set as active map
      await this.storage.setActiveMap(mapId)

      // Display the map
      await this.displayMap(map)

      // Update current map reference
      this.currentMap = map

      console.log('Successfully switched to map:', map.name)
    } catch (error) {
      console.error('Failed to switch map:', error)
      this.showErrorMessage('Map Switch Error', error.message)
    }
  }

  /**
   * Get current map display info
   */
  getCurrentMapInfo () {
    return {
      map: this.currentMap,
      renderer: this.mapRenderer ? this.mapRenderer.getViewState() : null,
      hasFile: this.currentMap ? this.uploadedFiles.has(this.currentMap.id) : false
    }
  }

  /**
   * Reset map view to fit screen
   */
  resetMapView () {
    if (this.mapRenderer) {
      this.mapRenderer.resetView()
      this.updateAppStatus('Map view reset')
    }
  }

  /**
   * Displays the marker details modal for a given marker.
   * @param {string} markerId - The ID of the marker to display.
   */
  async showMarkerDetails (markerId) {
    this.showLoading('Loading marker details...')
    try {
      const marker = await this.storage.getMarker(markerId) // Using markerId directly. Assuming activeMap.id is not needed here based on provided code.
      if (!marker) {
        throw new Error('Marker not found.') // Throw error to be caught below
      }

      const allPhotosForMarker = await this.storage.getPhotosForMarker(marker.id)
      const validPhotos = allPhotosForMarker.filter(photo => (marker.photoIds || []).includes(photo.id))

      const displayX = marker.x.toFixed(0)
      const displayY = marker.y.toFixed(0)

      this.modalManager.createMarkerDetailsModal(
        {
          id: marker.id,
          description: marker.description,
          coords: `X: ${displayX}, Y: ${displayY}`,
          photoCount: validPhotos.length,
          photos: validPhotos // Pass photo data to the modal
        },
        // Callbacks for modal actions
        // onAddPhotos callback
        async () => {
          console.log('Add photos button clicked for marker', marker.id)
          if (this.modalManager.getTopModalId() === 'marker-details-modal') {
            this.modalManager.closeTopModal()
          }
          await new Promise(resolve => setTimeout(resolve, 350)) // Wait for modal to fully close

          const photosWereAdded = await this.setupAddPhotosForMarker(marker.id)
          console.log('App: onAddPhotos photosWereAdded:', photosWereAdded)

          if (photosWereAdded && this.getAutoCloseMarkerDetails()) {
            this.showNotification('Marker details modal automatically closed after adding photos.', 'info')
          } else {
            await this.showMarkerDetails(marker.id)
          }
        },
        // onEditMarker callback (REVISED: This now directly triggers edit mode in modal)
        async (markerIdToEdit) => {
          console.log(`Edit marker button clicked for ${markerIdToEdit}. Toggling edit mode.`)
          // No need to close/re-open modal here, edit happens in-place
        },
        // onSaveDescription callback (NEW)
        async (markerIdToSave, newDescription) => {
          this.showLoading('Saving description...')
          try {
            await this.storage.updateMarker(markerIdToSave, {
              description: newDescription,
              lastModified: new Date()
            })
            const localMarker = this.markers.find(m => m.id === markerIdToSave)
            if (localMarker) {
              localMarker.description = newDescription
            }
            this.modalManager.updateMarkerDetailsDescription(markerIdToSave, newDescription)
            this.showNotification('Description updated.', 'success')
            console.log(`Marker ${markerIdToSave} description saved.`)
          } catch (error) {
            console.error('Failed to save description:', error)
            this.showErrorMessage('Save Error', `Failed to save description: ${error.message}`)
          } finally {
            this.hideLoading()
          }
        },
        // onDeleteMarker callback
        async (markerIdToDelete) => {
          console.log(`Delete marker ${markerIdToDelete} clicked`)
          this.modalManager.closeTopModal()
          await this.deleteMarker(markerIdToDelete)
        },
        // onDeletePhoto callback
        async (markerIdFromModal, photoIdFromModal) => { // <--- These arguments are provided by the modal
          this.modalManager.closeTopModal()
          await this.deletePhotoFromMarker(markerIdFromModal, photoIdFromModal)
          await this.showMarkerDetails(markerIdFromModal) // Correctly calling itself by original name
        },
        // onViewPhoto callback - This now opens the photo gallery in single photo mode
        async (photoIdFromModal) => { // <--- This argument is provided by the modal
          // Get all photos for the current marker
          const markerPhotos = await this.storage.getPhotosForMarker(markerId)

          // Get all markers for the current map to enrich photo data with marker descriptions
          const allMarkersForMap = await this.storage.getMarkersForMap(this.currentMap.id)
          const markerMap = new Map(allMarkersForMap.map(marker => [marker.id, marker]))

          // Enrich photos with associated marker descriptions and ensure thumbnailDataUrl is available
          const enrichedPhotos = await Promise.all(markerPhotos.map(async photo => {
            const associatedMarker = markerMap.get(photo.markerId)

            let thumbnailDataUrl = photo.thumbnailDataUrl
            // If thumbnailDataUrl is not set but thumbnailData exists, convert it
            if (!thumbnailDataUrl && photo.thumbnailData) {
              thumbnailDataUrl = photo.thumbnailData
            } else if (!thumbnailDataUrl && !photo.thumbnailData && photo.imageData) {
              try {
                thumbnailDataUrl = await this.imageProcessor.generateThumbnailDataUrl(
                  photo.imageData,
                  this.imageCompressionSettings.thumbnail.maxSize
                )
              } catch (error) {
                console.warn(`Failed to generate thumbnail for photo ${photo.id}:`, error)
              }
            }

            return {
              ...photo,
              thumbnailDataUrl: thumbnailDataUrl || null,
              markerDescription: associatedMarker ? associatedMarker.description : 'No marker description'
            }
          }))

          // Close the marker details modal
          this.modalManager.closeTopModal()

          // Show the photo gallery modal starting with the specific photo in single view
          this.modalManager.createPhotoGalleryModal(
            enrichedPhotos,
            {
              title: `Marker Gallery: ${marker.description || 'Untitled Marker'}`,
              showOnMapOption: false,
              initialPhotoId: photoIdFromModal
            },
            null, // onShowOnMap is not available for marker details
            // onDeletePhoto callback for the gallery
            async (photoIdToDelete) => {
              // Delete the photo from storage
              await this.storage.deletePhoto(photoIdToDelete)
              console.log(`Photo ${photoIdToDelete} deleted from storage.`)

              // Update the UI to reflect the deletion
              if (this.currentMap) {
                // Update local markers array if needed
                const localMarker = this.markers.find(m => m.id === marker.id)
                if (localMarker) {
                  localMarker.photoIds = localMarker.photoIds.filter(id => id !== photoIdToDelete)
                  localMarker.hasPhotos = (localMarker.photoIds.length > 0)
                  this.mapRenderer.setMarkers(this.markers)
                  this.mapRenderer.render()
                }
              }

              this.showNotification('Photo deleted successfully.', 'success')

              // Close and reopen the gallery to refresh the display
              this.modalManager.closeTopModal()
              await new Promise(resolve => setTimeout(resolve, 350)) // Wait for modal to close
              await this.showMarkerDetails(marker.id) // Show parent marker details again
            },
            // onClose callback
            async () => {
              console.log('Marker photo gallery closed.')
              // Reopen marker details after gallery closes
              await this.showMarkerDetails(marker.id)
            }
          )
        },
        // onClose callback
        () => {
          console.log('Marker details modal closed.')
          this.updateAppStatus('Ready')
        }
      )
      this.updateAppStatus(`Viewing marker: ${marker.id}`)
    } catch (error) {
      console.error('Failed to show marker details:', error)
      this.showErrorMessage('Marker Error', `Failed to open marker details: ${error.message}`) // This catches the "Marker not found" error, or others.
    } finally {
      this.hideLoading()
    }
  }

  /**
   * Deletes a marker (and its associated photos) from storage and UI.
   * @param {string} markerId - The ID of the marker to delete.
   */
  async deleteMarker (markerId) {
    this.showLoading('Deleting marker...')
    try {
      // 1. Delete from IndexedDB (this also handles associated photos via storage.js)
      await this.storage.deleteMarker(markerId)
      console.log(`Marker ${markerId} and its photos deleted from storage.`)

      // 2. Remove from local markers array and update mapRenderer
      this.markers = this.markers.filter(m => m.id !== markerId)
      this.mapRenderer.setMarkers(this.markers)
      this.mapRenderer.render() // Re-render map to remove the marker visually

      this.showNotification('Marker deleted successfully.', 'success')
      this.updateAppStatus('Marker deleted.')

      // If the currently viewed map has no markers left, update status or provide a hint
      if (this.currentMap && this.markers.length === 0) {
        this.updateAppStatus('No markers on this map.')
      }
    } catch (error) {
      console.error('Failed to delete marker:', error)
      this.showErrorMessage('Delete Marker Error', `Failed to delete marker: ${error.message}`)
    } finally {
      this.hideLoading()
    }
  }

  /**
   * Sets up the process for adding photos to a specific marker.
   * MODIFIED: To ensure marker's `hasPhotos` status is updated and re-rendered.
   * @param {string} markerId - The ID of the marker to add photos to.
   */
  async setupAddPhotosForMarker (markerId) {
    this.showLoading('Adding photos...')
    let photosAdded = false
    try {
      const selectedFiles = await this.fileManager.selectFiles(true, true)
      if (!selectedFiles || selectedFiles.length === 0) {
        this.showNotification('Photo selection cancelled.', 'info')
        return false // Indicate no photos were added
      }

      const photoIdsToAdd = []
      // Fetch all photos currently on the active map once before the loop
      // MODIFIED: Use this.currentMap.id to get photos for the active map
      const allPhotosOnMap = await this.storage.getPhotosForMap(this.currentMap.id)

      for (const file of selectedFiles) {
        this.updateAppStatus(`Processing photo: ${file.name}...`)
        const isDuplicateAllowedSetting = this.getAllowDuplicatePhotos()

        if (!isDuplicateAllowedSetting) { // Only do check IF setting says NO duplicates
          const isDuplicateFound = allPhotosOnMap.some(p => p.fileName === file.name)
          // If a duplicate is found ANYWHERE on the map, skip this file
          if (isDuplicateFound) {
            this.showNotification(`Skipping duplicate photo: ${file.name} (already exists on this map)`, 'warning')
            continue // Skip this file
          }
        }
        const processOptions = {
          maxWidth: this.imageCompressionSettings.photo.maxWidth,
          maxHeight: this.imageCompressionSettings.photo.maxHeight,
          quality: this.imageCompressionSettings.photo.quality,
          outputFormat: 'image/jpeg'
        }
        const processedImageBlob = await this.imageProcessor.processImage(file, processOptions)
        const thumbnailDataUrl = await this.imageProcessor.generateThumbnailDataUrl(processedImageBlob, this.imageCompressionSettings.thumbnail.maxSize, 'image/jpeg', this.imageCompressionSettings.thumbnail.quality)
        const photoData = {
          markerId,
          imageData: processedImageBlob,
          thumbnailData: thumbnailDataUrl,
          fileName: file.name,
          fileType: 'image/jpeg',
          fileSize: processedImageBlob.size
        }
        const savedPhoto = await this.storage.addPhoto(photoData)
        photoIdsToAdd.push(savedPhoto.id)
      }
      // Update the marker with the new photo IDs
      if (photoIdsToAdd.length > 0) {
        const marker = await this.storage.getMarker(markerId)
        if (marker) {
          // Ensure photoIds array is initialized and add new unique IDs
          const updatedPhotoIds = [...new Set([...(marker.photoIds || []), ...photoIdsToAdd])]
          await this.storage.updateMarker(markerId, { photoIds: updatedPhotoIds, lastModified: new Date() })
          this.showNotification(`${photoIdsToAdd.length} photo(s) added to marker.`, 'success')
          //  Update local markers array and re-render map for visual change
          const localMarker = this.markers.find(m => m.id === markerId)
          if (localMarker) {
            localMarker.photoIds = updatedPhotoIds // Update local photoIds
            localMarker.hasPhotos = (updatedPhotoIds.length > 0) // Update local hasPhotos status (will be true)
          }
          this.mapRenderer.setMarkers(this.markers) // Pass updated local array
          this.mapRenderer.render() // Re-render to reflect new color if needed
          photosAdded = true // <--- Set flag to true if photos were successfully added
        }
      }
    } catch (error) {
      console.error('Failed to add photos to marker:', error)
      this.showErrorMessage('Photo Error', `Failed to add photos: ${error.message}`)
    } finally {
      this.hideLoading()
    }
    return photosAdded // <--- Return the flag
  }

  /**
   * Deletes a photo from a marker and from storage.
   * MODIFIED: To ensure marker's `hasPhotos` status is updated and re-rendered.
   * @param {string} markerId - The ID of the marker the photo is associated with.
   * @param {string} photoId - The ID of the photo to delete.
   */
  async deletePhotoFromMarker (markerId, photoId) {
    console.log('app.js: deletePhotoFromMarker received markerId:', markerId, 'photoIdToDelete:', photoId) // <--- ADD THIS LOG
    this.showLoading('Removing photo...')
    try {
      // 1. Get the marker and remove the photoId from its photoIds array
      const marker = await this.storage.getMarker(markerId)
      if (marker) {
        const updatedPhotoIds = marker.photoIds.filter(id => id !== photoId)
        await this.storage.updateMarker(markerId, { photoIds: updatedPhotoIds, lastModified: new Date() })
        console.log(`Removed photoId ${photoId} from marker ${markerId}`)

        //  Update local markers array and re-render map for visual change
        const localMarker = this.markers.find(m => m.id === markerId)
        if (localMarker) {
          localMarker.photoIds = updatedPhotoIds // Update local photoIds
          localMarker.hasPhotos = (updatedPhotoIds.length > 0) // Update local hasPhotos status
        }
        this.mapRenderer.setMarkers(this.markers) // Pass updated local array
        this.mapRenderer.render() // Re-render to reflect new color if needed
      } else {
        console.warn(`Marker ${markerId} not found when trying to delete photo ${photoId} reference.`)
      }

      // 2. Delete the photo itself from the photos store
      await this.storage.deletePhoto(photoId)
      console.log(`Photo ${photoId} deleted from storage.`)

      this.showNotification('Photo removed successfully.', 'success')
      // Implicitly, the refresh of the marker details modal will show the update
    } catch (error) {
      console.error('Failed to delete photo from marker:', error)
      this.showErrorMessage('Delete Photo Error', `Failed to remove photo: ${error.message}`)
    } finally {
      this.hideLoading()
    }
  }

  /**
   * Displays a photo gallery for all photos on the current map.
   */
  async showMapPhotoGallery () {
    if (!this.currentMap) {
      this.showNotification('Please load a map first before viewing the gallery.', 'warning')
      return
    }

    this.showLoading('Loading photo gallery...')
    try {
      // Get all photos for the current map
      const allPhotosForMap = await this.storage.getPhotosForMap(this.currentMap.id)

      // Get all markers for the current map to enrich photo data with marker descriptions
      const allMarkersForMap = await this.storage.getMarkersForMap(this.currentMap.id)
      const markerMap = new Map(allMarkersForMap.map(marker => [marker.id, marker]))

      // Enrich photos with associated marker descriptions and ensure thumbnailDataUrl is available
      const enrichedPhotos = await Promise.all(allPhotosForMap.map(async photo => {
        const associatedMarker = markerMap.get(photo.markerId)

        let thumbnailDataUrl = photo.thumbnailDataUrl
        // If thumbnailDataUrl is not set but thumbnailData exists, convert it
        if (!thumbnailDataUrl && photo.thumbnailData) {
          thumbnailDataUrl = photo.thumbnailData // thumbnailData should already be a data URL
        // If neither exists but we have imageData, try to generate a thumbnail
        } else if (!thumbnailDataUrl && !photo.thumbnailData && photo.imageData) {
          try {
            thumbnailDataUrl = await this.imageProcessor.generateThumbnailDataUrl(
              photo.imageData,
              this.imageCompressionSettings.thumbnail.maxSize
            )
          } catch (error) {
            console.warn(`Failed to generate thumbnail for photo ${photo.id}:`, error)
          }
        }

        return {
          ...photo,
          mapId: this.currentMap.id, // Add mapId for onShowPhotoOnMap function
          mapName: this.currentMap.name, // Add mapName for display
          thumbnailDataUrl: thumbnailDataUrl || null,
          markerDescription: associatedMarker ? associatedMarker.description : 'No marker description'
        }
      }))

      // Show the gallery modal
      this.modalManager.createPhotoGalleryModal(
        enrichedPhotos,
        {
          title: `Map Gallery: ${this.currentMap.name}`,
          showOnMapOption: true
        },
        // onShowOnMap callback
        async (photoId) => {
          // Find the photo in the enriched array
          const photo = enrichedPhotos.find(p => p.id === photoId)
          if (!photo) {
            this.showNotification('Photo not found.', 'warning')
            return
          }

          // Close gallery modal
          this.modalManager.closeTopModal()

          // Switch to the map where the photo's marker is located (current map in this case)
          // and focus on the marker
          await this.onShowPhotoOnMap(photo)
        },
        // onDeletePhoto callback
        async (photoId) => {
          // Find the photo to get its markerId
          const photo = enrichedPhotos.find(p => p.id === photoId)
          if (!photo) {
            this.showNotification('Photo not found.', 'warning')
            return
          }

          // Delete the photo from storage
          await this.storage.deletePhoto(photoId)
          console.log(`Photo ${photoId} deleted from storage.`)

          // Update the UI to reflect the deletion
          if (this.currentMap) {
            // Update local markers array if needed
            const localMarker = this.markers.find(m => m.id === photo.markerId)
            if (localMarker) {
              localMarker.photoIds = localMarker.photoIds.filter(id => id !== photoId)
              localMarker.hasPhotos = (localMarker.photoIds.length > 0)
              this.mapRenderer.setMarkers(this.markers)
              this.mapRenderer.render()
            }
          }

          this.showNotification('Photo deleted successfully.', 'success')

          // Close and reopen the gallery to refresh the display
          this.modalManager.closeTopModal()
          await new Promise(resolve => setTimeout(resolve, 350)) // Wait for modal to close
          await this.showMapPhotoGallery()
        },
        // onClose callback
        () => {
          console.log('Map photo gallery closed.')
          this.updateAppStatus('Ready')
        }
      )
      this.updateAppStatus(`Viewing photo gallery for map: ${this.currentMap.name}`)
    } catch (error) {
      console.error('Failed to load photo gallery:', error)
      this.showErrorMessage('Gallery Error', `Failed to load photo gallery: ${error.message}`)
    } finally {
      this.hideLoading()
    }
  }

  /**
     * Exports a map's data to an HTML report.
     * Modified to fit the new callback signature from MapsModal.
     * Added modal cleanup and delay to prevent export issues on constrained devices.
     * @param {string} mapId The ID of the map to export.
     */
  async exportHtmlReport (mapId) {
    // Close any open modals before export to prevent conflicts
    this.modalManager.closeAllModals()

    // Small delay to ensure cleanup is complete
    await new Promise(resolve => setTimeout(resolve, 100))

    this.updateAppStatus(`Generating HTML report for map ${mapId}...`)
    try {
      const map = await this.storage.getMap(mapId)
      if (!map) {
        console.error('App: Map not found for HTML export:', mapId)
        alert('Map not found for HTML export.')
        this.updateAppStatus('Ready', 'error')
        return
      }
      const markers = await this.storage.getMarkersForMap(mapId)
      let allPhotos = []
      const photoPromises = []
      for (const marker of markers) {
        const markerPhotos = await this.storage.getPhotosForMarker(marker.id)
        markerPhotos.forEach(photo => {
          photoPromises.push(this.imageProcessor.blobToBase64(photo.imageData)
            .then(dataUrl => {
              photo.imageDataUrl = dataUrl // Assign Base64 representation of original image Blob
              return photo
            }))
        })
      }
      allPhotos = await Promise.all(photoPromises)
      allPhotos.sort((a, b) => a.fileName.localeCompare(b.fileName))

      // Call the static method from HtmlReportGenerator
      await HtmlReportGenerator.generateReport(map, markers, allPhotos, this.imageProcessor)
      this.updateAppStatus(`HTML report for map "${map.name}" generated successfully.`, 'success')
    } catch (error) {
      console.error('App: Error generating HTML report:', error)
      alert('Error generating HTML report. Check console for details.')
      this.updateAppStatus('HTML report generation failed', 'error')
    }
  }

  /**
 * Handles the request to export map data as JSON.
 * This method will now show an export options modal.
 * Added modal cleanup and delay to prevent export issues on constrained devices.
 * @param {string} mapId The ID of the map to export.
 */
  async exportJsonMap (mapId) { // Renamed from _handleExportMapJson to match your existing method name
    // Close any open modals before export to prevent conflicts
    this.modalManager.closeAllModals()

    // Small delay to ensure cleanup is complete
    await new Promise(resolve => setTimeout(resolve, 100))

    this.updateAppStatus(`Preparing data for JSON export for map ${mapId}...`)
    try {
      const map = await this.storage.getMap(mapId)
      if (!map) {
        console.error('App: Map not found for JSON export:', mapId)
        alert('Map not found for JSON export.')
        this.updateAppStatus('Ready', 'error')
        return
      }

      // Retrieve ALL markers and photos for the selected map initially
      // The MapDataExporterImporter will filter these based on user selection if needed.
      const allMarkers = await this.storage.getMarkersForMap(mapId)
      const allPhotos = []
      for (const marker of allMarkers) { // Iterate through the fetched markers
        const markerPhotos = await this.storage.getPhotosForMarker(marker.id)
        allPhotos.push(...markerPhotos)
      }

      // Group markers by day for the modal options -- using the new static method
      const groupedMarkersByDay = await MapDataExporterImporter.getMarkersGroupedByDay(mapId, this.storage)

      this.updateAppStatus('Ready to choose export options.')

      // Show the new export decision modal
      const exportDecision = await this.modalManager.createExportDecisionModal(map, groupedMarkersByDay)

      if (!exportDecision) {
      // User cancelled the export decision modal
        this.updateAppStatus('JSON export cancelled.', 'info')
        return
      }

      this.updateAppStatus('Exporting map data...')

      if (exportDecision.action === 'exportComplete') {
      // Perform complete export using the existing MapDataExporterImporter.exportData
        await MapDataExporterImporter.exportData(
          map,
          allMarkers, // Pass all markers
          allPhotos, // Pass all photos
          this.imageProcessor,
          {}, // options
          this.storage // mapStorage to update imageHash if missing
        )
        this.updateAppStatus(`JSON data for map "${map.name}" exported completely.`, 'success')
      } else if (exportDecision.action === 'exportByDays') {
      // Perform day-based export using the enhanced MapDataExporterImporter.exportData
        await MapDataExporterImporter.exportData(
          map,
          allMarkers, // Pass all markers
          allPhotos, // Pass all photos
          this.imageProcessor,
          {
            datesToExport: exportDecision.selectedDates,
            splitByDate: exportDecision.exportAsSeparateFiles
          },
          this.storage // mapStorage to update imageHash if missing
        )
        // Construct a more descriptive success message
        const numDates = exportDecision.selectedDates.length
        const exportType = exportDecision.exportAsSeparateFiles ? 'separate files' : 'a single file'
        this.updateAppStatus(`JSON data for map "${map.name}" for ${numDates} day(s) exported as ${exportType}.`, 'success')
      } else if (exportDecision.action === 'exportForMigration') {
        // Perform migration export - this requires special handling to collect reference markers
        this.updateAppStatus(`Starting migration export for map "${map.name}"...`, 'info')
        // Initiate the migration export process which needs to collect 3 reference markers
        await this.initiateMigrationExportProcess(map, allMarkers, allPhotos)
      }
    } catch (error) {
      console.error('App: Error during map export process:', error)
      alert(`Error exporting map: ${error.message}`) // Use alert for critical errors
      this.updateAppStatus('JSON export failed', 'error')
    } finally {
    // Ensure that app status is reset or indicates completion
    // The previous updateAppStatus calls already handle completion message.
    }
  }

  /**
 * Handles the file selected by the user for import.
 * @param {File} file The JSON file to import.
 * @returns {Promise<Object|null>} A promise that resolves with the imported map object if successful, otherwise null.
 */
  async handleImportFile (file) {
    this.updateAppStatus(`Importing data from "${file.name}"...`, 'info', true) // 'info' for starting, 'true' for dismissible
    try {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (e) => {
          // The actual processing must be awaited within this handler
          (async () => { // <--- Wrap the processing in an immediately invoked async function expression
            try {
              const jsonData = e.target.result

              //  Call importData, passing this.storage and handling the new return structure
              const importResult = await MapDataExporterImporter.importData(
                jsonData,
                ImageProcessor, // Assuming ImageProcessor is defined appropriately
                this.storage
              )

              if (importResult.importType === 'decision_required') {
                // Pause here, display modal for user decision
                const userChoice = await this._showImportDecisionModal(importResult) // This will be async and wait for user input

                if (userChoice) {
                  const { action, selectedMapId } = userChoice
                  let finalMap = null
                  let finalMarkers = []
                  let finalPhotos = []
                  let successMessage = ''

                  if (action === 'merge') {
                    this.updateAppStatus(`Merging data into map "${selectedMapId}"...`, 'info', true)
                    // Call mergeData (which processes importedObject.markers/photos into existing map)
                    const mergedData = await MapDataExporterImporter.mergeData(
                      selectedMapId,
                      importResult.importObject,
                      ImageProcessor,
                      this.storage
                    )
                    finalMap = mergedData.map
                    finalMarkers = mergedData.markers
                    finalPhotos = mergedData.photos
                    successMessage = `Data merged into map '${finalMap.name}' successfully.`
                  } else if (action === 'replace') {
                    this.updateAppStatus(`Replacing map "${selectedMapId}" with imported data...`, 'info', true)
                    // First, get the processed new map data (with new IDs)
                    const processedNewData = await MapDataExporterImporter._processImportedDataForNewMap(
                      importResult.importObject,
                      ImageProcessor
                    )
                    finalMap = { ...processedNewData.map, id: selectedMapId } // Keep the old map ID for replacement
                    finalMarkers = processedNewData.markers.map(m => ({ ...m, mapId: selectedMapId }))
                    finalPhotos = processedNewData.photos.map(p => ({ ...p, markerId: finalMarkers.find(fm => fm.id === p.markerId).id })) // Link to the new marker IDs, which are based on old marker IDs

                    // Re-map photoIds in markers to the new marker IDs
                    // This is tricky if marker IDs are regenerated. We need to ensure photo.markerId links to the NEW marker ID for the replaced map
                    // It's cleaner to just regenerate all IDs and then re-assign the main map's ID.
                    // Let's refine the _processImportedDataForNewMap to handle this more cleanly if it's meant for replacement.
                    // For now, let's assume _processImportedDataForNewMap returns data with proper RELATIVE IDs, and we change the root map ID.

                    await this._deleteMapAndImportNew(selectedMapId, finalMap, finalMarkers, finalPhotos)
                    successMessage = `Map '${finalMap.name}' replaced successfully.`
                  } else if (action === 'new') {
                    this.updateAppStatus('Importing data as a new map...', 'info', true)
                    // Fallback to original "import as new" logic
                    const processedNewData = await MapDataExporterImporter._processImportedDataForNewMap(
                      importResult.importObject,
                      ImageProcessor
                    )
                    finalMap = processedNewData.map
                    finalMarkers = processedNewData.markers
                    finalPhotos = processedNewData.photos
                    await this._saveImportedData(finalMap, finalMarkers, finalPhotos)
                    successMessage = `Map '${finalMap.name}' imported as new successfully.`
                  }

                  if (finalMap) {
                    await this.loadMaps() // Reload maps to show changes
                    this.updateAppStatus(successMessage, 'success')
                    if (finalMap && finalMap.id) {
                      await this.switchToMap(finalMap.id)
                      console.log('Processed map loaded and set as active.')
                    }
                    resolve(finalMap)
                  } else {
                    // User selected an action but it didn't result in a map (e.g., error in merge)
                    reject(new Error('Import/Merge operation cancelled or failed to produce a map.'))
                  }
                } else {
                  // User cancelled the decision modal
                  this.updateAppStatus('Import cancelled by user.', 'info')
                  resolve(null) // Resolve as null to indicate cancellation
                }
              } else { // Handle 'new' importType (legacy or no hash match)
                // ORIGINAL LOGIC for new import or legacy import fallback
                // (from importResult, which is already processed by _processImportedDataForNewMap if no decision needed)
                const { map, markers, photos } = importResult
                await this._saveImportedData(map, markers, photos) // Helper to encapsulate saving
                await this.loadMaps() // <= This must complete before resolve
                this.updateAppStatus(`Data from "${file.name}" imported successfully.`, 'success')
                if (map && map.id) {
                  await this.switchToMap(map.id)
                  console.log('Imported map loaded and set as active.')
                }
                resolve(map) // ONLY resolve AFTER all awaits here successfully completed
              }
            } catch (importError) {
              console.error('App: Error processing imported data:', importError)
              alert(`Error processing imported data: ${importError.message}`)
              this.updateAppStatus('Import failed', 'error')
              reject(importError) // Reject if error in processing
            }
          })() // IIFE invoked
        }
        reader.onerror = (e) => {
          console.error('App: Error reading file:', e)
          alert('Error reading file.')
          this.updateAppStatus('File read failed', 'error')
          reject(new Error('File read failed'))
        }
        reader.readAsText(file)
      })
    } catch (error) {
      console.error('App: Unexpected error during file import setup:', error)
      alert('Unexpected error during file import setup.')
      this.updateAppStatus('Import setup failed', 'error')
      // Errors here occur *before* the FileReader is even set up
      return Promise.reject(error) // <--- Return a rejected Promise for consistency
    }
  }

  /**
 * Helper method to save imported map, markers, and photos to storage.
 * @param {object} map - The map object to save.
 * @param {Array<object>} markers - An array of marker objects to save.
 * @param {Array<object>} photos - An array of photo objects to save.
 * @private
 */
  async _saveImportedData (map, markers, photos) {
    await this.storage.saveMap(map)
    for (const marker of markers) {
      await this.storage.saveMarker(marker)
    }
    for (const photo of photos) {
      // Note: photo.imageData is already a Blob here due to ImageProcessorClass.base64ToBlob during import
      await this.storage.savePhoto(photo)
    }
  }

  /**
 * Helper method to delete an existing map and then import new data, maintaining the original map ID.
 * Used for the "Replace" action.
 * @param {string} existingMapId - The ID of the map to be replaced.
 * @param {object} newMapData - The new map object to save (contains original map ID).
 * @param {Array<object>} newMarkersData - New marker objects.
 * @param {Array<object>} newPhotosData - New photo objects.
 * @private
 */
  async _deleteMapAndImportNew (existingMapId, newMapData, newMarkersData, newPhotosData) {
    // First, delete the existing map and all its associated markers and photos
    await this.storage.deleteMap(existingMapId)

    // Then, save the new map data. The newMapData should already have existingMapId set for its ID.
    await this.storage.saveMap(newMapData)
    for (const marker of newMarkersData) {
      await this.storage.saveMarker(marker)
    }
    for (const photo of newPhotosData) {
      await this.storage.savePhoto(photo)
    }
  }

  /**
   * Displays a modal for the user to decide how to handle an imported map that matches
   * one or more existing maps by image hash.
   * @param {object} importResult - The result object from MapDataExporterImporter.importData
   *                                including { importObject, ImageProcessorClass, importType, existingMaps }.
   * @returns {Promise<{action: string, selectedMapId: string}|null>} A promise that resolves with the user's
   *          chosen action ('merge', 'replace', 'new') and the ID of the selected existing map (if applicable),
   *          or null if the user cancels.
   * @private
   */
  async _showImportDecisionModal (importResult) {
    // Prepare maps with thumbnails and marker counts for display
    const preparedExistingMaps = await this._getPreparedMapsForDisplay(importResult.existingMaps || [])
    const preparedSecondaryMatches = await this._getPreparedMapsForDisplay(importResult.secondaryMatches || [])

    // Show the new modal to get user's decision
    const userChoice = await this.modalManager.createImportDecisionModal(preparedExistingMaps, preparedSecondaryMatches)
    return userChoice
  }

  /**
   * Handles deletion of a photo initiated from the image viewer modal.
   * @param {string} photoId - The ID of the photo to delete.
   * @param {string} markerId - The ID of the marker this photo belongs to.
   */
  async deletePhotoFromImageViewer (photoId, markerId) {
    console.log(`App: Deleting photo ${photoId} for marker ${markerId} from image viewer.`)
    this.showLoading('Deleting image...')
    try {
      // 1. Close the image viewer modal first
      this.modalManager.closeTopModal() // This also handles object URL cleanup

      // 2. Call the existing method to handle the actual deletion from storage and UI updates
      await this.deletePhotoFromMarker(markerId, photoId)

      // 3. CRITICAL FIX: Explicitly close any existing marker details modal *before* displaying updated one
      const existingMarkerDetailsModal = document.getElementById('marker-details-modal')
      if (existingMarkerDetailsModal) {
        // Use closeModal (which handles transitions) with the specific modal element
        await this.modalManager.closeModal(existingMarkerDetailsModal)
        console.log('App: Closed existing marker details modal before refreshing.')
      }

      // 4. After deletion and successful UI update, re-open the marker details modal with the latest data
      //    This ensures the photo list in the marker details modal is also updated.
      await this.showMarkerDetails(markerId) // This will create and display a new, updated modal.

      this.showNotification('Image deleted successfully.', 'success')
      this.updateAppStatus('Image deleted.')
    } catch (error) {
      console.error('App: Failed to delete photo from image viewer:', error)
      this.showErrorMessage('Delete Photo Error', `Failed to delete image: ${error.message}`)
    } finally {
      this.hideLoading()
    }
  }

  // MODIFIED: Consolidated method to handle viewing any image (map or photo) in the viewer modal
  async handleViewImageInViewer (id, type) {
    console.log(`app.js: handleViewImageInViewer received ID: ${id}, type: ${type}`)
    this.showLoading('Loading image...')
    try {
      let item
      let imageBlob
      let title
      let onDeleteCallback = null
      let photoIdForViewer = null

      if (type === 'map') {
        item = await this.storage.getMap(id)
        if (!item || !item.imageData) {
          console.error('Map data or image data not found for ID:', id)
          this.showErrorMessage('Image Load Error', 'Map image data not found.')
          return
        }
        imageBlob = item.imageData
        title = item.name || item.fileName || 'Map Image'
        // No delete option for maps from image viewer
      } else if (type === 'photo') {
        item = await this.storage.getPhoto(id)
        if (!item || !item.imageData) { // Check for photo.markerId
          console.error('Photo data or image data not found for ID:', id)
          this.showErrorMessage('Image Load Error', 'Photo image data not found.')
          return
        }
        imageBlob = item.imageData
        title = item.fileName || 'Photo Image'
        photoIdForViewer = item.id // Pass photo ID for viewer deletion context

        // CORRECTED: Retrieve markerId directly from the fetched photo object
        const markerIdFromPhoto = item.markerId
        if (markerIdFromPhoto) {
          onDeleteCallback = async (idToDelete) => {
            await this.deletePhotoFromImageViewer(idToDelete, markerIdFromPhoto)
          }
        } else {
          console.warn(`Photo ID ${id} has no associated markerId. Cannot provide delete functionality.`)
        }
      } else {
        console.error('Unknown type for handleViewImageInViewer:', type)
        this.showErrorMessage('Image Load Error', 'Invalid image type specified.')
        return
      }

      // Create object URL and pass to modalManager
      const imageUrl = URL.createObjectURL(imageBlob)
      // Track this object URL for cleanup if needed in the future
      this.modalManager.trackObjectUrl('image-viewer-modal', imageUrl)
      this.modalManager.currentObjectUrl = imageUrl

      this.modalManager.createImageViewerModal(
        this.modalManager.currentObjectUrl,
        title,
        photoIdForViewer,
        onDeleteCallback,
        () => {
          // Clean up the object URL when the image viewer closes
          if (this.modalManager.currentObjectUrl) {
            URL.revokeObjectURL(this.modalManager.currentObjectUrl)
            this.modalManager.currentObjectUrl = null
          }
          this.updateAppStatus('Image viewer closed.')
        }
      )
      this.updateAppStatus(`Viewing image: ${title}`)
    } catch (error) {
      console.error('Error displaying image in viewer:', error)
      this.showErrorMessage('Image Load Error', `Failed to load image: ${error.message}`)
    } finally {
      this.hideLoading()
    }
  }

  /**
   * Exit migration mode without performing export
   */
  exitMigrationModeWithoutExport () {
    console.log('App: Exiting migration mode without export')

    // Clean up temporary data
    this.migrationOriginalMarkers = null
    this.migrationOriginalPhotos = null
    this.migrationMap = null

    // Reset the migration mode flag
    this.isInMigrationModeForExport = false

    // Restore original markers for the app
    if (this.migrationOriginalMarkersForApp) {
      this.markers = [...this.migrationOriginalMarkersForApp]
      this.migrationOriginalMarkersForApp = null
    }

    // Exit migration reference mode in map renderer
    if (this.mapRenderer) {
      this.mapRenderer.exitMigrationReferenceMode()
    }
    
    // Restore original marker lock state
    this.mapRenderer.setMarkersEditable(!this.markersLocked)
    
    // Refresh the markers display to ensure proper visual state (with/without photos)
    if (this.currentMap) {
      this.refreshMarkersDisplay()
    }

    this.updateAppStatus('Migration export cancelled', 'info')
  }

  /**
   * Update marker position in appropriate storage based on migration mode
   * @param {Object} marker - The marker object to update
   * @param {number} newX - New X coordinate
   * @param {number} newY - New Y coordinate
   */
  async updateMarkerPosition (marker, newX, newY) {
    if (this.isInMigrationModeForExport) {
      // Update the migration reference marker in the renderer's migration array
      const refMarkerIndex = this.mapRenderer.migrationReferenceMarkers?.findIndex(m => m.id === marker.id)
      if (refMarkerIndex !== -1) {
        this.mapRenderer.migrationReferenceMarkers[refMarkerIndex].x = newX
        this.mapRenderer.migrationReferenceMarkers[refMarkerIndex].y = newY
        console.log(`Migration reference marker ${marker.id} position updated in renderer migration array.`)
      }
      
      // Update the marker in the renderer's markers array as well
      const rendererMarkerIndex = this.mapRenderer.markers.findIndex(m => m.id === marker.id)
      if (rendererMarkerIndex !== -1) {
        this.mapRenderer.markers[rendererMarkerIndex].x = newX
        this.mapRenderer.markers[rendererMarkerIndex].y = newY
        this.mapRenderer.render() // Re-render to show the updated position
      }
    } else {
      // Normal mode - update in storage
      await this.storage.updateMarker(marker.id, {
        x: newX,
        y: newY,
        lastModified: new Date()
      })
      console.log(`Marker ${marker.id} position saved to storage.`)
    }
  }

  /**
   * Toggle debug info on map renderer
   */
  toggleMapDebugInfo () {
    if (this.mapRenderer) {
      this.mapRenderer.toggleDebugInfo()
    }
  }

  /**
   * Initiates the migration export process which requires the user to place 3 reference markers
   * on the map at easily recognizable features.
   * @param {object} map - The map object to export for migration
   * @param {Array<object>} allMarkers - All markers for the map
   * @param {Array<object>} allPhotos - All photos for the map
   */
  async initiateMigrationExportProcess (map, allMarkers, allPhotos) {
    console.log('App: Initiating migration export process')

    // We need to temporarily hide existing markers during reference placement
    // and then collect the 3 reference markers placed by the user

    // First, store the original markers to be used later for export
    this.migrationOriginalMarkers = [...allMarkers]
    this.migrationOriginalPhotos = [...allPhotos]
    this.migrationMap = map

    // Set the migration mode flag so that placeMarker knows to use migration reference placement
    this.isInMigrationModeForExport = true

    // Store the original markers for restoration later
    this.migrationOriginalMarkersForApp = [...this.markers]
    
    // Set up the map renderer for reference marker placement mode
    if (this.mapRenderer) {
      this.mapRenderer.enterMigrationReferenceMode(
        map, 
        allMarkers, 
        async (referenceMarkers) => {
          // When the user has placed all 3 reference markers and clicks Export, export the data
          await this.completeMigrationExport(referenceMarkers)
        },
        () => {
          // Cancel callback - exit migration mode without exporting
          this.exitMigrationModeWithoutExport()
        },
        (updatedMarkers) => {
          // Update callback - update the app's markers array with the renderer's markers
          this.markers = [...updatedMarkers]
        }
      )
      
      // During migration, markers start in locked state by default (users can unlock if needed)
      this.markersLocked = true // Keep markers locked initially during migration
      this.mapRenderer.setMarkersEditable(!this.markersLocked)
      // Update the lock button UI to reflect the new state
      this.updateMarkerLockButtonUI()
      
      // Update the app's markers array to be empty initially (the renderer handles reference markers)
      this.markers = []
      this.mapRenderer.setMarkers(this.markers) // Update renderer with empty array initially
    }

    this.updateAppStatus('Migration export: Place 3 reference markers on easily recognizable features', 'info')
  }

  /**
   * Completes the migration export using the reference markers placed by the user
   * @param {Array<object>} referenceMarkers - The 3 reference markers placed by the user
   */
  async completeMigrationExport (referenceMarkers) {
    console.log('App: Completing migration export with', referenceMarkers.length, 'reference markers')

    // Export the map data specifically for migration using the reference markers
    await MapDataExporterImporter.exportForMigration(
      this.migrationMap,
      this.migrationOriginalMarkers,
      this.migrationOriginalPhotos,
      referenceMarkers,
      this.imageProcessor,
      this.storage
    )

    // Clean up temporary data
    this.migrationOriginalMarkers = null
    this.migrationOriginalPhotos = null
    this.migrationMap = null

    // Reset the migration mode flag
    this.isInMigrationModeForExport = false

    // Restore original markers for the app
    if (this.migrationOriginalMarkersForApp) {
      this.markers = [...this.migrationOriginalMarkersForApp]
      this.migrationOriginalMarkersForApp = null
    }

    // Exit migration reference mode in map renderer
    if (this.mapRenderer) {
      this.mapRenderer.exitMigrationReferenceMode()
    }
    
    // Restore original marker lock state
    this.mapRenderer.setMarkersEditable(!this.markersLocked)
    
    // Refresh the markers display to ensure proper visual state (with/without photos)
    if (this.currentMap) {
      this.refreshMarkersDisplay()
    }

    this.updateAppStatus('Migration export completed', 'success')
  }
}

// Initialize the app
const app = new SnapSpotApp()

// Make app available globally for debugging
window.SnapSpotApp = app
