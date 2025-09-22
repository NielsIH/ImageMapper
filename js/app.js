/**
 * Image Mapper PWA - Main Application
 * Phase 1B: File Management and Storage
 */

/* global
        alert
        MapStorage
        FileManager
        ModalManager
        MapRenderer
        ImageProcessor
        HtmlReportGenerator
        MapDataExporterImporter
        Image
        localStorage
        FileReader
        */

class ImageMapperApp {
  constructor () {
    this.isOnline = navigator.onLine
    this.serviceWorkerReady = false

    // Phase 1B: Storage and map management
    this.storage = new MapStorage()
    this.fileManager = new FileManager()
    this.modalManager = new ModalManager()
    this.mapRenderer = new MapRenderer('map-canvas')
    this.currentMap = null
    this.mapsList = []
    this.isLoading = false
    this.uploadedFiles = new Map() // Store file references for rendering
    this.thumbnailCache = new Map() // NEW: Cache for thumbnail Data URLs
    this.imageProcessor = new ImageProcessor() // For future image processing
    // Define image compression settings here
    this.imageCompressionSettings = {
      map: {
        maxWidth: 1920,
        maxHeight: 1920,
        quality: 0.8
      },
      photo: { // For images attached to markers
        maxWidth: 1000,
        maxHeight: 1000,
        quality: 0.5
      },
      thumbnail: { // For very small thumbnails, like in lists
        maxSize: 100, // Max dimension (either width or height)
        quality: 0.7
      }
    }
    // NEW: Marker Size Control
    this.markerDisplaySizeKey = 'normal' // Initial marker size
    this.markerSizeCycle = ['normal', 'large', 'extraLarge'] // Cycle order
    this.markerSizeLabelMap = { // For button text
      normal: 'Normal Size',
      large: 'Large Size',
      extraLarge: 'XL Size' // Abbreviated for button display
    }

    // New properties for map interaction (Phase 1C)
    this.isDragging = false // Flag to indicate if map is being dragged
    this.lastX = 0 // Last X coordinate of mouse/touch for panning
    this.lastY = 0 // Last Y coordinate of mouse/touch for panning
    this.initialPinchDistance = 0 // Distance between two touches for pinch-zoom
    this.lastScale = 1 // Scale at the start of a pinch gesture
    this.activeTouches = new Map() // Stores active touch points for multi-touch

    this.markers = [] // NEW: Array to hold markers for the current map
    // state properties for marker dragging
    this.isDraggingMarker = false
    this.draggedMarkerId = null
    this.dragStartMapX = 0 // Marker's map X at start of drag
    this.dragStartMapY = 0 // Marker's map Y at start of drag
    this.initialMouseX = 0 // Mouse X at start of drag
    this.initialMouseY = 0 // Mouse Y at start of drag
    // State to track the type of interaction
    this.interactionType = 'none' // 'none', 'map_pan', 'marker_drag', 'pinch_zoom'

    this.mapControls = document.querySelector('.map-controls')
    this.mapControlsWrapper = document.querySelector('.map-controls-wrapper')
    this.showCrosshair = false // NEW: State to track crosshair visibility
    this.markersLocked = true // NEW: State to track if markers are globally locked (default: true)

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
    console.log('Image Mapper App: Initializing...')

    try {
      // Set up event listeners
      this.setupEventListeners()

      // Update connection status
      this.updateConnectionStatus()

      // Check service worker status
      await this.checkServiceWorker()

      // Initialize storage system
      await this.initializeStorage()

      // Load existing maps
      await this.loadMaps()

      // Restore map controls state
      this.restoreMapControlsState()

      // Restore crosshair state
      this.restoreCrosshairState()

      // NEW: Restore marker lock state
      this.restoreMarkerLockState()

      // NEW: Restore marker size state
      this.restoreMarkerSizeState()

      // Check welcome screen visibility
      this.checkWelcomeScreen()

      // Initialize app state
      this.updateAppStatus('Ready')

      console.log('Image Mapper App: Initialization complete')
    } catch (error) {
      console.error('Image Mapper App: Initialization failed', error)
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

    // NEW: Handle dynamic button for uploading new maps after initial setup
    // const uploadNewMapBtn = document.getElementById('btn-upload-new-map')
    // if (uploadNewMapBtn) {
    //   uploadNewMapBtn.addEventListener('click', () => this.showUploadModal())
    // }
  }

  /**
     * Set up button click listeners
     */
  setupButtonListeners () {
    // Settings button
    const settingsBtn = document.getElementById('btn-settings')
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => this.showSettings())
    }
    const btnImportData = document.getElementById('btn-import-data')
    const fileInputImport = document.getElementById('file-input-import')

