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

// --- End Module Imports ---

class SnapSpotApp {
  constructor () {
    this.isOnline = navigator.onLine
    this.serviceWorkerReady = false
    this.storage = new MapStorage()
    this.fileManager = new FileManager()
    this.modalManager = new ModalManager()
    this.searchManager = new SearchManager(this.modalManager, {
      searchMaps: (query) => searchMaps(this, query),
      searchPhotos: (query) => searchPhotos(this, query),
      deleteMap: (mapId) => this.deleteMap(mapId),
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
  // Map Interaction Handlers Phase 1C - Updated for Marker Dragging
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
    const preparedExistingMaps = await this.imageProcessor.prepareMapsForDisplay(importResult.existingMaps || [], this.thumbnailCache, this.imageCompressionSettings)
    const preparedSecondaryMatches = await this.imageProcessor.prepareMapsForDisplay(importResult.secondaryMatches || [], this.thumbnailCache, this.imageCompressionSettings)

    // Show the new modal to get user's decision
    const userChoice = await this.modalManager.createImportDecisionModal(preparedExistingMaps, preparedSecondaryMatches)
    return userChoice
  }

  /**
   * Toggle debug info on map renderer
   */
  toggleMapDebugInfo () {
    if (this.mapRenderer) {
      this.mapRenderer.toggleDebugInfo()
    }
  }
}

// Initialize the app
const app = new SnapSpotApp()

// Make app available globally for debugging
window.SnapSpotApp = app
