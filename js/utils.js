/**
 * SnapSpot PWA - Utility Functions
 */

export class Utils {
  /**
   * Format file size for display
   * @param {number} bytes - Size in bytes
   * @returns {string} - Formatted size string
   */
  static formatFileSize (bytes) {
    if (bytes === 0) return '0 Bytes'

    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  /**
   * Helper to convert an ArrayBuffer to a hexadecimal string.
   * @param {ArrayBuffer} buffer - The ArrayBuffer to convert.
   * @returns {string} - The hexadecimal string representation.
   */
  static _arrayBufferToHex (buffer) {
    return Array.prototype.map.call(new Uint8Array(buffer), (x) =>
      ('00' + x.toString(16)).slice(-2)
    ).join('')
  }
}
