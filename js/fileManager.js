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
   * Extract image dimensions and metadata
   * @param {File} file - Image file to process
   * @returns {Promise<Object>} - Image metadata object
   */
  async getImageMetadata (file) {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const url = URL.createObjectURL(file)

      img.onload = () => {
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

      img.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('Failed to load image. File may be corrupted or invalid.'))
      }

      img.src = url
    })
  }

  /**
   * Create a thumbnail/preview of the image
   * @param {File} file - Image file
   * @param {number} maxSize - Maximum thumbnail size (default 200px)
   * @returns {Promise<string>} - Data URL of thumbnail
   */
  async createThumbnail (file, maxSize = 200) {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const url = URL.createObjectURL(file)

      img.onload = () => {
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
        const thumbnailDataUrl = canvas.toDataURL('image/jpeg', 0.8)

        // Clean up
        URL.revokeObjectURL(url)

        resolve(thumbnailDataUrl)
      }

      img.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('Failed to create thumbnail'))
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

      // Extract image metadata
      const metadata = await this.getImageMetadata(file)

      // Create thumbnail (optional for future use)
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
