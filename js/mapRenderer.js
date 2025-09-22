/**
 * Image Mapper PWA - Map Rendering System
 */

/* global console, document, window, Image, URL */
class MapRenderer {
  constructor (canvasId) {
    this.canvas = document.getElementById(canvasId)
    this.ctx = this.canvas.getContext('2d')
    this.currentMap = null
    // this.imageData will now hold an HTMLCanvasElement (the rotated bitmap)
    this.imageData = null
    // this.originalImageData holds the original (unrotated) HTMLImageElement reference
    this.originalImageData = null
    this.scale = 1
    this.offsetX = 0
    this.offsetY = 0
    this.maxScale = 5
    this.minScale = 0.1
    this.showDebugInfo = false
    this.markers = []
    this.showCrosshair = false
    this.markersAreEditable = false

    // Map Rotation -- This is the actual rotation angle applied to the *image bitmap*
    this.currentMapRotation = 0 // Stored rotation in degrees (0, 90, 180, 270)

    // Marker size settings
    this.markerSizeSettings = {
      normal: { radius: 12, fontSizeFactor: 1.0 },
      large: { radius: 18, fontSizeFactor: 1.2 },
      extraLarge: { radius: 24, fontSizeFactor: 1.4 }
    }
    this.markerCurrentDisplaySizeKey = 'normal' // Default size

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
    if (this.ctx) {
      this.ctx.imageSmoothingEnabled = true
      this.ctx.imageSmoothingQuality = 'high'
    }
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
      console.warn('MapRenderer: resizeCanvas - Container not visible or element not in DOM yet.')
      return false // Container not visible yet
    }

    const rect = container.getBoundingClientRect()

    const width = Math.max(container.clientWidth || rect.width, 100)
    const height = Math.max(container.clientHeight || rect.height, 100)

    // NEW LOG:
    console.log(`MapRenderer: resizeCanvas - Calculated dimensions: ${width}x${height} from parent (clientWidth: ${container.clientWidth}, rect.width: ${rect.width}).`)

    if (this.canvas.width === width && this.canvas.height === height) {
      console.log('MapRenderer: resizeCanvas - Canvas already correct size.')
      return // Avoid unnecessary redraws if size is the same
    }

    this.canvas.width = width
    this.canvas.height = height

    this.canvas.style.width = width + 'px'
    this.canvas.style.height = height + 'px'

