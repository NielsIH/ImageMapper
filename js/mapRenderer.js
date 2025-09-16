/**
 * Image Mapper PWA - Map Rendering System
 * Phase 1B: Canvas-based map display and rendering
 */

/**
 * Map Renderer for displaying uploaded maps on canvas
 */

/* global console, document, window, Image, URL */
class MapRenderer {
  constructor (canvasId) {
    this.canvas = document.getElementById(canvasId)
    this.ctx = this.canvas.getContext('2d')
    this.currentMap = null
    this.imageData = null
    this.scale = 1
    this.offsetX = 0
    this.offsetY = 0
    this.maxScale = 5
    this.minScale = 0.1
    this.showDebugInfo = false // Ensure this is initialized

    // Setup canvas immediately if container is visible
    if (this.canvas.offsetParent !== null) {
      this.setupCanvas()
    }
    this.setupResizeHandler()
  }

  /**
   * Initialize canvas setup
   */
  setupCanvas () {
    if (!this.canvas) {
      console.error('MapRenderer: Canvas element not found')
      return
    }
    // Only apply image smoothing here, actual resizing done in loadMap/resizeHandler
    if (this.ctx) {
      this.ctx.imageSmoothingEnabled = true
      this.ctx.imageSmoothingQuality = 'high'
    }
    console.log('MapRenderer: Canvas basic context initialized.')
  }

