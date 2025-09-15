/**
 * Image Mapper PWA - Main Application
 * Phase 1A: Basic PWA Foundation
 */

/* global
        alert
        */

class ImageMapperApp {
  constructor () {
    this.isOnline = navigator.onLine
    this.serviceWorkerReady = false

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

      // Initialize app state
      this.updateAppStatus('Ready')

      console.log('Image Mapper App: Initialization complete')
    } catch (error) {
      console.error('Image Mapper App: Initialization failed', error)
      this.updateAppStatus('Error: Initialization failed')
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
     * Add first map (placeholder for Phase 1B)
     */
  addFirstMap () {
    console.log('Add first map clicked - to be implemented in Phase 1B')
    this.updateAppStatus('Map upload - Coming in Phase 1B')

    // Placeholder alert for now
    alert('Map upload feature will be implemented in Phase 1B.\n\nPhase 1A focuses on PWA foundation setup.')
  }

  /**
     * Show map list (placeholder for Phase 1B)
     */
  showMapList () {
    console.log('Map list clicked - to be implemented in Phase 1B')
    this.updateAppStatus('Map management - Coming in Phase 1B')

    // Placeholder alert for now
    alert('Map management features will be implemented in Phase 1B.\n\nThis includes map selection, editing, and deletion.')
  }

  /**
     * Zoom in on map (placeholder for Phase 1C)
     */
  zoomIn () {
    console.log('Zoom in clicked - to be implemented in Phase 1C')
    this.updateAppStatus('Zoom controls - Coming in Phase 1C')
  }

  /**
     * Zoom out on map (placeholder for Phase 1C)
     */
  zoomOut () {
    console.log('Zoom out clicked - to be implemented in Phase 1C')
    this.updateAppStatus('Zoom controls - Coming in Phase 1C')
  }

  /**
     * Close any open modals
     */
  closeModals () {
    console.log('Closing modals')
    // This will be implemented when we add modals in future phases
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
      phase: '1A',
      version: '0.1.0',
      features: ['PWA Foundation', 'Offline Ready', 'Service Worker'],
      upcomingFeatures: ['Map Upload', 'Map Display', 'Pan/Zoom Controls']
    }
  }
}

// Initialize the app
const app = new ImageMapperApp()

// Make app available globally for debugging
window.imageMapperApp = app
