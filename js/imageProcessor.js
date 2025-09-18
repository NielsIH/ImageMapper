/**
 * Image Processing Utilities
 */

/* global Image, document, FileReader, createImageBitmap, Blob */

class ImageProcessor {
  /**
   * Converts an image Blob directly to a Base64 Data URL.
   * Useful for images that don't need resizing or specific processing.
   * @param {Blob} imageBlob - The image Blob to convert.
   * @returns {Promise<string>} A promise that resolves with the Base64 Data URL.
   */
  async blobToBase64 (imageBlob) {
    return new Promise((resolve, reject) => {
      if (!(imageBlob instanceof Blob)) {
        reject(new Error('blobToBase64: Invalid input, imageBlob must be a Blob.'))
        return
      }

      const reader = new FileReader()
      reader.onloadend = () => {
        resolve(reader.result)
      }
      reader.onerror = (error) => {
        reject(new Error('Failed to convert Blob to Base64: ' + error.message))
      }
      reader.readAsDataURL(imageBlob)
    })
  }

  /**
   * Resizes and compresses an image file.
   * @param {File} imageFile - The original image file from user input.
   * @param {Object} options - Resizing and compression options.
   * @param {number} [options.maxWidth=1920] - Maximum width for the resized image.
   * @param {number} [options.maxHeight=1920] - Maximum height for the resized image.
   * @param {number} [options.quality=0.8] - JPEG/WebP compression quality (0 to 1).
   * @param {string} [options.outputFormat='image/jpeg'] - Output MIME type for the image.
   * @returns {Promise<Blob>} A promise that resolves with the resized and compressed image as a Blob.
   */
  async processImage (imageFile, options = {}) {
    return new Promise((resolve, reject) => {
      const settings = {
        maxWidth: options.maxWidth || 1920,
        maxHeight: options.maxHeight || 1920,
        quality: options.quality || 0.8, // 80% quality for JPEG
        outputFormat: options.outputFormat || 'image/jpeg'
      }

      const reader = new FileReader()
      reader.onload = (event) => {
        const img = new Image()
        img.onload = () => {
          let width = img.width
          let height = img.height

          // Calculate new dimensions to fit within maxWidth/maxHeight while maintaining aspect ratio
          if (width > height) {
            if (width > settings.maxWidth) {
              height *= settings.maxWidth / width
              width = settings.maxWidth
            }
          } else {
            if (height > settings.maxHeight) {
              width *= settings.maxHeight / height
              height = settings.maxHeight
            }
          }

          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')

          // Draw the image on the canvas
          ctx.drawImage(img, 0, 0, width, height)

          // Get the image as a Blob with desired format and quality
          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob)
              } else {
                reject(new Error('Canvas toBlob failed.'))
              }
            },
            settings.outputFormat,
            settings.quality
          )
        }
        img.onerror = (err) => reject(new Error('Failed to load image for processing: ' + err.message))
        img.src = event.target.result
      }
      reader.onerror = (err) => reject(new Error('Failed to read image file: ' + err.message))
      reader.readAsDataURL(imageFile)
    })
  }

  /**
   * Generates a small thumbnail Data URL from an image Blob for display in lists.
   * This method uses createImageBitmap for efficient scaling on the main thread
   * and minimizes memory overhead compared to full Image element loading.
   * @param {Blob} imageBlob - The original image Blob from storage.
   * @param {number} maxSize - The maximum dimension (width or height) for the thumbnail.
   * @param {string} outputFormat - The output MIME type (e.g., 'image/jpeg', 'image/webp').
   * @param {number} quality - JPEG/WebP quality from 0 to 1.
   * @returns {Promise<string>} - A Promise that resolves with the Data URL of the thumbnail.
   */
  async generateThumbnailDataUrl (imageBlob, maxSize = 100, outputFormat = 'image/jpeg', quality = 0.7) {
    if (!(imageBlob instanceof Blob)) {
      console.error('DEBUG(imageProcessor): Invalid input for generateThumbnailDataUrl - not a Blob.', imageBlob)
      throw new Error('generateThumbnailDataUrl: Invalid input, imageBlob must be a Blob.')
    }

    try {
      console.log('DEBUG(imageProcessor): Calling createImageBitmap with Blob:', imageBlob)
      const bitmap = await createImageBitmap(imageBlob)
      console.log('DEBUG(imageProcessor): createImageBitmap successful. Bitmap dimensions:', bitmap.width, 'x', bitmap.height)

      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')

      let { width, height } = bitmap

      // Calculate new dimensions to fit within maxSize while maintaining aspect ratio
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

      canvas.width = width
      canvas.height = height

      console.log(`DEBUG(imageProcessor): Drawing bitmap to canvas. Canvas dimensions: ${canvas.width}x${canvas.height}`)
      ctx.drawImage(bitmap, 0, 0, width, height)

      // --- FIX STARTS HERE ---
      console.log(`DEBUG(imageProcessor): Synchronously converting canvas to Data URL. Format: ${outputFormat}, Quality: ${quality}`)
      const dataUrl = canvas.toDataURL(outputFormat, quality) // Directly assigned
      console.log(`DEBUG(imageProcessor): Data URL generated. Length: ${dataUrl.length}`)
      return dataUrl // Directly returned
      // --- FIX ENDS HERE ---
    } catch (error) {
      console.error('DEBUG(imageProcessor): Error generating thumbnail Data URL IN CATCH BLOCK:', error)
      return null
    }
  }
}
