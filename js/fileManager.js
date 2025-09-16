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
    let lastError

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`Image metadata extraction attempt ${attempt}/${this.maxRetries}`)
        return await this._attemptImageMetadataExtraction(file)
      } catch (error) {
        lastError = error
        console.warn(`Image metadata extraction attempt ${attempt} failed:`, error.message)

        // Don't retry on dimension validation errors
        if (error.message.includes('too large') || error.message.includes('too small')) {
          throw error
        }

        // Wait before retry if not the last attempt
        if (attempt < this.maxRetries) {
          await this._createRetryDelay(attempt)

          // Force garbage collection on mobile if available
          if (this.isMobile && window.gc && typeof window.gc === 'function') {
            try {
              window.gc()
            } catch (gcError) {
              // Ignore GC errors
            }
          }
        }
      }
    }

    throw new Error(`Failed to extract image metadata after ${this.maxRetries} attempts: ${lastError.message}`)
  }

  /**
   * Single attempt at extracting image metadata
   * @param {File} file - Image file to process
   * @returns {Promise<Object>} - Image metadata object
   */
  _attemptImageMetadataExtraction (file) {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      let isResolved = false

      // Add timeout for mobile devices
      const timeout = setTimeout(() => {
        if (!isResolved) {
          isResolved = true
          URL.revokeObjectURL(url)
          reject(new Error('Image loading timed out - file may be corrupted or device is under memory pressure'))
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
        URL.revokeObjectURL(url)

        // Provide more specific error messages
        const errorMsg = error && error.message
          ? `Failed to load image: ${error.message}`
          : 'Failed to load image. File may be corrupted, invalid, or device is under memory pressure.'

        reject(new Error(errorMsg))
      }

      // Set source after all handlers are attached
      try {
        img.src = url
      } catch (srcError) {
        if (!isResolved) {
          isResolved = true
          clearTimeout(timeout)
          URL.revokeObjectURL(url)
          reject(new Error(`Failed to set image source: ${srcError.message}`))
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

  // ... existing code continues unchanged ...

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
}

// Export for use in other modules
window.FileManager = FileManager