    if (btnImportData) {
      btnImportData.addEventListener('click', () => {
        // Trigger the hidden file input click when the button is clicked
        fileInputImport.click()
      })
    }

    if (fileInputImport) {
      fileInputImport.addEventListener('change', async (event) => {
        const file = event.target.files[0]
        if (file) {
          await this.handleImportFile(file) // A new method we'll create next
        }
        // Clear the file input value to allow importing the same file again if needed
        event.target.value = ''
      })
    }

    // Add first map button
    const addFirstMapBtn = document.getElementById('btn-add-first-map')
    if (addFirstMapBtn) {
      addFirstMapBtn.addEventListener('click', () => this.showUploadModal()) // <<< Changed to call showUploadModal directly
    }

    // Map list button (to open NEW consolidated Map Management Modal)
    const mapListBtn = document.getElementById('btn-map-list')
    if (mapListBtn) {
      mapListBtn.addEventListener('click', () => this.showMapManagementModal()) // << NEW call
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

    // NEW: Toggle Marker Lock button
    const toggleMarkerLockBtn = document.getElementById('btn-toggle-marker-lock')
    if (toggleMarkerLockBtn) {
      toggleMarkerLockBtn.addEventListener('click', () => this.toggleMarkerLockState())
    }
    // NEW: Toggle Marker Size button
    const toggleMarkerSizeBtn = document.getElementById('btn-toggle-marker-size')
    if (toggleMarkerSizeBtn) {
      toggleMarkerSizeBtn.addEventListener('click', () => this.toggleMarkerSize())
    }

    // Toggle Crosshair button
    const toggleCrosshairBtn = document.getElementById('btn-toggle-crosshair')
    if (toggleCrosshairBtn) {
      toggleCrosshairBtn.addEventListener('click', () => this.toggleCrosshair())
    }

    // Toggle Map Controls button
    const toggleMapControlsBtn = document.getElementById('toggle-map-controls')
    if (toggleMapControlsBtn) {
      toggleMapControlsBtn.addEventListener('click', () => this.toggleMapsControls())
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
  /**
 * Check service worker status
 */
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

  // ========================================
  // Button Action Handlers (Placeholder)
  // ========================================

  /**
     * Show settings modal (placeholder for future implementation)
     */
  showSettings () {
    console.log('Settings clicked - to be implemented in future phase')
    this.updateAppStatus('Settings - Coming soon')

    // Placeholder alert for now
    alert('Settings feature will be implemented in a future phase.\n\nCurrent version: Phase 1A - PWA Foundation')
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
   * Orchestrates displaying the comprehensive Maps Management Modal.
   * This includes fetching maps, generating thumbnails, and handling all map actions within the modal.
   */
  async showMapManagementModal () {
    // Check if a map management modal is already active via the central ModalManager
    // This helps prevent opening multiple if another part of the app is also triggering it
    // without proper closure.
    if (this.modalManager.getTopModalId() === 'map-management-modal') {
      return
    }
    this.showLoading('Loading map management...', false)
    try {
      await this.loadMaps() // Make sure this.mapsList is populated
      const mapsWithThumbnails = await Promise.all(this.mapsList.map(async (map) => {
        let thumbnailDataUrl = this.thumbnailCache.get(map.id)
        if (!thumbnailDataUrl && map.imageData instanceof Blob) { // Check for Blob type before processing
          try {
            // Generate thumbnail from map.imageData (Blob)
            thumbnailDataUrl = await this.imageProcessor.generateThumbnailDataUrl(map.imageData, 100) // 100px size
            if (thumbnailDataUrl) {
              this.thumbnailCache.set(map.id, thumbnailDataUrl)
            }
          } catch (thumbError) {
            console.warn(`App: Failed to generate thumbnail for map ${map.id}:`, thumbError)
            thumbnailDataUrl = null
          }
        } else if (!map.imageData) {
          // If map.imageData is null or undefined (e.g., in an imported map, or older data)
          thumbnailDataUrl = null
        }
        // Return map object with thumbnailDataUrl (new property)
        return { ...map, thumbnailDataUrl }
      }))

      const currentActiveMapId = this.currentMap ? this.currentMap.id : null

      // CORRECTED CALL TO createMapManagementModal
      // Ensure parameters match the updated signature in modals.js
      const mapManagementModalInstance = this.modalManager.createMapManagementModal(
        mapsWithThumbnails,
        currentActiveMapId,
        async (mapId) => { // onMapSelected callback
          await this.switchToMap(mapId)
          // The modal.closeModal() is handled internally by modalManager during click,
          // which then triggers the final onClose callback below.
        },
        async (mapId) => { // onMapDelete callback
          await this.deleteMap(mapId)
          // Ensure the currently open modal is closed/cleaned up if needed before re-opening
          this.modalManager.closeModal(mapManagementModalInstance)
          // Re-show the map management modal with the updated list
          this.showMapManagementModal()
        },
        async () => { // onAddNewMap callback - simplified for direct call
          this.modalManager.closeModal(mapManagementModalInstance)
          this.showUploadModal() // Assuming this opens the upload modal
        },
        // onExportHtmlMap callback (was onExportMap)
        async (mapId) => {
          this.modalManager.closeModal(mapManagementModalInstance) // Close modal before export
          await this.exportHtmlReport(mapId) // Call the correct HTML export method
        },
        // onExportJsonMap callback (NEW)
        async (mapId) => {
          this.modalManager.closeModal(mapManagementModalInstance) // Close modal before export
          await this.exportJsonMap(mapId) // Call the new JSON export method
        },
        () => { // Final onClose callback passed to createMapManagementModal (triggered by any closing event)
          this.updateAppStatus('Ready')
        },
        () => { // onModalReady callback (triggered when modal is shown after animation)
          this.hideLoading()
        }
      )
      this.updateAppStatus('Map management displayed')
    } catch (error) {
      console.error('App: Error showing map management modal:', error)
      this.showErrorMessage('Failed to open map management', error.message)
      this.hideLoading()
    }
  }

  //   async showMapManagementModal () {
  //     this.updateAppStatus('Loading map list...')
  //     const maps = await this.loadMaps()
  //     this.updateAppStatus('Map list loaded.')

  //     this.modalManager.createMapManagementModal(
  //       maps,
  //       this.currentMapId,
  //       async (mapId) => this.selectMap(mapId), // REAL Callback
  //       async (mapId) => this.deleteMap(mapId), // REAL Callback
  //       () => console.log('Add New Map'), // Dummy for now
  //       async (mapId) => console.log('Export HTML:', mapId), // Dummy for now
  //       async (mapId) => console.log('Export JSON:', mapId), // Dummy for now
  //       () => this.updateAppStatus('Ready') // REAL Callback (assuming it's this one)
  //     )
  // }

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
    } catch (error) {
      console.error('Error deleting map:', error)
      this.showErrorMessage('Deletion Failed', `Failed to delete map: ${error.message}`)
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

  /**
   * NEW: Toggles the marker lock state.
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
   * NEW: Restores the saved state of marker locking from localStorage.
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
   * NEW: Updates the text and icon of the marker lock button based on current state.
   */
  updateMarkerLockButtonUI () {
    const toggleMarkerLockBtn = document.getElementById('btn-toggle-marker-lock')
    if (toggleMarkerLockBtn) {
      // const btnTextSpan = toggleMarkerLockBtn.querySelector('.btn-text')
      if (this.markersLocked) {
        toggleMarkerLockBtn.title = 'Unlock markers position'
        toggleMarkerLockBtn.innerHTML = '🔒 <span class="btn-text">Locked Markers</span>'
        toggleMarkerLockBtn.classList.remove('active') // Optional: remove an 'active' class if you style unlocked state
      } else {
        toggleMarkerLockBtn.title = 'Lock markers position'
        toggleMarkerLockBtn.innerHTML = '🔓 <span class="btn-text">Unlocked Markers</span>'
        toggleMarkerLockBtn.classList.add('active') // Optional: add an 'active' class for unlocked state
      }
    }
  }

  /**
   * NEW: Toggles the display size of markers.
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
   * NEW: Restores the saved marker display size from localStorage.
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
   * NEW: Updates the text and icon of the marker size button based on current state.
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
   * NEW: Toggles the crosshair visibility and saves the state.
   */
  toggleCrosshair () {
    this.showCrosshair = !this.showCrosshair
    if (this.mapRenderer) {
      this.mapRenderer.toggleCrosshair(this.showCrosshair)
    }
    localStorage.setItem('showCrosshair', this.showCrosshair)
    this.showNotification(`Crosshair ${this.showCrosshair ? 'enabled' : 'disabled'}.`, 'info')
    console.log('Crosshair toggled. State:', this.showCrosshair)
  }

  /**
   * NEW: Restores the saved state of the crosshair from localStorage.
   */
  restoreCrosshairState () {
    const savedState = localStorage.getItem('showCrosshair')
    if (savedState !== null) {
      this.showCrosshair = (savedState === 'true') // localStorage stores strings
      if (this.mapRenderer) {
        this.mapRenderer.toggleCrosshair(this.showCrosshair)
      }
      console.log('Restored crosshair state:', this.showCrosshair)
    }
  }

  /**
   * NEW: Method to toggle map controls and save state
   */
  toggleMapsControls () {
    // IMPORTANT: Make sure `this.mapControlsWrapper` is being used here.
    if (this.mapControlsWrapper) {
      this.mapControlsWrapper.classList.toggle('minimized') // <--- CRITICAL FIX: Toggle on the wrapper
      const isMinimized = this.mapControlsWrapper.classList.contains('minimized')
      localStorage.setItem('mapControlsMinimized', isMinimized)
      console.log('Toggled map controls. Minimized:', isMinimized)
    } else {
      console.warn('Cannot toggle map controls: mapControlsWrapper element not found.')
    }
  }

  /**
   * Restores the saved minimized state of the map controls from localStorage.
   */
  restoreMapControlsState () {
    // IMPORTANT: Make sure `this.mapControlsWrapper` is being used here.
    if (this.mapControlsWrapper) {
      const savedState = localStorage.getItem('mapControlsMinimized')
      if (savedState === 'true') {
        this.mapControlsWrapper.classList.add('minimized') // <--- CRITICAL FIX: Add to the wrapper
        console.log('Restored map controls to minimized state.')
      } else {
        this.mapControlsWrapper.classList.remove('minimized')
        console.log('Restored map controls to expanded state.')
      }
    } else {
      console.warn('Cannot restore map controls state: mapControlsWrapper element not found.')
    }
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
      return null
    }

    const canvasRect = this.mapRenderer.canvas.getBoundingClientRect()
    const screenX = clientX - canvasRect.left
    const screenY = clientY - canvasRect.top

    // MODIFIED: Get the current marker radius from mapRenderer
    const currentMarkerSize = this.mapRenderer.getCurrentMarkerDisplaySize()
    // Define a hit area radius around the marker (e.g., marker radius + some padding)
    const hitRadius = currentMarkerSize.radius + 5 // Use current radius plus 5px padding

    for (let i = this.markers.length - 1; i >= 0; i--) { // Iterate backwards to hit top-most marker first
      const marker = this.markers[i]
      const markerScreenCoords = this.mapRenderer.mapToScreen(marker.x, marker.y)

      if (markerScreenCoords) {
        const dx = screenX - markerScreenCoords.x
        const dy = screenY - markerScreenCoords.y
        const distance = Math.sqrt(dx * dx + dy * dy)

        if (distance <= hitRadius) {
          return marker
        }
      }
    }
    return null
  }

  /**
   * Handle mouse down event on the map container for panning OR marker dragging.
   */
  handleMapMouseDown (event) {
    if (!this.currentMap || event.button !== 0) return // Only left click and if map is loaded

    this.initialDownX = event.clientX
    this.initialDownY = event.clientY

    const clickedMarker = this.getMarkerAtPoint(event.clientX, event.clientY)

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

      const currentMarkerMapX = this.dragStartMapX + (deltaX / this.mapRenderer.scale)
      const currentMarkerMapY = this.dragStartMapY + (deltaY / this.mapRenderer.scale)

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
          this.showMarkerDetails(markerToSave.id)
        } else {
          // It was an actual drag, save its new position
          try {
            await this.storage.updateMarker(markerToSave.id, {
              x: markerToSave.x,
              y: markerToSave.y,
              lastModified: new Date()
            })
            console.log(`Marker ${markerToSave.id} position saved after drag.`)
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
          this.showMarkerDetails(clickedMarker.id)
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
      const touch = event.changedTouches[0]
      const touchedMarker = this.getMarkerAtPoint(touch.clientX, touch.clientY)

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

      const currentMarkerMapX = this.dragStartMapX + (deltaX / this.mapRenderer.scale)
      const currentMarkerMapY = this.dragStartMapY + (deltaY / this.mapRenderer.scale)

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
          this.showMarkerDetails(markerToSave.id)
        } else {
          // It was an actual drag, save its new position
          try {
            await this.storage.updateMarker(markerToSave.id, {
              x: markerToSave.x,
              y: markerToSave.y,
              lastModified: new Date()
            })
            console.log(`Marker ${markerToSave.id} position saved after touch drag.`)
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
          this.showMarkerDetails(clickedMarker.id)
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
     * Show a simple notification (for development)
     */
  showNotification (message, type = 'info') {
    console.log(`${type.toUpperCase()}: ${message}`)
    this.updateAppStatus(message)

    // In future phases, this could show a proper toast notification
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

    if (this.mapsList.length === 0) {
      // Show welcome screen if no maps
      welcomeScreen?.classList.remove('hidden')
      mapDisplay?.classList.add('hidden')
      this.updateAppStatus('No maps - Upload your first map')

      // Update button text for first upload
      if (addFirstMapBtn) {
        addFirstMapBtn.innerHTML = '📁 Upload First Map'
      }
    } else {
      // Hide welcome screen if maps exist
      welcomeScreen?.classList.add('hidden')
      mapDisplay?.classList.remove('hidden')
      this.updateAppStatus(`${this.mapsList.length} maps available`)

      // Update button text for additional uploads
      if (addFirstMapBtn) {
        addFirstMapBtn.innerHTML = '📁 Upload New Map'
      }
    }
    //  - ensure canvas setup when showing map display
    if (this.mapsList.length > 0) {
      welcomeScreen?.classList.add('hidden')
      mapDisplay?.classList.remove('hidden')

      // NOW display the map after container is visible
      if (this.currentMap && !this.mapRenderer.imageData) {
        setTimeout(async () => {
          this.mapRenderer.resizeCanvas() // This will work now
          await this.displayMap(this.currentMap)
        }, 100) // Small delay for layout
      }

      // NEW: Ensure canvas is properly initialized when map display becomes visible
      setTimeout(() => {
        this.mapRenderer.setupCanvas()
        this.mapRenderer.resizeCanvas()
        if (this.currentMap) {
          this.mapRenderer.render()
        }
      }, 50) // Small delay to ensure CSS layout is applied

      this.updateAppStatus(`${this.mapsList.length} maps available`)
    }
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

  // ========================================
  // Phase 1B: Map Display System
  // ========================================

  /**
   * Display a map on the canvas
   * @param {Object} mapData - Map metadata from storage. Now includes imageData.
   * MODIFIED: To correctly determine and pass `hasPhotos` status to markers using getMarkerPhotoCount.
   */
  async displayMap (mapData) {
    if (!mapData) {
      console.warn('No map data provided for display')
      return
    }

    try {
      console.log('Displaying map:', mapData.name)
      this.updateAppStatus(`Loading map: ${mapData.name}`)

      let imageBlob = this.uploadedFiles.get(mapData.id)
      if (!imageBlob && mapData.imageData) {
        imageBlob = mapData.imageData
        console.log('Displaying map: Loaded image data from storage.')
        this.uploadedFiles.set(mapData.id, imageBlob)
      }

      if (imageBlob && imageBlob instanceof Blob) {
        await this.mapRenderer.loadMap(mapData, imageBlob)
        console.log('Map loaded from Blob successfully')
      } else {
        await this.mapRenderer.loadPlaceholder(mapData)
        console.log('Map placeholder loaded')
      }

      this.currentMap = mapData

      // MODIFIED: Load markers for the current map and use getMarkerPhotoCount for hasPhotos status
      const fetchedMarkers = await this.storage.getMarkersForMap(this.currentMap.id)
      this.markers = await Promise.all(fetchedMarkers.map(async marker => {
        const photoCount = await this.storage.getMarkerPhotoCount(marker.id)
        return {
          ...marker,
          // IMPORTANT: The photoIds array on the marker object from IndexedDB might not be perfectly current
          // if photos were added/deleted without explicitly updating the marker object itself.
          // However, hasPhotos is now correctly determined by directly counting photos.
          hasPhotos: photoCount > 0
          // Retain photoIds from the marker object if it exists, for modals etc.
          // It will be updated when adding/deleting photos anyway.
        }
      }))

      this.mapRenderer.setMarkers(this.markers)
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
      console.log('Photos for marker:', validPhotos)

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
          await this.setupAddPhotosForMarker(marker.id)
          await this.showMarkerDetails(marker.id) // Correctly calling itself by original name
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
            // Update local markers array for immediate UI refresh
            const localMarker = this.markers.find(m => m.id === markerIdToSave)
            if (localMarker) {
              localMarker.description = newDescription
            }
            // NEW: Update the modal's displayed description directly
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
        async (markerIdToDeleteFrom, photoIdToDelete) => {
          console.log(`Delete photo ${photoIdToDelete} from marker ${markerIdToDeleteFrom} clicked`)
          this.modalManager.closeTopModal()
          await this.deletePhotoFromMarker(markerIdToDeleteFrom, photoIdToDelete)
          await this.showMarkerDetails(markerIdToDeleteFrom) // Correctly calling itself by original name
        },
        // NEW: onViewPhoto callback (placed before onClose as per ModalManager signature)
        (photoId) => this.handleViewPhoto(photoId), // This is the new line
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
    try {
      const selectedFiles = await this.fileManager.selectFiles(true, true)
      if (!selectedFiles || selectedFiles.length === 0) {
        this.showNotification('Photo selection cancelled.', 'info')
        return
      }
      const photoIdsToAdd = []
      for (const file of selectedFiles) {
        this.updateAppStatus(`Processing photo: ${file.name}...`)

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

          // NEW: Update local markers array and re-render map for visual change
          const localMarker = this.markers.find(m => m.id === markerId)
          if (localMarker) {
            localMarker.photoIds = updatedPhotoIds // Update local photoIds
            localMarker.hasPhotos = (updatedPhotoIds.length > 0) // Update local hasPhotos status (will be true)
          }
          this.mapRenderer.setMarkers(this.markers) // Pass updated local array
          this.mapRenderer.render() // Re-render to reflect new color if needed
        }
      }
    } catch (error) {
      console.error('Failed to add photos to marker:', error)
      this.showErrorMessage('Photo Error', `Failed to add photos: ${error.message}`)
    } finally {
      this.hideLoading()
    }
  }

  /**
   * Deletes a photo from a marker and from storage.
   * MODIFIED: To ensure marker's `hasPhotos` status is updated and re-rendered.
   * @param {string} markerId - The ID of the marker the photo is associated with.
   * @param {string} photoId - The ID of the photo to delete.
   */
  async deletePhotoFromMarker (markerId, photoId) {
    this.showLoading('Removing photo...')
    try {
      // 1. Get the marker and remove the photoId from its photoIds array
      const marker = await this.storage.getMarker(markerId)
      if (marker) {
        const updatedPhotoIds = marker.photoIds.filter(id => id !== photoId)
        await this.storage.updateMarker(markerId, { photoIds: updatedPhotoIds, lastModified: new Date() })
        console.log(`Removed photoId ${photoId} from marker ${markerId}`)

        // NEW: Update local markers array and re-render map for visual change
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
     * Exports a map's data to an HTML report.
     * Modified to fit the new callback signature from MapsModal.
     * @param {string} mapId The ID of the map to export.
     */
  async exportHtmlReport (mapId) {
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
     * Exports a map's data to a JSON file using MapDataExporterImporter.
     * @param {string} mapId The ID of the map to export.
     */
  async exportJsonMap (mapId) {
    this.updateAppStatus(`Preparing data for JSON export for map ${mapId}...`)
    try {
      const map = await this.storage.getMap(mapId)
      if (!map) {
        console.error('App: Map not found for JSON export:', mapId)
        alert('Map not found for JSON export.')
        this.updateAppStatus('Ready', 'error')
        return
      }
      const markers = await this.storage.getMarkersForMap(mapId)
      const photos = []
      for (const marker of markers) {
        const markerPhotos = await this.storage.getPhotosForMarker(marker.id)
        photos.push(...markerPhotos)
      }
      // MapDataExporterImporter handles Blob to Base64 conversion and download
      await MapDataExporterImporter.exportData(map, markers, photos, this.imageProcessor)
      this.updateAppStatus(`JSON data for map "${map.name}" exported successfully.`, 'success')
    } catch (error) {
      console.error('App: Error exporting JSON map data:', error)
      alert('Error exporting JSON map data. Check console for details.')
      this.updateAppStatus('JSON export failed', 'error')
    }
  }

  /**
     * Handles the file selected by the user for import.
     * @param {File} file The JSON file to import.
     */
  async handleImportFile (file) {
    this.updateAppStatus(`Importing data from "${file.name}"...`)
    try {
      const reader = new FileReader()
      reader.onload = async (e) => {
        try {
          const jsonData = e.target.result
          const { map, markers, photos } = await MapDataExporterImporter.importData(jsonData, ImageProcessor)
          // Save imported data to storage using the new save methods
          await this.storage.saveMap(map)
          for (const marker of markers) {
            await this.storage.saveMarker(marker)
          }
          for (const photo of photos) {
            await this.storage.savePhoto(photo)
          }
          this.updateAppStatus(`Data from "${file.name}" imported successfully.`, 'success')

          if (map && map.id) {
            // 1. Reload the internal maps list in App instance
            await this.loadMaps() // Assuming this populates this.mapsList

            // 2. Set the newly imported map as active and load it onto the canvas
            //    'switchToMap' will now find the map in the updated this.mapsList
            await this.switchToMap(map.id)
            console.log('Imported map loaded and set as active.')

            // 3. Refresh the map list in the UI (by showing the modal)
            //    This ensures the map management modal is up-to-date if opened
            await this.showMapManagementModal()
          }

          alert(`Map "${map.name}" and its associated data imported successfully! It is now the active map.`)
        } catch (importError) {
          console.error('App: Error processing imported data:', importError)
          alert(`Error processing imported data: ${importError.message}`)
          this.updateAppStatus('Import failed', 'error')
        }
      }
      reader.onerror = (e) => {
        console.error('App: Error reading file:', e)
        alert('Error reading file.')
        this.updateAppStatus('File read failed', 'error')
      }
      reader.readAsText(file)
    } catch (error) {
      console.error('App: Unexpected error during file import setup:', error)
      alert('Unexpected error during file import setup.')
      this.updateAppStatus('Import setup failed', 'error')
    }
  }

  /**
   * Handles the request to view a full-size photo.
   * Fetches the photo data, creates an Object URL, and displays it in a modal.
   * @param {string} photoId - The ID of the photo to view.
   */
  async handleViewPhoto (photoId) {
    this.showLoading('Loading image...') // Assuming you have showLoading
    try {
      const photo = await this.storage.getPhoto(photoId)
      if (!photo || !photo.imageData) {
        console.error('Photo data not found for ID:', photoId)
        // Replaced showToast with your existing error notification
        this.showErrorMessage('Image Load Error', 'Image data not found.')
        return
      }

      const imageBlob = photo.imageData // Directly use the imageData Blob

      // Revoke any previous object URL to prevent memory leaks
      if (this.currentImageViewerUrl) {
        URL.revokeObjectURL(this.currentImageViewerUrl)
      }

      // Create a new object URL for the image Blob
      this.currentImageViewerUrl = URL.createObjectURL(imageBlob)

      this.modalManager.createImageViewerModal(
        this.currentImageViewerUrl,
        photo.fileName || 'Image', // Use filename as title
        () => {
          // Callback when the image viewer modal closes
          this.updateAppStatus('Image viewer closed.')
          // Revoke the object URL immediately after the modal is closed
          if (this.currentImageViewerUrl) {
            URL.revokeObjectURL(this.currentImageViewerUrl)
            this.currentImageViewerUrl = null
          }
        }
      )
      this.updateAppStatus(`Viewing image: ${photo.fileName}`)
    } catch (error) {
      console.error('Error displaying photo:', error)
      // Replaced showToast with your existing error notification
      this.showErrorMessage('Image Load Error', `Failed to load image: ${error.message}`)
    } finally {
      this.hideLoading() // Assuming you have hideLoading
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
}

// Initialize the app
const app = new ImageMapperApp()

// Make app available globally for debugging
window.imageMapperApp = app
