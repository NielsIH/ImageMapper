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
        Image
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

      // Phase 1B: Initialize storage system
      await this.initializeStorage()

      // Load existing maps
      await this.loadMaps()

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
    mapContainer.addEventListener('wheel', (event) => this.handleMapWheel(event))

    // Touch events
    mapContainer.addEventListener('touchstart', (event) => this.handleMapTouchStart(event))
    mapContainer.addEventListener('touchmove', (event) => this.handleMapTouchMove(event))
    mapContainer.addEventListener('touchend', (event) => this.handleMapTouchEnd(event))

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
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready
        this.serviceWorkerReady = true
        console.log('Service Worker ready')

        // Listen for service worker updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // There's a new version available
                console.log('Service Worker: New version available, reloading for update...')
                this.updateAppStatus('Updating app to new version...')

                // Send a message to the new service worker to skip waiting
                // (though skipWaiting is already in sw.js install event, this is a redundant fallback)
                newWorker.postMessage({ type: 'SKIP_WAITING' })

                // Reload the page to apply the update
                // Add a small delay to ensure the SW has taken control
                setTimeout(() => {
                  window.location.reload()
                }, 1000)
              }
            })
          }
        })

        // Listen for controllerchange event, which fires when a new SW takes control
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          console.log('Service Worker: Controller changed, possibly due to update.')
          // If the page hasn't reloaded yet, this will ensure it reloads
          if (!document.hidden) { // Only reload if the tab is visible
            console.log('Reloading page to apply new service worker.')
            window.location.reload()
          } else {
            console.log('Page not visible, not reloading yet. Update will apply on next visit.')
          }
        })
      } catch (error) {
        console.warn('Service Worker not available or failed to register', error)
      }
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
    this.showLoading('Loading map management...', false) // Show loading spinner, don't auto-hide

    try {
      // Ensure maps list is up to date and includes imageData Blobs
      await this.loadMaps()

      // Process maps to generate or retrieve cached thumbnails
      const mapsWithThumbnails = await Promise.all(this.mapsList.map(async (map) => {
        let thumbnailDataUrl = this.thumbnailCache.get(map.id)

        if (!thumbnailDataUrl && map.imageData && map.imageData instanceof Blob) {
          try {
            thumbnailDataUrl = await this.imageProcessor.generateThumbnailDataUrl(map.imageData, 100)
            if (thumbnailDataUrl) {
              this.thumbnailCache.set(map.id, thumbnailDataUrl)
            }
          } catch (thumbError) {
            console.warn(`Failed to generate thumbnail for map ${map.id}:`, thumbError)
            thumbnailDataUrl = null
          }
        } else if (!map.imageData) {
          thumbnailDataUrl = null
        }
        return { ...map, thumbnailDataUrl }
      }))

      const currentActiveMapId = this.currentMap ? this.currentMap.id : null

      this.modalManager.createMapManagementModal( // <<< Call to NEW modal function
        mapsWithThumbnails,
        currentActiveMapId,
        // onMapSelected callback for 'Select' button/item click
        async (mapId) => {
          await this.switchToMap(mapId)
          // After switching map, re-render the modal to update active state
          this.showMapManagementModal() // Re-open modal to show new active map
        },
        // onMapDelete callback for 'Delete' button click
        async (mapId) => {
          await this.deleteMap(mapId) // New delete method to be implemented
        },
        // onAddNewMap callback for '+ Add New Map' button click
        async () => {
          this.showUploadModal() // Call existing upload modal
        },
        // onClose callback for modal close
        () => {
          this.updateAppStatus('Ready')
        },
        // onModalReady callback to hide loading spinner
        () => {
          this.hideLoading()
        }
      )

      this.updateAppStatus('Map management displayed')
    } catch (error) {
      console.error('Error showing map management modal:', error)
      this.showErrorMessage('Failed to open map management', error.message)
      this.hideLoading() // Ensure loading is hidden on error
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
      const willBeEmpty = this.mapsList.length <= 1 // Check if this is the last map

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
      // Re-show map management modal to reflect changes
      await this.showMapManagementModal() // Re-open modal to update map list
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
      this.mapRenderer.zoom(1.2)
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
      this.mapRenderer.zoom(0.8)
      console.log('Zoomed out')
      this.updateAppStatus('Zoomed out')
    } else {
      console.log('No map loaded for zoom')
      this.updateAppStatus('No map to zoom')
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
  // Map Interaction Handlers (Placeholder)
  // ========================================

  handleMapMouseDown (event) {
    // Placeholder for mouse-based map panning (Phase 1C)
    console.log('Map mouse down - to be implemented in Phase 1C')
  }

  handleMapMouseMove (event) {
    // Placeholder for mouse-based map panning (Phase 1C)
  }

  handleMapMouseUp (event) {
    // Placeholder for mouse-based map panning (Phase 1C)
  }

  handleMapWheel (event) {
    // Placeholder for mouse wheel zoom (Phase 1C)
    event.preventDefault()
    console.log('Map wheel - zoom to be implemented in Phase 1C')
  }

  handleMapTouchStart (event) {
    // Placeholder for touch-based map interaction (Phase 1C)
    console.log('Map touch start - to be implemented in Phase 1C')
  }

  handleMapTouchMove (event) {
    // Placeholder for touch-based map panning and pinch zoom (Phase 1C)
    event.preventDefault() // Prevent default scrolling
  }

  handleMapTouchEnd (event) {
    // Placeholder for touch-based map interaction (Phase 1C)
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
   * Display maps list (now uses a dedicated modal)
   */
  async displayMapsList () {
    this.showLoading('Loading maps list...') // Added loading indicator
    await this.loadMaps()

    // --- DEBUG START ---
    console.log('DEBUG: Maps retrieved from storage:', this.mapsList)
    this.mapsList.forEach(map => {
      console.log(`  Map ID: ${map.id}, Name: ${map.name}, has imageData: ${!!map.imageData}, imageData type: ${map.imageData ? map.imageData.constructor.name : 'N/A'}`)
    })
    // --- DEBUG END ---

    // 1. Process maps to generate or retrieve thumbnails
    const mapsWithThumbnails = await Promise.all(this.mapsList.map(async (map) => {
      // Check if a thumbnail is already cached
      let thumbnailDataUrl = this.thumbnailCache.get(map.id)

      if (!thumbnailDataUrl && map.imageData && map.imageData instanceof Blob) {
        // If not cached and map has image data, generate a new thumbnail
        try {
          thumbnailDataUrl = await this.imageProcessor.generateThumbnailDataUrl(map.imageData, 100) // Max dimension 100px
          if (thumbnailDataUrl) {
            this.thumbnailCache.set(map.id, thumbnailDataUrl) // Cache the generated thumbnail
          }
        } catch (thumbError) {
          console.warn(`Failed to generate thumbnail for map ${map.id}:`, thumbError)
          thumbnailDataUrl = null // Fallback to initials
        }
      } else if (!map.imageData) {
        // If map has no image data, ensure no thumbnail is set (will use initials fallback)
        thumbnailDataUrl = null
      }

      // Return a new map object with the thumbnail data URL
      return { ...map, thumbnailDataUrl }
    }))

    const currentActiveMapId = this.currentMap ? this.currentMap.id : null

    try {
      this.modalManager.createMapsListModal(
        mapsWithThumbnails, // Pass the enhanced map list
        currentActiveMapId,
        async (mapId) => {
          // Callback when a map is selected from the list
          await this.switchToMap(mapId)
        },
        () => {
          // Callback when the modal is closed without selection
          this.updateAppStatus('Ready')
        }
      )

      this.updateAppStatus('Maps list displayed')
    } catch (error) {
      console.error('Error showing map list:', error)
      this.showErrorMessage('Failed to load maps', error.message)
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
        maxWidth: 1920, // Max width for storing
        maxHeight: 1920, // Max height for storing
        quality: 0.8, // 80% JPEG quality
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
   */
  async displayMap (mapData) {
    if (!mapData) {
      console.warn('No map data provided for display')
      return
    }

    try {
      console.log('Displaying map:', mapData.name)
      this.updateAppStatus(`Loading map: ${mapData.name}`)

      // Check if we have the file blob for this map in memory (from current session)
      let imageBlob = this.uploadedFiles.get(mapData.id)

      if (!imageBlob && mapData.imageData) {
        // If not in memory, try to get it from mapData.imageData (loaded from IndexedDB)
        imageBlob = mapData.imageData
        console.log('Displaying map: Loaded image data from storage.')
        // Optionally, store in uploadedFiles for current session's faster access
        this.uploadedFiles.set(mapData.id, imageBlob)
      }

      if (imageBlob && imageBlob instanceof Blob) {
        // Load from Blob
        await this.mapRenderer.loadMap(mapData, imageBlob) // MapRenderer needs to handle Blob
        console.log('Map loaded from Blob successfully')
      } else {
        // Load placeholder for maps without *storable* image data
        await this.mapRenderer.loadPlaceholder(mapData)
        console.log('Map placeholder loaded')
      }

      this.currentMap = mapData
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
