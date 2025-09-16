/**
 * Image Mapper PWA - File Management System
 * Phase 1B: File handling and image processing
 */

/**
 * File Manager for handling image uploads and processing
 */
class FileManager {
  constructor () {
    // Supported file formats
    this.supportedFormats = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/bmp',
      'image/svg+xml'
    ]

    // File size limits
    this.maxFileSize = 10 * 1024 * 1024 // 10MB
    this.minFileSize = 1024 // 1KB

    // Image dimension limits
    this.maxDimension = 8192 // 8K max width/height
    this.minDimension = 100 // 100px min width/height

    // Mobile optimization settings
    this.isMobile = this._isMobile()
    this.maxRetries = this.isMobile ? 3 : 2
    this.baseTimeout = this.isMobile ? 10000 : 5000 // 10s mobile, 5s desktop
  }

  /**
   * Check if running on mobile device
   * @returns {boolean} - True if mobile device detected
   */
  _isMobile () {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  }

  /**
   * Check if device is experiencing memory pressure
   * @returns {boolean} - True if low memory detected
   */
  _isLowMemory () {
    // Use Performance API if available
    if ('memory' in performance) {
      const memInfo = performance.memory
      const memoryPressure = memInfo.usedJSHeapSize / memInfo.jsHeapSizeLimit
      return memoryPressure > 0.85 // 85% memory usage threshold
    }
    return false // Conservative fallback
  }

  /**
   * Check if file is likely from Android gallery/camera vs downloads
   * @param {File} file - File to check
   * @returns {boolean} - True if likely from gallery/camera
   */
  _isAndroidGalleryFile (file) {
    const isAndroid = /Android/i.test(navigator.userAgent)
    this._showDebugMessage(`Is Android: ${isAndroid}, User Agent: ${navigator.userAgent.substring(0, 50)}...`)

    // For now, treat ALL image files on Android as gallery files
    return isAndroid && file.type && file.type.startsWith('image/')
  }

  /**
   * Android-specific file preparation
   * @param {File} file - Original file
   * @returns {Promise<File>} - Prepared file
   */
  async _prepareAndroidFile (file) {
    // For Android gallery files, we need to ensure the file is fully accessible
    return new Promise((resolve, reject) => {
      // Create a FileReader to ensure the file is actually readable
      const reader = new FileReader()

      reader.onload = () => {
        // File is readable, return original
        resolve(file)
      }

      reader.onerror = () => {
        reject(new Error('File is not accessible - Android may be indexing or mounting storage'))
      }

      // Try to read just the first few bytes to test accessibility
      const testBlob = file.slice(0, 1024) // First 1KB
      reader.readAsArrayBuffer(testBlob)
    })
  }

  /**
   * Create a delay for retry attempts
   * @param {number} attempt - Current attempt number
   * @returns {Promise} - Promise that resolves after delay
   */
  _createRetryDelay (attempt) {
    const delay = attempt * (this.isMobile ? 500 : 200)
    return new Promise(resolve => setTimeout(resolve, delay))
  }

  /**
   * Open file picker and select an image file
   * @returns {Promise<File|null>} - Selected file or null if cancelled
   */
  async selectFile () {
    return new Promise((resolve) => {
      // Create file input element
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = this.supportedFormats.join(',')
      input.multiple = false

      input.onchange = (event) => {
        const file = event.target.files[0]
        resolve(file || null)
      }

      input.oncancel = () => {
        resolve(null)
      }

      // Trigger file picker
      input.click()
    })
  }

  /**
   * Validate a selected file
   * @param {File} file - File to validate
   * @returns {Object} - Validation result with success status and errors
   */
  validateFile (file) {
    const errors = []

    if (!file) {
      errors.push('No file selected')
      return { isValid: false, errors }
    }

    // Check file type
    if (!this.supportedFormats.includes(file.type)) {
      errors.push(`Unsupported file format: ${file.type}. Supported formats: ${this.supportedFormats.join(', ')}`)
    }

    // Check file size
    if (file.size > this.maxFileSize) {
      errors.push(`File too large: ${this.formatFileSize(file.size)}. Maximum size: ${this.formatFileSize(this.maxFileSize)}`)
    }

    if (file.size < this.minFileSize) {
      errors.push(`File too small: ${this.formatFileSize(file.size)}. Minimum size: ${this.formatFileSize(this.minFileSize)}`)
    }

    // Check file name
    if (!file.name || file.name.trim() === '') {
      errors.push('Invalid file name')
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * Extract image dimensions and metadata with retry logic for mobile devices
   * @param {File} file - Image file to process
   * @returns {Promise<Object>} - Image metadata object
   */
  async getImageMetadata (file) {
  // Check if this is an Android gallery file
    const isAndroidGallery = this._isAndroidGalleryFile(file)

    this._showDebugMessage(`Processing file: ${file.name}`)
    this._showDebugMessage(`Android gallery detected: ${isAndroidGallery}`)
    this._showDebugMessage(`File size: ${Math.round(file.size / 1024)}KB`)

    if (isAndroidGallery) {
      this._showDebugMessage('Using enhanced Android handling - 5 retries, 15s timeout')

      // First, ensure the file is accessible
      try {
        await this._prepareAndroidFile(file)
        this._showDebugMessage('File accessibility check passed')
      } catch (error) {
        this._showDebugMessage(`File accessibility check failed: ${error.message}`)
        throw new Error(`Android file access issue: ${error.message}. Try copying the image to your Downloads folder or wait a moment and try again.`)
      }

      // Use longer timeouts and more retries for gallery files
      this.maxRetries = 5
      this.baseTimeout = 15000 // 15 seconds
    } else {
      this._showDebugMessage('Using standard handling - 3 retries, 10s timeout')
    }

    let lastError

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        this._showDebugMessage(`Attempt ${attempt}/${this.maxRetries} starting...`)

        if (isAndroidGallery && attempt > 1) {
          this._showDebugMessage(`Waiting ${attempt * 2 * 500}ms before retry...`)
          await this._createRetryDelay(attempt * 2)
        }

        const result = await this._attemptImageMetadataExtraction(file)
        this._showDebugMessage('✅ Success! Metadata extracted')
        return result
      } catch (error) {
        lastError = error
        this._showDebugMessage(`❌ Attempt ${attempt} failed: ${error.message}`)

        // Don't retry on dimension validation errors
        if (error.message.includes('too large') || error.message.includes('too small')) {
          throw error
        }

        // Wait before retry if not the last attempt
        if (attempt < this.maxRetries) {
          await this._createRetryDelay(attempt)
        }
      }
    }

    // Reset retry settings
    this.maxRetries = this.isMobile ? 3 : 2
    this.baseTimeout = this.isMobile ? 10000 : 5000

    this._showDebugMessage(`🔴 All attempts failed after ${this.maxRetries} tries`)

    const androidAdvice = isAndroidGallery
      ? ' Try copying the image to your Downloads folder first, or wait a moment for Android to finish indexing your photos.'
      : ''

    throw new Error(`Failed to extract image metadata after ${this.maxRetries} attempts: ${lastError.message}.${androidAdvice}`)
  }

  /**
   * Single attempt at extracting image metadata
   * @param {File} file - Image file to process
   * @returns {Promise<Object>} - Image metadata object
   */
  _attemptImageMetadataExtraction (file) {
    return new Promise((resolve, reject) => {
      const img = new Image()
      let url
      let isResolved = false

      try {
        // For some Android files, we might need to handle them differently
        url = URL.createObjectURL(file)
      } catch (urlError) {
        reject(new Error(`Failed to create object URL: ${urlError.message}. This can happen with Android gallery files that aren't fully mounted.`))
        return
      }

      // Add timeout for mobile devices
      const timeout = setTimeout(() => {
        if (!isResolved) {
          isResolved = true
          if (url) URL.revokeObjectURL(url)
          reject(new Error('Image loading timed out - Android may be indexing storage or file is temporarily inaccessible'))
        }
      }, this.baseTimeout)

      img.onload = () => {
        if (isResolved) return
        isResolved = true
        clearTimeout(timeout)

        try {
          const metadata = {
            width: img.naturalWidth,
            height: img.naturalHeight,
            aspectRatio: img.naturalWidth / img.naturalHeight,
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            lastModified: new Date(file.lastModified)
          }

          // Clean up object URL
          URL.revokeObjectURL(url)

          // Validate dimensions
          if (metadata.width > this.maxDimension || metadata.height > this.maxDimension) {
            reject(new Error(`Image too large: ${metadata.width}x${metadata.height}. Maximum dimension: ${this.maxDimension}px`))
            return
          }

          if (metadata.width < this.minDimension || metadata.height < this.minDimension) {
            reject(new Error(`Image too small: ${metadata.width}x${metadata.height}. Minimum dimension: ${this.minDimension}px`))
            return
          }

          console.log('Image metadata extracted successfully:', metadata)
          resolve(metadata)
        } catch (processingError) {
          URL.revokeObjectURL(url)
          reject(new Error(`Error processing image metadata: ${processingError.message}`))
        }
      }

      img.onerror = (error) => {
        if (isResolved) return
        isResolved = true
        clearTimeout(timeout)
        if (url) URL.revokeObjectURL(url)

        // Provide Android-specific error messages
        const isAndroidGallery = this._isAndroidGalleryFile(file)
        let errorMsg = 'Failed to load image'

        if (isAndroidGallery) {
          errorMsg += ' from Android gallery/camera. This often happens when Android is indexing photos or storage is temporarily mounted. Try waiting a moment or copying the image to Downloads folder.'
        } else {
          errorMsg += '. File may be corrupted, invalid, or device is under memory pressure.'
        }

        if (error && error.message) {
          errorMsg += ` Details: ${error.message}`
        }

        reject(new Error(errorMsg))
      }

      // Set source after all handlers are attached
      try {
        img.src = url
      } catch (srcError) {
        if (!isResolved) {
          isResolved = true
          clearTimeout(timeout)
          if (url) URL.revokeObjectURL(url)
          reject(new Error(`Failed to set image source: ${srcError.message}. This can happen with Android gallery files.`))
        }
      }
    })
  }

  /**
   * Create a thumbnail/preview of the image with retry logic
   * @param {File} file - Image file
   * @param {number} maxSize - Maximum thumbnail size (default 200px)
   * @returns {Promise<string>} - Data URL of thumbnail
   */
  async createThumbnail (file, maxSize = 200) {
    // Reduce thumbnail size on mobile with low memory
    if (this.isMobile && this._isLowMemory()) {
      maxSize = Math.min(maxSize, 150)
    }

    let lastError

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`Thumbnail creation attempt ${attempt}/${this.maxRetries}`)
        return await this._attemptThumbnailCreation(file, maxSize)
      } catch (error) {
        lastError = error
        console.warn(`Thumbnail creation attempt ${attempt} failed:`, error.message)

        if (attempt < this.maxRetries) {
          await this._createRetryDelay(attempt)
        }
      }
    }

    throw new Error(`Failed to create thumbnail after ${this.maxRetries} attempts: ${lastError.message}`)
  }

  /**
   * Single attempt at creating a thumbnail
   * @param {File} file - Image file
   * @param {number} maxSize - Maximum thumbnail size
   * @returns {Promise<string>} - Data URL of thumbnail
   */
  _attemptThumbnailCreation (file, maxSize) {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      let isResolved = false

      const timeout = setTimeout(() => {
        if (!isResolved) {
          isResolved = true
          URL.revokeObjectURL(url)
          reject(new Error('Thumbnail creation timed out'))
        }
      }, this.baseTimeout)

      img.onload = () => {
        if (isResolved) return
        isResolved = true
        clearTimeout(timeout)

        try {
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')

          // Calculate thumbnail dimensions
          let { width, height } = img

          if (width > height) {
            if (width > maxSize) {
              height = (height * maxSize) / width
              width = maxSize
            }
          } else {
            if (height > maxSize) {
              width = (width * maxSize) / height
              height = maxSize
            }
          }

          // Set canvas size
          canvas.width = width
          canvas.height = height

          // Draw thumbnail
          ctx.drawImage(img, 0, 0, width, height)

          // Get data URL with mobile-optimized quality
          const quality = this.isMobile ? 0.7 : 0.8
          const thumbnailDataUrl = canvas.toDataURL('image/jpeg', quality)

          // Clean up
          URL.revokeObjectURL(url)

          resolve(thumbnailDataUrl)
        } catch (canvasError) {
          URL.revokeObjectURL(url)
          reject(new Error(`Canvas processing failed: ${canvasError.message}`))
        }
      }

      img.onerror = (error) => {
        if (isResolved) return
        isResolved = true
        clearTimeout(timeout)
        URL.revokeObjectURL(url)
        reject(new Error(`Failed to load image for thumbnail: ${error.message || 'Unknown error'}`))
      }

      img.src = url
    })
  }

  /**
   * Process file upload and create map data
   * @param {File} file - Selected image file
   * @param {Object} mapDetails - Map name, description, etc.
   * @returns {Promise<Object>} - Processed map data ready for storage
   */
  async processFileUpload (file, mapDetails = {}) {
    try {
      console.log('Processing file upload:', file.name, `(Mobile: ${this.isMobile})`)

      // Validate file
      const validation = this.validateFile(file)
      if (!validation.isValid) {
        throw new Error('File validation failed: ' + validation.errors.join(', '))
      }

      // Extract image metadata with retry logic
      const metadata = await this.getImageMetadata(file)

      // Create thumbnail with retry logic
      const thumbnail = await this.createThumbnail(file)

      // Prepare map data
      const mapData = {
        name: mapDetails.name || this.generateMapName(file.name),
        description: mapDetails.description || '',
        fileName: metadata.fileName,
        filePath: `uploads/${Date.now()}_${metadata.fileName}`, // Mock path for now
        width: metadata.width,
        height: metadata.height,
        fileSize: metadata.fileSize,
        fileType: metadata.fileType,
        aspectRatio: metadata.aspectRatio,
        originalFile: file, // Reference to original file
        thumbnail, // Thumbnail data URL
        isActive: mapDetails.isActive || false,
        settings: {
          defaultZoom: this.calculateDefaultZoom(metadata.width, metadata.height),
          allowMarkers: true,
          ...mapDetails.settings
        }
      }

      console.log('File processing completed successfully:', mapData.name)
      return mapData
    } catch (error) {
      console.error('File processing failed:', error)
      throw error
    }
  }

  /**
   * Generate a default map name from filename
   * @param {string} fileName - Original file name
   * @returns {string} - Generated map name
   */
  generateMapName (fileName) {
    // Remove file extension and clean up name
    const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '')
    const cleanName = nameWithoutExt
      .replace(/[_-]/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase())
      .trim()

    return cleanName || 'Untitled Map'
  }

  /**
   * Calculate appropriate default zoom level based on image size
   * @param {number} width - Image width
   * @param {number} height - Image height
   * @returns {number} - Default zoom level
   */
  calculateDefaultZoom (width, height) {
    // Assume viewport is roughly 1200x800
    const viewportWidth = 1200
    const viewportHeight = 800

    const scaleX = viewportWidth / width
    const scaleY = viewportHeight / height
    const scale = Math.min(scaleX, scaleY, 1) // Don't zoom in beyond 100%

    return Math.max(0.1, scale) // Minimum 10% zoom
  }

  /**
   * Format file size for display
   * @param {number} bytes - Size in bytes
   * @returns {string} - Formatted size string
   */
  formatFileSize (bytes) {
    if (bytes === 0) return '0 Bytes'

    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  /**
   * Check if file type is supported
   * @param {string} fileType - MIME type to check
   * @returns {boolean} - Whether file type is supported
   */
  isFileTypeSupported (fileType) {
    return this.supportedFormats.includes(fileType)
  }

  /**
   * Get supported file extensions for display
   * @returns {Array} - Array of supported extensions
   */
  getSupportedExtensions () {
    return ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.svg']
  }

  /**
   * Create a file input element with proper configuration
   * @returns {HTMLInputElement} - Configured file input element
   */
  createFileInput () {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = this.supportedFormats.join(',')
    input.multiple = false
    input.style.display = 'none'

    return input
  }

  // Add this method to show visible status messages
  _showDebugMessage (message) {
  // Try to find an existing debug div or create one
    let debugDiv = document.getElementById('debug-messages')
    if (!debugDiv) {
      debugDiv = document.createElement('div')
      debugDiv.id = 'debug-messages'
      debugDiv.style.cssText = `
      position: fixed;
      top: 10px;
      left: 10px;
      right: 10px;
      background: rgba(0,0,0,0.8);
      color: white;
      padding: 10px;
      font-size: 12px;
      z-index: 10000;
      max-height: 200px;
      overflow-y: auto;
    `
      document.body.appendChild(debugDiv)
    }

    const timestamp = new Date().toLocaleTimeString()
    debugDiv.innerHTML += `<div>${timestamp}: ${message}</div>`
    debugDiv.scrollTop = debugDiv.scrollHeight
  }
}

// Export for use in other modules
window.FileManager = FileManager
