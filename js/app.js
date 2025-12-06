/**
 * SnapSpot PWA - Main Application
 * Phase 1B: File Management and Storage
 */

/* global
        alert
        localStorage
        */

// --- Module Imports ---
import { MapStorage } from './storage.js'
import { FileManager } from './fileManager.js'
import { MapRenderer } from './mapRenderer.js'
import { ImageProcessor } from './imageProcessor.js'
import { MapDataExporterImporter } from './MapDataExporterImporter.js'
import { SearchManager } from './searchManager.js'
import { ModalManager } from './ui/modals.js'
import * as MapInteractions from './app-map-interactions.js'
import {
  placeMarker,
  showMapPhotoGallery,
  handleViewImageInViewer
} from './app-marker-photo-manager.js'
import { searchMaps, searchPhotos, handleSearchFileSelection, onShowPhotoOnMap } from './app-search.js'
import { showSettings, getCustomMarkerColorRules } from './app-settings.js'
import { StorageManager } from './app-storage-manager.js'

// --- End Module Imports ---

class SnapSpotApp {
  constructor () {
    this.isOnline = navigator.onLine
    this.serviceWorkerReady = false
    this.fileManager = new FileManager()
    this.modalManager = new ModalManager()
    this.searchManager = new SearchManager(this.modalManager, {
      searchMaps: (query) => searchMaps(this, query),
      searchPhotos: (query) => searchPhotos(this, query),
      deleteMap: (mapId) => StorageManager.deleteMap(this, mapId),
      exportHtmlReport: (mapId) => this.exportHtmlReport(mapId),
      exportJsonMap: (mapId) => this.exportJsonMap(mapId),
      onSearchFileSelect: () => handleSearchFileSelection(this),
      onViewImageInViewer: (id, type) => handleViewImageInViewer(this, id, type),
      onShowPhotoOnMap: (photoData) => onShowPhotoOnMap(this, photoData)
    })

    this.mapRenderer = new MapRenderer('map-canvas')
    this.currentMap = null
    this.mapsList = []
    this.isLoading = false
    this.uploadedFiles = new Map()
    this.thumbnailCache = new Map()
    this.imageProcessor = new ImageProcessor()
    this.storage = new MapStorage(this.imageProcessor)
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

    // Custom Marker Coloring Settings
    this.customMarkerColors = [
      { name: 'Cyan', hex: '#06B6D4' },
      { name: 'Lime Green', hex: '#84CC16' },
      { name: 'Pink', hex: '#EC4899' },
      { name: 'Indigo', hex: '#6366F1' },
      { name: 'Emerald Green', hex: '#10B981' },
      { name: 'Rose', hex: '#F43F5E' },
      { name: 'Violet', hex: '#8B5CF6' }
    ]

    this.customMarkerOperators = [
      { value: 'isEmpty', label: 'Description is empty' },
      { value: 'isNotEmpty', label: 'Description is not empty' },
      { value: 'contains', label: 'Description contains...' }
    ]
    this.customMarkerRules = [] // Will be loaded from localStorage

    // Custom Marker Coloring Rules Management
    this.customMarkerRulesKey = 'customMarkerColorRules'

    // : App Behavior Settings
    this.autoCloseMarkerDetails = localStorage.getItem('autoCloseMarkerDetails') === 'true' || false
    this.allowDuplicatePhotos = localStorage.getItem('allowDuplicatePhotos') === 'true' || false
    this.notificationsEnabled = localStorage.getItem('notificationsEnabled') === 'true' || true

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
      this.restoreNotificationsState()
      this.customMarkerRules = getCustomMarkerColorRules(this) // Load custom marker rules
      this.mapRenderer.setCustomColorRules(this.customMarkerRules) // Pass rules to mapRenderer
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
      settingsBtn.addEventListener('click', () => showSettings(this))
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
      placeMarkerBtn.addEventListener('click', () => placeMarker(this))
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
      galleryBtn.addEventListener('click', () => showMapPhotoGallery(this))
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
   * Set up map interaction listeners
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

      this.mapRenderer.setCustomColorRules(this.customMarkerRules) // Ensure mapRenderer has the latest rules
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
    await StorageManager.deleteMap(this, mapId)
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

  zoomIn () {
    MapInteractions.zoomIn(this)
  }

  zoomOut () {
    MapInteractions.zoomOut(this)
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
  // Map Interaction Handlers
  // ========================================

  /**
   * Handle mouse down event on the map container for panning OR marker dragging.
   */
  handleMapMouseDown (event) {
    MapInteractions.handleMapMouseDown(this, event)
  }

  /**
   * Handle mouse move event on the map container for panning OR marker dragging.
   */
  handleMapMouseMove (event) {
    MapInteractions.handleMapMouseMove(this, event)
  }

  /**
   * Handle mouse up event on the map container to finalize interaction.
   */
  handleMapMouseUp (event) {
    MapInteractions.handleMapMouseUp(this, event)
  }

  /**
   * Handle mouse wheel event for zooming.
   */
  handleMapWheel (event) {
    MapInteractions.handleMapWheel(this, event)
  }

  /**
   * Handle touch start event for panning AND marker dragging.
   */
  handleMapTouchStart (event) {
    MapInteractions.handleMapTouchStart(this, event)
  }

  /**
   * Handle touch move event forPanning OR marker dragging OR pinch-zoom.
   */
  handleMapTouchMove (event) {
    MapInteractions.handleMapTouchMove(this, event)
  }

  /**
   * Handle touch end event to finalize interaction.
   */
  handleMapTouchEnd (event) {
    MapInteractions.handleMapTouchEnd(this, event)
  }

  getDistance (touch1, touch2) {
    return MapInteractions.getDistance(touch1, touch2)
  }

  // ========================================
  // Utility Methods
  // ========================================

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
    return await StorageManager.initialize(this)
  }

  /**
   * Load maps from storage
   */
  async loadMaps () {
    return await StorageManager.loadMaps(this)
  }

  /**
   * Check if welcome screen should be shown
   */
  checkWelcomeScreen () {
    StorageManager.checkWelcomeScreen(this)
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
  async handleMapUpload (mapData, originalFile) {
    await MapDataExporterImporter.handleMapUpload(this, mapData, originalFile)
  }

  /**
   * Display a map on the canvas
   * @param {Object} mapData - Map metadata from storage. Now includes imageData.
   * MODIFIED: To correctly determine and pass `hasPhotos` status to markers using getMarkerPhotoCount.
   * ALSO MODIFIED: To apply map rotation initially.
   */
  async displayMap (mapData) {
    await StorageManager.displayMap(this, mapData)
  }

  /**
   * Switch to a different map
   * @param {string} mapId - ID of map to switch to
   */
  async switchToMap (mapId) {
    await StorageManager.switchToMap(this, mapId)
  }

  /**
   * Get current map display info
   */
  getCurrentMapInfo () {
    return StorageManager.getCurrentMapInfo(this)
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
     * Exports a map's data to an HTML report.
     * Modified to fit the new callback signature from MapsModal.
     * Added modal cleanup and delay to prevent export issues on constrained devices.
     * @param {string} mapId The ID of the map to export.
     */
  async exportHtmlReport (mapId) {
    await MapDataExporterImporter.exportHtmlReport(this, mapId)
  }

  /**
 * Handles the request to export map data as JSON.
 * This method will now show an export options modal.
 * Added modal cleanup and delay to prevent export issues on constrained devices.
 * @param {string} mapId The ID of the map to export.
 */
  async exportJsonMap (mapId) {
    await MapDataExporterImporter.exportJsonMap(this, mapId)
  }

  /**
 * Handles the file selected by the user for import.
 * @param {File} file The JSON file to import.
 * @returns {Promise<Object|null>} A promise that resolves with the imported map object if successful, otherwise null.
 */
  async handleImportFile (file) {
    return await MapDataExporterImporter.handleImportFile(this, file)
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
   * Show the migration overlay
   */
  showMigrationOverlay () {
    let overlay = document.getElementById('migration-overlay')
    if (!overlay) {
      overlay = document.createElement('div')
      overlay.id = 'migration-overlay'
      overlay.className = 'migration-overlay'
      overlay.innerHTML = `
        <div class="migration-overlay__spinner"></div>
        <div class="migration-overlay__message">Updating maps, please stand by</div>
      `
      document.body.appendChild(overlay)
    }
    overlay.style.display = 'flex'
  }

  /**
   * Hide the migration overlay
   */
  hideMigrationOverlay () {
    const overlay = document.getElementById('migration-overlay')
    if (overlay) {
      overlay.style.display = 'none'
    }
  }
}

// Initialize the app
const app = new SnapSpotApp()

// Make app available globally for debugging
window.SnapSpotApp = app
