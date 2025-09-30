/**
 * SnapSpot PWA - File Management System
 * Phase 1B: File handling and image processing
 */

/**
 * File Manager for handling image uploads and processing
 */

/* global document, window, Image crypto FileReader */
export class FileManager {
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

    // Mobile detection
    this.isMobile = this._isMobile()
  }

  /**
   * Check if running on mobile device
   * @returns {boolean} - True if mobile device detected
   */
  _isMobile () {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  }

  /**
   * Open file picker and select one or more image files.
   * Uses Modern File System Access API with fallback.
   * @param {boolean} showDebug - Show debug overlay for testing.
   * @param {boolean} multiple - Allow selection of multiple files.
   * @returns {Promise<File[]|null>} - Array of selected files or null if cancelled.
   */
  async selectFiles (showDebug = false, multiple = false) { // Changed name and added 'multiple' parameter
    // Try modern File System Access API first (Chrome 86+)
    if ('showOpenFilePicker' in window) {
      try {
        if (showDebug) console.log('Using Modern File System Access API')

        const fileHandles = await window.showOpenFilePicker({ // Changed to plural handle
          types: [{
            description: 'Images',
            accept: {
              'image/*': ['.png', '.gif', '.jpeg', '.jpg', '.webp', '.bmp', '.svg']
            }
          }],
          multiple // Use the 'multiple' parameter here
        })
        return Promise.all(fileHandles.map(handle => handle.getFile())) // Return array of File objects
      } catch (error) {
        if (error.name !== 'AbortError') {
          if (showDebug) console.warn('Modern file picker failed, falling back:', error)
        }
        return null
      }
    }

    // Fallback to traditional input with file extensions
    if (showDebug) console.log('Using fallback file input with extensions')

    return new Promise((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.multiple = multiple // Use the 'multiple' parameter here
      input.accept = '.jpg,.jpeg,.png,.gif,.webp,.bmp,.svg'

      input.onchange = (event) => {
        const files = Array.from(event.target.files) // Convert FileList to Array
        resolve(files.length > 0 ? files : null) // Return array or null
      }

      input.oncancel = () => {
        resolve(null)
      }

      input.click()
    })
  }

  // Note: The previous selectFile method (which you were calling from createUploadModal)
  // will now implicitly use selectFiles(..., false) for single file selection.
  // For the upload modal you call `fileManager.selectFile(showDebug)` in browseBtn event listener.
  // We need to change this in app.js as well to `fileManager.selectFiles(showDebug, false)`

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
   * Converts an ArrayBuffer to a hexadecimal string.
   * @param {ArrayBuffer} buffer - The ArrayBuffer to convert.
   * @returns {string} - The hexadecimal string representation.
   */
  _arrayBufferToHex (buffer) {
    return Array.prototype.map.call(new Uint8Array(buffer), (x) =>
      ('00' + x.toString(16)).slice(-2)
    ).join('')
  }

  /**
   * Calculates the SHA-256 hash of a File's content.
   * @param {File} file - The file to hash.
   * @returns {Promise<string>} - A promise that resolves with the SHA-256 hash as a hex string.
   * @throws {Error} If crypto.subtle is not available or file reading fails.
   */
  async calculateFileHash (file) {
    if (!window.crypto || !window.crypto.subtle) {
      throw new Error('Web Crypto API is not available in this environment.')
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = async (event) => {
        try {
          const buffer = event.target.result // Get the ArrayBuffer
          const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
          const hashHex = this._arrayBufferToHex(hashBuffer)
          resolve(hashHex)
        } catch (error) {
          reject(new Error(`Failed to calculate file hash: ${error.message}`))
        }
      }
      reader.onerror = (error) => {
        reject(new Error(`Failed to read file for hashing: ${error.message}`))
      }
      reader.readAsArrayBuffer(file) // Read the file as an ArrayBuffer
    })
  }

  /**
   * Extract image dimensions and metadata (simplified, no retry logic)
   * @param {File} file - Image file to process
   * @returns {Promise<Object>} - Image metadata object
   */
  async getImageMetadata (file) {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const url = URL.createObjectURL(file)

      // Single timeout for mobile devices
      const timeout = setTimeout(() => {
        URL.revokeObjectURL(url)
        reject(new Error('Image loading timed out'))
      }, this.isMobile ? 10000 : 5000)

      img.onload = () => {
        clearTimeout(timeout)

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

        console.log('Image metadata extracted:', metadata)
        resolve(metadata)
      }

      img.onerror = (error) => {
        clearTimeout(timeout)
        URL.revokeObjectURL(url)
        reject(new Error(`Failed to load image: ${error.message || 'Unknown error'}`))
      }

      img.src = url
    })
  }

  /**
   * Create a thumbnail/preview of the image (simplified, no retry logic)
   * @param {File} file - Image file
   * @param {number} maxSize - Maximum thumbnail size (default 200px)
   * @returns {Promise<string>} - Data URL of thumbnail
   */
  async createThumbnail (file, maxSize = 200) {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const url = URL.createObjectURL(file)

      const timeout = setTimeout(() => {
        URL.revokeObjectURL(url)
        reject(new Error('Thumbnail creation timed out'))
      }, this.isMobile ? 10000 : 5000)

      img.onload = () => {
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

          // Get data URL
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
      console.log('Processing file upload:', file.name)

      // Validate file
      const validation = this.validateFile(file)
      if (!validation.isValid) {
        throw new Error('File validation failed: ' + validation.errors.join(', '))
      }

      // Extract image metadata (no retry logic)
      const metadata = await this.getImageMetadata(file)

      // Create thumbnail (no retry logic)
      const thumbnail = await this.createThumbnail(file)

      // NEW: Calculate the image hash
      const imageHash = await this.calculateFileHash(file)
      console.log(`Calculated image hash for ${file.name}: ${imageHash}`)

      // Prepare map data
      const mapData = {
        name: mapDetails.name || this.generateMapName(file.name),
        description: mapDetails.description || '',
        fileName: metadata.fileName,
        filePath: `uploads/${Date.now()}_${metadata.fileName}`,
        width: metadata.width,
        height: metadata.height,
        fileSize: metadata.fileSize,
        fileType: metadata.fileType,
        aspectRatio: metadata.aspectRatio,
        originalFile: file, // Keep reference to original file for direct storage if needed
        thumbnail,
        isActive: mapDetails.isActive || false,
        imageHash: imageHash, // NEW: Add image hash to mapData
        settings: {
          defaultZoom: this.calculateDefaultZoom(metadata.width, metadata.height),
          allowMarkers: true,
          ...mapDetails.settings
        }
      }

      console.log('File processing completed:', mapData.name)
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
    const viewportWidth = 1200
    const viewportHeight = 800
    const scaleX = viewportWidth / width
    const scaleY = viewportHeight / height
    const scale = Math.min(scaleX, scaleY, 1)
    return Math.max(0.1, scale)
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
