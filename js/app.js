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
      addFirstMapBtn.addEventListener('click', () => this.addFirstMap())
    }

    // Map list button
    const mapListBtn = document.getElementById('btn-map-list')
    if (mapListBtn) {
      mapListBtn.addEventListener('click', () => this.showMapList())
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
          console.log('Service Worker update found')
        })
      } catch (error) {
        console.warn('Service Worker not available', error)
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
      await this.displayMapsList()
    } catch (error) {
      console.error('Error showing map list:', error)
      this.showErrorMessage('Failed to load maps', error.message)
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
          await this.displayMap(activeMap)
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
   * Display maps list (placeholder for full UI implementation)
   */
  async displayMapsList () {
    const stats = await this.storage.getStorageStats()

    let message = `Maps in storage: ${stats.totalMaps}\n`
    message += `Total file size: ${this.formatFileSize(stats.totalFileSize)}\n`
    message += `Active map: ${stats.activeMapId || 'None'}\n\n`

    if (this.mapsList.length > 0) {
      message += 'Maps list:\n'
      this.mapsList.forEach((map, index) => {
        const isActive = map.isActive ? ' [ACTIVE]' : ''
        const hasFile = this.uploadedFiles.has(map.id) ? ' 🖼️' : ' 📄'
        message += `${index + 1}. ${map.name}${isActive}${hasFile}\n`
        message += `   Size: ${this.formatFileSize(map.fileSize)}\n`
        message += `   Created: ${new Date(map.createdDate).toLocaleDateString()}\n\n`
      })

      message += '\n🖼️ = Has image file, 📄 = Metadata only\n'
      message += '\nDevelopment Commands:\n'
      message += '- debugUtils.quickClear() - Clear all maps\n'
      message += '- debugUtils.forceUploadNew() - Clear and upload new\n'
      message += '- debugUtils.addDevButtons() - Add quick buttons to header'
    }

    alert(message)
    this.updateAppStatus('Maps list displayed')
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
   * @param {Object} mapData - Processed map data from FileManager
   * @param {File} file - Original file object
   */
  async handleMapUpload (mapData, file) {
    console.log('Handling map upload:', mapData.name)

    try {
      this.updateAppStatus('Saving map...')

      // If this is set as active, deactivate other maps first
      if (mapData.isActive && this.mapsList.length > 0) {
        console.log('Setting as active map, deactivating others...')
      }

      // Save to storage (without the originalFile and thumbnail for now)
      const storageData = {
        name: mapData.name,
        description: mapData.description,
        fileName: mapData.fileName,
        filePath: mapData.filePath,
        width: mapData.width,
        height: mapData.height,
        fileSize: mapData.fileSize,
        fileType: mapData.fileType,
        isActive: mapData.isActive,
        settings: mapData.settings
      }

      const savedMap = await this.storage.addMap(storageData)
      console.log('Map saved successfully:', savedMap.id)

      // Store file reference for rendering
      this.uploadedFiles.set(savedMap.id, file)

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
        await this.displayMap(savedMap)
      }

      // Show success message
      this.showNotification(`Map "${savedMap.name}" uploaded successfully!`, 'success')
      this.updateAppStatus(`Map uploaded: ${savedMap.name}`)

      console.log('Map upload completed successfully')
    } catch (error) {
      console.error('Map upload failed:', error)
      throw new Error(`Failed to save map: ${error.message}`)
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
   * @param {Object} mapData - Map metadata from storage
   */
  async displayMap (mapData) {
    if (!mapData) {
      console.warn('No map data provided for display')
      return
    }

    try {
      console.log('Displaying map:', mapData.name)
      this.updateAppStatus(`Loading map: ${mapData.name}`)

      // Check if we have the file for this map
      const file = this.uploadedFiles.get(mapData.id)

      if (file) {
        // Load from file
        await this.mapRenderer.loadMap(mapData, file)
        console.log('Map loaded from file successfully')
      } else {
        // Load placeholder for maps without file data
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