  /**
   * Set up window resize handler
   */
  setupResizeHandler () {
    let resizeTimeout
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout)
      resizeTimeout = setTimeout(() => {
        this.resizeCanvas()
        this.render()
      }, 250)
    })
  }

  /**
   * Resize canvas to fill container
   */
  resizeCanvas () {
    if (!this.canvas) return

    const container = this.canvas.parentElement
    if (!container || container.offsetParent === null) {
      console.warn('MapRenderer: Container not visible, deferring canvas resize')
      return false // Container not visible yet
    }

    const rect = container.getBoundingClientRect()

    console.log('MapRenderer: resizeCanvas - Parent container rect:', rect)
    console.log(`  Initial canvas attributes: ${this.canvas.width}x${this.canvas.height}`)

    // Use clientWidth/clientHeight as they represent the rendered size of the element
    // Math.max to avoid 0 if container is still not laid out properly
    const width = Math.max(container.clientWidth || rect.width, 100)
    const height = Math.max(container.clientHeight || rect.height, 100)

    // Only resize if dimensions have actually changed significantly
    // Compare against the elements' actual current pixel size
    if (this.canvas.width === width && this.canvas.height === height) {
      console.log('MapRenderer: Canvas attributes unchanged.')
      return // Avoid unnecessary redraws if size is the same
    }

    // Set canvas size to container size
    this.canvas.width = width
    this.canvas.height = height

    // Update canvas display size (CSS sizing)
    this.canvas.style.width = width + 'px'
    this.canvas.style.height = height + 'px'

    console.log(`MapRenderer: Canvas attributes set to ${this.canvas.width}x${this.canvas.height}`)
    return true // Successfully resized
  }

  /**
   * Load and display a map
   * @param {Object} mapData - Map metadata from storage
   * @param {File|Blob} imageSource - File object or Blob
   */
  async loadMap (mapData, imageSource) { // imageSource can be File or Blob
    try {
      console.log('MapRenderer: Loading map:', mapData.name)

      this.currentMap = mapData

      if (!(imageSource instanceof File) && !(imageSource instanceof Blob)) {
        throw new Error('Invalid image source: must be File or Blob object.')
      }

      // If there was a previous image, revoke its URL to free memory
      if (this.imageData && this.imageData.src && this.imageData.src.startsWith('blob:')) {
        URL.revokeObjectURL(this.imageData.src)
      }

      // Create image element
      const img = new Image()

      return new Promise((resolve, reject) => {
        const imageUrl = URL.createObjectURL(imageSource)
        console.log('MapRenderer: Created object URL for imageSource:', imageUrl)

        img.onload = () => {
          console.log('MapRenderer: Image loaded successfully into Image object')
          URL.revokeObjectURL(imageUrl) // Clean up the object URL immediately after image is loaded
          this.imageData = img

          // Ensure canvas is properly sized BEFORE fitting/rendering
          this.resizeCanvas() // Important: make sure container CSS is applied
          this.fitToScreen() // Important: recalculate scale and offset
          this.render() // Draw the image

          resolve()
        }

        img.onerror = () => {
          console.error('MapRenderer: Failed to load image from imageSource')
          URL.revokeObjectURL(imageUrl) // Clean up on error too
          reject(new Error('Failed to load map image'))
        }

        img.src = imageUrl
      })
    } catch (error) {
      console.error('MapRenderer: Error loading map:', error)
      throw error
    }
  }

  /**
   * Create a placeholder image for maps without file data
   * @param {Object} mapData - Map metadata
   */
  async loadPlaceholder (mapData) {
    try {
      console.log('MapRenderer: Loading placeholder for:', mapData.name)

      this.currentMap = mapData
      this.imageData = null

      // Render placeholder
      this.renderPlaceholder()
    } catch (error) {
      console.error('MapRenderer: Error loading placeholder:', error)
      throw error
    }
  }

  /**
   * Calculate scale and position to fit image to screen
   */
  fitToScreen () {
    if (!this.imageData || !this.canvas) {
      console.warn('MapRenderer: Cannot fit to screen - missing image data or canvas')
      return
    }

    const canvasWidth = this.canvas.width
    const canvasHeight = this.canvas.height
    const imageWidth = this.imageData.naturalWidth || this.imageData.width
    const imageHeight = this.imageData.naturalHeight || this.imageData.height

    console.log('MapRenderer: Fit to screen calculations:')
    console.log(`  Canvas: ${canvasWidth}x${canvasHeight}`)
    console.log(`  Image: ${imageWidth}x${imageHeight}`)

    // Validate dimensions
    if (canvasWidth <= 0 || canvasHeight <= 0 || imageWidth <= 0 || imageHeight <= 0) {
      console.error('MapRenderer: Invalid dimensions for fit calculation')
      this.scale = 1
      this.offsetX = 0
      this.offsetY = 0
      return
    }

    // Calculate scale to fit image in canvas
    const scaleX = canvasWidth / imageWidth
    const scaleY = canvasHeight / imageHeight
    this.scale = Math.min(scaleX, scaleY, 1) // Don't scale up beyond 100%

    // Ensure minimum scale
    this.scale = Math.max(this.scale, 0.01)

    // Center the image
    this.offsetX = (canvasWidth - imageWidth * this.scale) / 2
    this.offsetY = (canvasHeight - imageHeight * this.scale) / 2

    console.log(`MapRenderer: Fit to screen - scale: ${this.scale.toFixed(3)}, offset: ${this.offsetX.toFixed(0)}, ${this.offsetY.toFixed(0)}`)
  }

  /**
   * Render the current map on canvas
   */
  render () {
    if (!this.canvas || !this.ctx) return

    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)

    if (this.imageData) {
      // Render the map image
      this.renderImage()
    } else if (this.currentMap) {
      // Render placeholder
      this.renderPlaceholder()
    } else {
      // Render empty state
      this.renderEmptyState()
    }
  }

  /**
   * Render the map image
   */
  renderImage () {
    if (!this.imageData) return

    const imageWidth = this.imageData.naturalWidth * this.scale
    const imageHeight = this.imageData.naturalHeight * this.scale

    // Draw image
    this.ctx.drawImage(
      this.imageData,
      this.offsetX,
      this.offsetY,
      imageWidth,
      imageHeight
    )

    // Draw debug info (optional)
    if (this.showDebugInfo) {
      this.renderDebugInfo()
    }
  }

  /**
   * Render placeholder for maps without image data
   */
  renderPlaceholder () {
    const centerX = this.canvas.width / 2
    const centerY = this.canvas.height / 2

    // Draw background
    this.ctx.fillStyle = '#f8fafc'
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)

    // Draw border
    this.ctx.strokeStyle = '#e2e8f0'
    this.ctx.lineWidth = 2
    this.ctx.setLineDash([10, 10])
    this.ctx.strokeRect(20, 20, this.canvas.width - 40, this.canvas.height - 40)
    this.ctx.setLineDash([])

    // Draw icon
    this.ctx.font = '48px sans-serif'
    this.ctx.fillStyle = '#64748b'
    this.ctx.textAlign = 'center'
    this.ctx.textBaseline = 'middle'
    this.ctx.fillText('🗺️', centerX, centerY - 40)

    // Draw map name
    this.ctx.font = '20px sans-serif'
    this.ctx.fillStyle = '#0f172a'
    this.ctx.fillText(this.currentMap.name, centerX, centerY + 20)

    // Draw dimensions
    this.ctx.font = '14px sans-serif'
    this.ctx.fillStyle = '#64748b'
    this.ctx.fillText(
      `${this.currentMap.width} × ${this.currentMap.height} pixels`,
      centerX,
      centerY + 45
    )

    // Draw file info
    // this.ctx.fillText(
    //   `${this.currentMap.fileName} (${this.formatFileSize(this.currentMap.fileSize)})`,
    //   centerX,
    //   centerY + 65
    // )
  }

  /**
   * Render empty state when no map is loaded
   */
  renderEmptyState () {
    const centerX = this.canvas.width / 2
    const centerY = this.canvas.height / 2

    // Draw background
    this.ctx.fillStyle = '#f0f0f0'
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)

    // Draw message
    this.ctx.font = '18px sans-serif'
    this.ctx.fillStyle = '#64748b'
    this.ctx.textAlign = 'center'
    this.ctx.textBaseline = 'middle'
    this.ctx.fillText('No map loaded', centerX, centerY - 10)
    this.ctx.fillText('Upload a map to get started', centerX, centerY + 15)
  }

  /**
   * Render debug information overlay
   */
  renderDebugInfo () {
    const padding = 10
    const lineHeight = 16
    let y = padding + lineHeight

    this.ctx.font = '12px monospace'
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
    this.ctx.textAlign = 'left'
    this.ctx.textBaseline = 'top'

    const info = [
      `Scale: ${this.scale.toFixed(3)}`,
      `Offset: ${this.offsetX.toFixed(0)}, ${this.offsetY.toFixed(0)}`,
      `Canvas: ${this.canvas.width}×${this.canvas.height}`,
      `Image: ${this.imageData.naturalWidth}×${this.imageData.naturalHeight}`,
      `Rendered: ${(this.imageData.naturalWidth * this.scale).toFixed(0)}×${(this.imageData.naturalHeight * this.scale).toFixed(0)}`
    ]

    info.forEach(line => {
      this.ctx.fillText(line, padding, y)
      y += lineHeight
    })
  }

  /**
   * Get current map bounds for coordinate calculations
   */
  getMapBounds () {
    if (!this.imageData) return null

    return {
      x: this.offsetX,
      y: this.offsetY,
      width: this.imageData.naturalWidth * this.scale,
      height: this.imageData.naturalHeight * this.scale,
      scale: this.scale
    }
  }

  /**
   * Convert screen coordinates to map coordinates
   * @param {number} screenX - Screen X coordinate
   * @param {number} screenY - Screen Y coordinate
   * @returns {Object} Map coordinates
   */
  screenToMap (screenX, screenY) {
    if (!this.imageData) return null

    const mapX = (screenX - this.offsetX) / this.scale
    const mapY = (screenY - this.offsetY) / this.scale

    return { x: mapX, y: mapY }
  }

  /**
   * Convert map coordinates to screen coordinates
   * @param {number} mapX - Map X coordinate
   * @param {number} mapY - Map Y coordinate
   * @returns {Object} Screen coordinates
   */
  mapToScreen (mapX, mapY) {
    if (!this.imageData) return null

    const screenX = mapX * this.scale + this.offsetX
    const screenY = mapY * this.scale + this.offsetY

    return { x: screenX, y: screenY }
  }

  /**
   * Zoom in/out by a factor
   * @param {number} factor - Zoom factor (e.g., 1.2 for 20% zoom in)
   * @param {number} centerX - Zoom center X (optional)
   * @param {number} centerY - Zoom center Y (optional)
   */
  zoom (factor, centerX = null, centerY = null) {
    if (!this.imageData) return

    const oldScale = this.scale
    const newScale = Math.max(this.minScale, Math.min(this.maxScale, this.scale * factor))

    if (newScale === this.scale) return // No change

    // Use canvas center if no center specified
    const zoomCenterX = centerX !== null ? centerX : this.canvas.width / 2
    const zoomCenterY = centerY !== null ? centerY : this.canvas.height / 2

    // Calculate new offset to zoom around the specified point
    const scaleDiff = newScale / oldScale
    this.offsetX = zoomCenterX - (zoomCenterX - this.offsetX) * scaleDiff
    this.offsetY = zoomCenterY - (zoomCenterY - this.offsetY) * scaleDiff
    this.scale = newScale

    console.log(`MapRenderer: Zoomed to ${this.scale.toFixed(3)}x`)
    this.render()
  }

  /**
   * Pan the map by a delta
   * @param {number} deltaX - X offset change
   * @param {number} deltaY - Y offset change
   */
  pan (deltaX, deltaY) {
    this.offsetX += deltaX
    this.offsetY += deltaY
    this.render()
  }

  /**
   * Reset view to fit screen
   */
  resetView () {
    this.fitToScreen()
    this.render()
    console.log('MapRenderer: View reset to fit screen')
  }

  /**
   * Get current view state
   */
  getViewState () {
    return {
      scale: this.scale,
      offsetX: this.offsetX,
      offsetY: this.offsetY,
      mapId: this.currentMap ? this.currentMap.id : null
    }
  }

  /**
   * Set view state
   * @param {Object} state - View state object
   */
  setViewState (state) {
    if (state.scale !== undefined) this.scale = state.scale
    if (state.offsetX !== undefined) this.offsetX = state.offsetX
    if (state.offsetY !== undefined) this.offsetY = state.offsetY
    this.render()
  }

  /**
   * Toggle debug info display
   */
  toggleDebugInfo () {
    this.showDebugInfo = !this.showDebugInfo
    this.render()
    console.log('MapRenderer: Debug info', this.showDebugInfo ? 'enabled' : 'disabled')
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
   * Clean up resources
   */
  dispose () {
  // Clean up any object URLs or resources
  // Check if imageData exists and if its src is a blob URL before revoking
    if (this.imageData && this.imageData.src && this.imageData.src.startsWith('blob:')) {
      URL.revokeObjectURL(this.imageData.src)
    }

    this.imageData = null
    this.currentMap = null

    console.log('MapRenderer: Resources cleaned up')
  }
}

// Export for use in other modules
window.MapRenderer = MapRenderer