    // NEW LOG:
    console.log(`MapRenderer: resizeCanvas - Canvas set to: ${this.canvas.width}x${this.canvas.height}.`)
  }

  /**
   * Helper to create a rotated version of an image on an offscreen canvas.
   * This offscreen canvas is then used as `this.imageData`.
   * @param {HTMLImageElement} img - The original (unrotated) HTMLImageElement.
   * @param {number} degrees - Rotation angle (0, 90, 180, 270) clockwise.
   * @returns {HTMLCanvasElement} A new canvas containing the rotated image.
   */
  _getRotatedImageCanvas (img, degrees) {
    const offscreenCanvas = document.createElement('canvas')
    const offscreenCtx = offscreenCanvas.getContext('2d')

    const width = img.naturalWidth
    const height = img.naturalHeight

    let rotatedCanvasWidth = width
    let rotatedCanvasHeight = height

    if (degrees === 90 || degrees === 270) {
      rotatedCanvasWidth = height
      rotatedCanvasHeight = width
    }

    offscreenCanvas.width = rotatedCanvasWidth
    offscreenCanvas.height = rotatedCanvasHeight

    offscreenCtx.save()
    // Translate to the center of the offscreen canvas, rotate, then draw original image
    offscreenCtx.translate(rotatedCanvasWidth / 2, rotatedCanvasHeight / 2)
    offscreenCtx.rotate(degrees * Math.PI / 180)
    offscreenCtx.drawImage(img, -width / 2, -height / 2) // Draw original image centered inside rotated context
    offscreenCtx.restore()

    return offscreenCanvas
  }

  /**
   * Load and display a map
   * @param {Object} mapData - Map metadata from storage
   * @param {File|Blob} imageSource - File object or Blob
   * MODIFIED: Store original image reference and create rotated bitmap.
   */
  async loadMap (mapData, imageSource) {
    try {
      this.currentMap = mapData

      if (!(imageSource instanceof File) && !(imageSource instanceof Blob)) {
        throw new Error('Invalid image source: must be File or Blob object.')
      }

      // Clean up previous image data object URL if it was a Blob
      if (this.originalImageData && this.originalImageData.src && this.originalImageData.src.startsWith('blob:')) {
        URL.revokeObjectURL(this.originalImageData.src)
      }

      return new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => {
          this.originalImageData = img // Store reference to original Image object (unrotated)

          // Create the initial rotated bitmap using the currentMapRotation setting
          this.imageData = this._getRotatedImageCanvas(this.originalImageData, this.currentMapRotation)

          this.resizeCanvas()
          this.fitToScreen()
          this.render()

          resolve()
        }

        img.onerror = () => {
          reject(new Error('Failed to load map image'))
        }
        img.src = URL.createObjectURL(imageSource) // img.src uses Blob URL
      })
    } catch (error) {
      console.error('MapRenderer: Error loading map:', error)
      throw error
    }
  }

  /**
   * Create a placeholder image for maps without file data
   * @param {Object} mapData - Map metadata
   * MODIFIED: Clear originalImageData when loading placeholder.
   */
  async loadPlaceholder (mapData) {
    try {
      this.currentMap = mapData
      this.imageData = null // Clear the rotated bitmap (canvas element)
      this.originalImageData = null // Clear original image reference
      this.markers = [] // Clear markers for placeholder

      this.render()
    } catch (error) {
      console.error('MapRenderer: Error loading placeholder:', error)
      throw error
    }
  }

  /**
   * Calculate scale and position to fit image to screen.
   * MODIFIED: Uses this.imageData.width/height directly (as it's already rotated).
   */
  fitToScreen () {
    if (!this.imageData || !this.canvas) {
      console.warn('MapRenderer: fitToScreen - No image data or canvas. Skipping.')
      return
    }

    const canvasWidth = this.canvas.width
    const canvasHeight = this.canvas.height
    // Dimensions are directly from the (potentially rotated) imageData canvas
    const effectiveContentWidth = this.imageData.width
    const effectiveContentHeight = this.imageData.height

    // NEW LOG:\n
    console.log(`MapRenderer: fitToScreen - Canvas: ${canvasWidth}x${canvasHeight}, Image: ${effectiveContentWidth}x${effectiveContentHeight}.`)

    if (canvasWidth <= 0 || canvasHeight <= 0 || effectiveContentWidth <= 0 || effectiveContentHeight <= 0) {
      this.scale = 1
      this.offsetX = 0
      this.offsetY = 0
      console.warn('MapRenderer: fitToScreen - Invalid dimensions (0 or less). Resetting scale/offset.')
      return
    }

    const scaleX = canvasWidth / effectiveContentWidth
    const scaleY = canvasHeight / effectiveContentHeight
    this.scale = Math.min(scaleX, scaleY, 1)

    this.scale = Math.max(this.scale, this.minScale)

    // Calculate offsets based on current bitmap dimensions
    this.offsetX = (canvasWidth - effectiveContentWidth * this.scale) / 2
    this.offsetY = (canvasHeight - effectiveContentHeight * this.scale) / 2
  }

  /**
   * Render the current map on canvas.
   * MODIFIED: Simplified as imageData is an already rotated HTMLCanvasElement.
   */
  render () {
    if (!this.canvas || !this.ctx) return

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)

    if (this.imageData) {
      this.renderImage()
      this.renderMarkers()
    } else if (this.currentMap) {
      this.renderPlaceholder()
    } else {
      this.renderEmptyState()
    }

    if (this.showCrosshair) {
      this.drawCrosshair()
    }
    if (this.showDebugInfo) {
      this.renderDebugInfo()
    }
  }

  /**
   * Render the map image.
   * MODIFIED: Simplified to draw the already rotated imageData (HTMLCanvasElement).
   */
  renderImage () {
    if (!this.imageData) return

    this.ctx.drawImage(
      this.imageData,
      this.offsetX,
      this.offsetY,
      this.imageData.width * this.scale,
      this.imageData.height * this.scale
    )
  }

  /**
   * Render placeholder for maps without image data
   */
  renderPlaceholder () {
    const centerX = this.canvas.width / 2
    const centerY = this.canvas.height / 2

    this.ctx.fillStyle = '#f8fafc'
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)

    this.ctx.strokeStyle = '#e2e8f0'
    this.ctx.lineWidth = 2
    this.ctx.setLineDash([10, 10])
    this.ctx.strokeRect(20, 20, this.canvas.width - 40, this.canvas.height - 40)
    this.ctx.setLineDash([])

    this.ctx.font = '48px sans-serif'
    this.ctx.fillStyle = '#64748b'
    this.ctx.textAlign = 'center'
    this.ctx.textBaseline = 'middle'
    this.ctx.fillText('🗺️', centerX, centerY - 40)

    this.ctx.font = '20px sans-serif'
    this.ctx.fillStyle = '#0f172a'
    this.ctx.fillText(this.currentMap.name, centerX, centerY + 20)

    this.ctx.font = '14px sans-serif'
    this.ctx.fillStyle = '#64748b'
    this.ctx.fillText(
      `${this.currentMap.width} × ${this.currentMap.height} pixels`,
      centerX,
      centerY + 45
    )
  }

  /**
   * Render empty state when no map is loaded
   */
  renderEmptyState () {
    const centerX = this.canvas.width / 2
    const centerY = this.canvas.height / 2

    this.ctx.fillStyle = '#f0f0f0'
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)

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
      `Canvas: ${this.canvas.width}×${this.canvas.height}`
    ]
    if (this.imageData) {
      info.push(
        `Image: ${this.imageData.width}x${this.imageData.height}`, // Use imageData.width/height directly
        `Rendered: ${(this.imageData.width * this.scale).toFixed(0)}x${(this.imageData.height * this.scale).toFixed(0)}`,
        `Rotation: ${this.currentMapRotation}°` // Use currentMapRotation
      )
    }
    info.push(`Markers: ${this.markers.length}`)

    info.forEach(line => {
      this.ctx.fillText(line, padding, y)
      y += lineHeight
    })
  }

  /**
   * Draw a crosshair at the center of the canvas.
   */
  drawCrosshair () {
    const centerX = this.canvas.width / 2
    const centerY = this.canvas.height / 2
    const crosshairSize = 15 // Length of each arm of the cross
    const crosshairThickness = 1
    const crosshairColor = 'rgba(255, 0, 0, 0.7)' // Semi-transparent red

    this.ctx.save()

    this.ctx.strokeStyle = crosshairColor
    this.ctx.lineWidth = crosshairThickness

    // Horizontal line
    this.ctx.beginPath()
    this.ctx.moveTo(centerX - crosshairSize, centerY)
    this.ctx.lineTo(centerX + crosshairSize, centerY)
    this.ctx.stroke()

    // Vertical line
    this.ctx.beginPath()
    this.ctx.moveTo(centerX, centerY - crosshairSize)
    this.ctx.lineTo(centerX, centerY + crosshairSize)
    this.ctx.stroke()

    this.ctx.restore()
  }

  /**
   * Toggle the visibility of the crosshair.
   * @param {boolean} visible - Whether the crosshair should be visible.
   */
  toggleCrosshair (visible) {
    this.showCrosshair = visible
    this.render() // Re-render to show/hide the crosshair
  }

  /**
   * NEW: Set the map's current rotation. This will re-render the image with the new rotation.
   * @param {number} degrees - The new rotation angle (0, 90, 180, 270).
   */
  setMapRotation (degrees) {
    const validDegrees = [0, 90, 180, 270]
    if (!validDegrees.includes(degrees)) {
      console.warn('MapRenderer: Invalid rotation degrees:', degrees, '. Must be 0, 90, 180, or 270.')
      return
    }

    // Only apply if there's an original image and the rotation is actually changing
    if (this.originalImageData && this.currentMapRotation !== degrees) {
      this.currentMapRotation = degrees
      // Re-create the rotated image bitmap from the original image data
      this.imageData = this._getRotatedImageCanvas(this.originalImageData, this.currentMapRotation)

      this.resizeCanvas() // Ensure canvas is resized if needed
      this.fitToScreen() // Re-fit because dimensions of imageData might have changed
      this.render() // Redraw everything
    } else if (this.originalImageData && this.currentMapRotation === degrees) {
      // Rotation unchanged, but still force a render if original image data exists
      // This handles cases where `setMapRotation` might be called externally
      // without other explicit renders, e.g., on initial app load for a map
      this.render()
    } else if (!this.originalImageData) {
      // If no image is loaded, just update the property, it will be applied once an image loads
      this.currentMapRotation = degrees // Still update, even if no image is present
      console.warn('MapRenderer: Cannot immediately set rotation, no original image data loaded.')
    }
  }

  /**
   * Get current map bounds for coordinate calculations
   */
  getMapBounds () {
    if (!this.imageData) return null
    return {
      x: this.offsetX,
      y: this.offsetY,
      width: this.imageData.width * this.scale, // Use imageData.width
      height: this.imageData.height * this.scale, // Use imageData.height
      scale: this.scale
    }
  }

  /**
   * Convert screen coordinates to map coordinates.
   * MODIFIED: Simplified - operates directly on the already rotated imageData.
   * @param {number} screenX - Screen X coordinate (raw canvas pixel)
   * @param {number} screenY - Screen Y coordinate (raw canvas pixel)
   * @returns {Object} Map coordinates (x,y relative to top-left of the original, unrotated image)
   */
  screenToMap (screenX, screenY) {
    if (!this.imageData || !this.originalImageData) return null

    // First convert screen coords to coords on the *rotated* image bitmap (imageData.width/height)
    const rotatedMapX = (screenX - this.offsetX) / this.scale
    const rotatedMapY = (screenY - this.offsetY) / this.scale

    // Now convert from *rotated* map coords back to *original* map coords
    let mapX, mapY
    const originalWidth = this.originalImageData.naturalWidth
    const originalHeight = this.originalImageData.naturalHeight

    switch (this.currentMapRotation) {
      case 0:
        mapX = rotatedMapX
        mapY = rotatedMapY
        break
      case 90: // Original (x,y) -> Rotated (OriginalHeight - y, x)
        mapX = rotatedMapY
        mapY = originalWidth - rotatedMapX
        break
      case 180: // Original (x,y) -> Rotated (OriginalWidth - x, OriginalHeight - y)
        mapX = originalWidth - rotatedMapX
        mapY = originalHeight - rotatedMapY
        break
      case 270: // Original (x,y) -> Rotated (y, OriginalWidth - x)
        mapX = originalHeight - rotatedMapY
        mapY = rotatedMapX
        break
      default:
        // Should not happen, but default to simple conversion
        mapX = rotatedMapX
        mapY = rotatedMapY
    }

    return { x: mapX, y: mapY }
  }

  /**
   * Convert map coordinates to screen coordinates.
   * MODIFIED: Simplified - operates directly on the already rotated imageData.
   * @param {number} mapX - Map X coordinate (x,y relative to top-left of the original, unrotated image)
   * @param {number} mapY - Map Y coordinate (x,y relative to top-left of the original, unrotated image)
   * @returns {Object} Screen coordinates (raw canvas pixel)
   */
  mapToScreen (mapX, mapY) {
    if (!this.imageData || !this.originalImageData) return null

    // First convert from *original* map coords to *rotated* map coords
    let rotatedMapX, rotatedMapY
    const originalWidth = this.originalImageData.naturalWidth
    const originalHeight = this.originalImageData.naturalHeight

    switch (this.currentMapRotation) {
      case 0:
        rotatedMapX = mapX
        rotatedMapY = mapY
        break
      case 90: // Original (x,y) -> Rotated (OriginalHeight - y, x)
        rotatedMapX = originalHeight - mapY
        rotatedMapY = mapX
        break
      case 180: // Original (x,y) -> Rotated (OriginalWidth - x, OriginalHeight - y)
        rotatedMapX = originalWidth - mapX
        rotatedMapY = originalHeight - mapY
        break
      case 270: // Original (x,y) -> Rotated (y, OriginalWidth - x)
        rotatedMapX = mapY
        rotatedMapY = originalWidth - mapX
        break
      default:
        // Should not happen, but default to simple conversion
        rotatedMapX = mapX
        rotatedMapY = mapY
    }

    // Now convert rotated map coords to screen coords
    const screenX = rotatedMapX * this.scale + this.offsetX
    const screenY = rotatedMapY * this.scale + this.offsetY

    return { x: screenX, y: screenY }
  }

  /**
   * Converts a screen-space vector (deltaX, deltaY) into a map-space vector,
   * accounting for current rotation and scale.
   * This is useful for drag operations where the movement on screen
   * needs to be translated to movement on the original unrotated map.
   * @param {number} deltaScreenX - The change in X in screen coordinates.
   * @param {number} deltaScreenY - The change in Y in screen coordinates.
   * @returns {{mapDeltaX: number, mapDeltaY: number}} The corresponding change in map coordinates.
   */
  screenVectorToMapVector (deltaScreenX, deltaScreenY) {
    // First, convert screen deltas to deltas on the *rotated* image bitmap (imageData.width/height)
    const rotatedMapDeltaX = deltaScreenX / this.scale
    const rotatedMapDeltaY = deltaScreenY / this.scale

    let mapDeltaX, mapDeltaY

    // Now convert these deltas from *rotated* map space back to *original* map space
    switch (this.currentMapRotation) {
      case 0:
        mapDeltaX = rotatedMapDeltaX
        mapDeltaY = rotatedMapDeltaY
        break
      case 90:
        // A movement right on screen (+deltaScreenX) was a movement down on original map (+mapDeltaY)
        // A movement down on screen (+deltaScreenY) was a movement left on original map (-mapDeltaX)
        mapDeltaX = rotatedMapDeltaY
        mapDeltaY = -rotatedMapDeltaX
        break
      case 180:
        // A movement right on screen (+deltaScreenX) was a movement left on original map (-mapDeltaX)
        // A movement down on screen (+deltaScreenY) was a movement up on original map (-mapDeltaY)
        mapDeltaX = -rotatedMapDeltaX
        mapDeltaY = -rotatedMapDeltaY
        break
      case 270:
        // A movement right on screen (+deltaScreenX) was a movement up on original map (-mapDeltaY)
        // A movement down on screen (+deltaScreenY) was a movement right on original map (+mapDeltaX)
        mapDeltaX = -rotatedMapDeltaY
        mapDeltaY = rotatedMapDeltaX
        break
      default:
        mapDeltaX = rotatedMapDeltaX
        mapDeltaY = rotatedMapDeltaY
    }
    return { mapDeltaX, mapDeltaY }
  }

  /**
   * Zoom in/out by a factor or to a specific scale.
   * @param {number} factor - Zoom factor (e.g., 1.2 for 20% zoom in) OR
   *                          If newScaleValue is provided, this acts as the factor to multiply current scale by.
   * @param {number} centerX - Zoom center X (optional)
   * @param {number} centerY - Zoom center Y (optional)
   * @param {number} [newScaleValue] - Optional. If provided, zoom directly to this scale.
   */
  zoom (factor, centerX = null, centerY = null, newScaleValue = null) {
    if (!this.imageData) return

    const oldScale = this.scale
    let newScale

    if (newScaleValue !== null) {
      newScale = newScaleValue
    } else {
      newScale = this.scale * factor
    }

    newScale = Math.max(this.minScale, Math.min(this.maxScale, newScale))

    if (newScale === this.scale) return // No change

    // Use canvas center if no center specified
    const zoomCenterX = centerX !== null ? centerX : this.canvas.width / 2
    const zoomCenterY = centerY !== null ? centerY : this.canvas.height / 2

    // Calculate new offset to zoom around the specified point
    const scaleDiff = newScale / oldScale
    this.offsetX = zoomCenterX - (zoomCenterX - this.offsetX) * scaleDiff
    this.offsetY = zoomCenterY - (zoomCenterY - this.offsetY) * scaleDiff
    this.scale = newScale

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
   * Set the markers to be rendered.
   * @param {Array} markersArray - An array of marker objects.
   */
  setMarkers (markersArray) {
    this.markers = markersArray || []
    // No immediate render call here, as app.js will call render after setting markers.
    // This avoids redundant renders if multiple state changes happen together.
  }

  /**
   * Render all current markers on the canvas.
   */
  renderMarkers () {
    if (!this.markers || this.markers.length === 0) return

    this.markers.forEach((marker, index) => {
      // Convert original map (image) coordinates to screen (canvas) coordinates
      // using the updated mapToScreen which handles current rotation
      const screenCoords = this.mapToScreen(marker.x, marker.y)
      if (
        screenCoords &&
        screenCoords.x > -20 && screenCoords.x < this.canvas.width + 20 &&
        screenCoords.y > -20 && screenCoords.y < this.canvas.height + 20
      ) {
        // Pass the editable state AND hasPhotos status to drawMarker
        // Use marker.hasPhotos (already boolean thanks to app.js's preparation)
        this.drawMarker(screenCoords.x, screenCoords.y, index + 1, this.markersAreEditable, marker.hasPhotos)
      }
    })
  }

  /**
   * Set whether markers should be rendered as editable.
   * @param {boolean} editable - True if markers should appear editable (unlocked), false otherwise (locked).
   */
  setMarkersEditable (editable) {
    if (this.markersAreEditable !== editable) {
      this.markersAreEditable = editable
      this.render() // Re-render to update marker appearance
    }
  }

  /**
   * Get the properties of the currently active marker display size.
   * @returns {Object} An object containing radius and fontSizeFactor.
   */
  getCurrentMarkerDisplaySize () {
    return this.markerSizeSettings[this.markerCurrentDisplaySizeKey]
  }

  /**
   * Set the display size of the markers.
   * @param {string} sizeKey - 'normal', 'large', or 'extraLarge'.
   */
  setMarkerDisplaySize (sizeKey) {
    if (this.markerSizeSettings[sizeKey]) {
      this.markerCurrentDisplaySizeKey = sizeKey
      this.render() // Re-render to show updated marker sizes
    } else {
      console.warn('MapRenderer: Invalid marker size key:', sizeKey, '. Keeping current size.')
    }
  }

  /**
   * Draw a single marker on the canvas.
   * @param {number} x - Screen X coordinate of the marker center.
   * @param {number} y - Screen Y coordinate of the marker center.
   * @param {number} number - Optional number to display on the marker.
   * @param {boolean} isEditable - If true, draw the marker in an 'unlocked' style.
   * @param {boolean} hasPhotos - If true, draw the marker with a 'has photos' style.
   */
  drawMarker (x, y, number, isEditable, hasPhotos) {
    const currentSize = this.markerSizeSettings[this.markerCurrentDisplaySizeKey]
    const radius = currentSize.radius
    const fontSize = radius * currentSize.fontSizeFactor
    const borderWidth = 2
    let borderColor
    let fillColor
    let textColor

    if (isEditable) { // Unlocked/Editable State
      if (hasPhotos) {
        borderColor = '#dc2626' // Red-600
        fillColor = '#ef4444' // Red-500
        textColor = '#ffffff' // White
      } else {
        borderColor = '#f59e0b' // Amber-500
        fillColor = '#fbbf24' // Amber-400
        textColor = '#1f2937' // Dark Gray text for contrast
      }
    } else { // Locked State
      if (hasPhotos) {
        borderColor = '#4b5563' // Gray-600
        fillColor = '#6b7280' // Gray-500
        textColor = '#ffffff' // White
      } else {
        borderColor = '#9ca3af' // Gray-400
        fillColor = '#d1d5db' // Gray-300
        textColor = '#374151' // Darker Gray text for contrast
      }
    }

    this.ctx.save()

    // Draw the marker circle body
    this.ctx.beginPath()
    this.ctx.arc(x, y, radius, 0, Math.PI * 2, false)
    this.ctx.fillStyle = fillColor
    this.ctx.fill()
    this.ctx.lineWidth = borderWidth
    this.ctx.strokeStyle = borderColor
    this.ctx.stroke()

    // Draw the number inside the marker
    this.ctx.font = `${fontSize}px Arial, sans-serif` // Use dynamic font size
    this.ctx.textAlign = 'center'
    this.ctx.textBaseline = 'middle'
    this.ctx.fillStyle = textColor
    this.ctx.fillText(String(number), x, y + 1) // +1 to visually center text better

    this.ctx.restore()
  }

  /**
   * Toggle debug info display
   */
  toggleDebugInfo () {
    this.showDebugInfo = !this.showDebugInfo
    this.render()
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
   * MODIFIED: Also revoke originalImageData object URL
   */
  dispose () {
    // Clean up any object URLs or resources
    if (this.originalImageData && this.originalImageData.src && this.originalImageData.src.startsWith('blob:')) {
      URL.revokeObjectURL(this.originalImageData.src)
    }

    this.imageData = null // The canvas element itself
    this.originalImageData = null // The original Image object
    this.currentMap = null
    this.markers = [] // Clear markers on dispose

    console.log('MapRenderer: Resources cleaned up')
  }
}

// Export for use in other modules
window.MapRenderer = MapRenderer
