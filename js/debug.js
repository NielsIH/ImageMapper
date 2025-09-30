/**
 * Debug utilities for SnapSpot PWA
 * Phase 1B: Storage testing and debugging
 */

/* global window, document, localStorage, confirm, alert */

// Global helper functions that are always available (even after F5)
window.enableDevButtons = function () {
  localStorage.setItem('SnapSpot-dev-buttons', 'true')
  console.log('✅ Dev buttons enabled - will auto-load on refresh')

  // Try to add buttons now if possible
  if (window.debugUtils && typeof window.debugUtils.addDevButtons === 'function') {
    window.debugUtils.addDevButtons()
  } else {
    console.log('ℹ️ Buttons will appear on next page load')
  }
}

window.disableDevButtons = function () {
  localStorage.setItem('SnapSpot-dev-buttons', 'false')
  console.log('❌ Dev buttons disabled')

  // Try to remove buttons now if possible
  if (window.debugUtils && typeof window.debugUtils.removeDevButtons === 'function') {
    window.debugUtils.removeDevButtons()
  }
}

/**
 * Debug utilities for testing storage system
 */
class DebugUtils {
  constructor (app) {
    this.app = app
  }

  /**
   * Create multiple test maps for testing
   */
  async createTestMaps (count = 3) {
    console.log(`Creating ${count} test maps...`)
    const results = []

    for (let i = 1; i <= count; i++) {
      try {
        const testMap = {
          name: `Test Map ${i}`,
          description: `This is test map number ${i} for storage testing`,
          fileName: `test-map-${i}.jpg`,
          filePath: `/mock/path/test-map-${i}.jpg`,
          width: 1920 + (i * 100),
          height: 1080 + (i * 50),
          fileSize: 245760 + (i * 50000), // Varying file sizes
          fileType: 'image/jpeg',
          isActive: i === 1 && this.app.mapsList.length === 0
        }

        const savedMap = await this.app.storage.addMap(testMap)
        results.push(savedMap)
        console.log(`Test map ${i} created:`, savedMap.id)
      } catch (error) {
        console.error(`Failed to create test map ${i}:`, error)
      }
    }

    // Reload the app's maps list
    await this.app.loadMaps()
    this.app.checkWelcomeScreen()

    console.log(`Created ${results.length} test maps successfully`)
    return results
  }

  /**
   * Clear all maps (for testing)
   */
  async clearAllMaps () {
    try {
      const confirmed = confirm('Are you sure you want to delete ALL maps?\n\nThis action cannot be undone.')
      if (!confirmed) return false

      await this.app.storage.clearAllMaps()
      await this.app.loadMaps()
      this.app.checkWelcomeScreen()

      console.log('All maps cleared successfully')
      alert('All maps have been cleared!')
      return true
    } catch (error) {
      console.error('Failed to clear maps:', error)
      alert('Failed to clear maps: ' + error.message)
      return false
    }
  }

  /**
   * Display detailed storage information
   */
  async showStorageInfo () {
    try {
      const stats = await this.app.storage.getStorageStats()
      const maps = await this.app.storage.getAllMaps()

      let info = '=== STORAGE INFORMATION ===\n\n'
      info += `Database Name: ${this.app.storage.dbName}\n`
      info += `Database Version: ${this.app.storage.version}\n`
      info += `Storage Available: ${this.app.storage.isAvailable()}\n\n`

      info += '=== STATISTICS ===\n'
      info += `Total Maps: ${stats.totalMaps}\n`
      info += `Total File Size: ${this.app.formatFileSize(stats.totalFileSize)}\n`
      info += `Average File Size: ${this.app.formatFileSize(stats.averageFileSize)}\n`
      info += `Active Map: ${stats.activeMapId || 'None'}\n\n`

      if (stats.oldestMap) {
        info += `Oldest Map: ${stats.oldestMap.name} (${new Date(stats.oldestMap.createdDate).toLocaleDateString()})\n`
      }
      if (stats.newestMap) {
        info += `Newest Map: ${stats.newestMap.name} (${new Date(stats.newestMap.createdDate).toLocaleDateString()})\n`
      }

      if (maps.length > 0) {
        info += '\n=== ALL MAPS ===\n'
        maps.forEach((map, index) => {
          info += `\n${index + 1}. ${map.name}${map.isActive ? ' [ACTIVE]' : ''}\n`
          info += `   ID: ${map.id}\n`
          info += `   Description: ${map.description || 'No description'}\n`
          info += `   File: ${map.fileName} (${this.app.formatFileSize(map.fileSize)})\n`
          info += `   Dimensions: ${map.width}x${map.height}\n`
          info += `   Created: ${new Date(map.createdDate).toLocaleString()}\n`
          info += `   Modified: ${new Date(map.lastModified).toLocaleString()}\n`
        })
      }

      console.log(info)
      alert(info)
    } catch (error) {
      console.error('Failed to get storage info:', error)
      alert('Failed to get storage information: ' + error.message)
    }
  }

  /**
   * Test storage operations
   */
  async testStorageOperations () {
    console.log('Running storage operations test...')
    let testResults = '=== STORAGE OPERATIONS TEST ===\n\n'

    try {
      // Test 1: Add map
      testResults += '1. Testing ADD operation...\n'
      const testMap = {
        name: 'Storage Test Map',
        description: 'Testing storage operations',
        fileName: 'storage-test.jpg',
        filePath: '/test/storage-test.jpg',
        width: 800,
        height: 600,
        fileSize: 123456,
        fileType: 'image/jpeg'
      }

      const addedMap = await this.app.storage.addMap(testMap)
      testResults += `✓ Map added successfully: ${addedMap.id}\n\n`

      // Test 2: Get map
      testResults += '2. Testing GET operation...\n'
      const retrievedMap = await this.app.storage.getMap(addedMap.id)
      testResults += `✓ Map retrieved: ${retrievedMap ? 'Success' : 'Failed'}\n\n`

      // Test 3: Update map
      testResults += '3. Testing UPDATE operation...\n'
      const updatedMap = await this.app.storage.updateMap(addedMap.id, {
        name: 'Updated Storage Test Map',
        description: 'Updated description for testing'
      })
      testResults += `✓ Map updated: ${updatedMap.name}\n\n`

      // Test 4: Set active
      testResults += '4. Testing SET ACTIVE operation...\n'
      const activeMap = await this.app.storage.setActiveMap(addedMap.id)
      testResults += `✓ Map set as active: ${activeMap.isActive}\n\n`

      // Test 5: Get all maps
      testResults += '5. Testing GET ALL operation...\n'
      const allMaps = await this.app.storage.getAllMaps()
      testResults += `✓ Retrieved ${allMaps.length} maps\n\n`

      // Test 6: Delete map
      testResults += '6. Testing DELETE operation...\n'
      const deleted = await this.app.storage.deleteMap(addedMap.id)
      testResults += `✓ Map deleted: ${deleted}\n\n`

      testResults += '=== ALL TESTS PASSED ===\n'
      console.log('Storage operations test completed successfully')
    } catch (error) {
      testResults += `✗ Test failed: ${error.message}\n`
      console.error('Storage operations test failed:', error)
    }

    alert(testResults)
    console.log(testResults)
  }

  /**
   * Simulate database errors for testing error handling
   */
  async testErrorHandling () {
    console.log('Testing error handling...')

    try {
      // Test invalid map data
      await this.app.storage.addMap(null)
    } catch (error) {
      console.log('✓ Correctly caught null map error:', error.message)
    }

    try {
      // Test getting non-existent map
      const result = await this.app.storage.getMap('non-existent-id')
      console.log('✓ Non-existent map returned:', result === null ? 'null (correct)' : 'unexpected result')
    } catch (error) {
      console.log('✗ Unexpected error for non-existent map:', error.message)
    }

    try {
      // Test updating non-existent map
      await this.app.storage.updateMap('non-existent-id', { name: 'Test' })
    } catch (error) {
      console.log('✓ Correctly caught update non-existent map error:', error.message)
    }

    alert('Error handling tests completed - check console for results')
  }

  /**
   * Show current map display information
   */
  showMapInfo () {
    const info = this.app.getCurrentMapInfo()

    let message = '=== MAP DISPLAY INFO ===\n\n'

    if (info.map) {
      message += `Current Map: ${info.map.name}\n`
      message += `ID: ${info.map.id}\n`
      message += `Dimensions: ${info.map.width}×${info.map.height}\n`
      message += `File: ${info.map.fileName}\n`
      message += `Has File Data: ${info.hasFile ? 'Yes' : 'No'}\n`
      message += `Active: ${info.map.isActive ? 'Yes' : 'No'}\n\n`
    } else {
      message += 'No map currently loaded\n\n'
    }

    if (info.renderer) {
      message += `Renderer Scale: ${info.renderer.scale.toFixed(3)}\n`
      message += `Renderer Offset: ${info.renderer.offsetX.toFixed(0)}, ${info.renderer.offsetY.toFixed(0)}\n`
    }

    console.log(message)
    alert(message)
  }

  /**
   * Toggle map debug information display
   */
  toggleMapDebug () {
    this.app.toggleMapDebugInfo()
    console.log('Map debug info toggled')
  }

  /**
   * Reset map view
   */
  resetMapView () {
    this.app.resetMapView()
    console.log('Map view reset to fit screen')
  }

  /**
   * Diagnose canvas and rendering issues
   */
  diagnoseCanvas () {
    const canvas = document.getElementById('map-canvas')
    const container = canvas?.parentElement

    console.log('=== CANVAS DIAGNOSTICS ===')
    console.log('Canvas element:', canvas)
    console.log('Canvas container:', container)

    if (canvas) {
      console.log('Canvas dimensions:', canvas.width, 'x', canvas.height)
      console.log('Canvas style:', canvas.style.width, 'x', canvas.style.height)
      console.log('Canvas context:', canvas.getContext('2d'))
    }

    if (container) {
      const rect = container.getBoundingClientRect()
      console.log('Container rect:', rect)
    }

    if (this.app.mapRenderer) {
      console.log('Renderer state:', this.app.mapRenderer.getViewState())
      console.log('Current map:', this.app.currentMap)
      console.log('Image data:', this.app.mapRenderer.imageData)
    }

    // Try to force a canvas resize and re-render
    if (this.app.mapRenderer) {
      console.log('Forcing canvas resize and re-render...')
      this.app.mapRenderer.resizeCanvas()
      this.app.mapRenderer.fitToScreen()
      this.app.mapRenderer.render()
    }
  }

  /**
   * Quick clear all maps without confirmation (for development)
   */
  async quickClear () {
    try {
      console.log('Quick clearing all maps...')

      // Clear storage
      await this.app.storage.clearAllMaps()

      // Clear file references
      this.app.uploadedFiles.clear()

      // Reset app state
      this.app.currentMap = null
      this.app.mapsList = []

      // Clear renderer
      if (this.app.mapRenderer) {
        this.app.mapRenderer.imageData = null
        this.app.mapRenderer.currentMap = null
        this.app.mapRenderer.render()
      }

      // Update UI
      this.app.checkWelcomeScreen()

      console.log('✅ All maps cleared successfully!')
      this.app.updateAppStatus('All maps cleared - ready for new upload')

      return true
    } catch (error) {
      console.error('Failed to clear maps:', error)
      return false
    }
  }

  /**
   * Force upload new - clear everything and open upload modal
   */
  async forceUploadNew () {
    console.log('Force upload new - clearing and opening upload modal...')

    // Quick clear everything
    await this.quickClear()

    // Small delay to ensure UI is updated
    setTimeout(() => {
      // Open upload modal
      this.app.showUploadModal()
    }, 100)
  }

  /**
   * Add multiple maps button to header for testing
   */
  addDevButtons () {
    console.log('Debug: addDevButtons called')
    const headerActions = document.querySelector('.header-actions')
    console.log('Debug: headerActions found:', !!headerActions)

    if (!headerActions) {
      console.error('Debug: Header actions not found!')
      return
    }

    // Check if buttons already exist
    const existingBtn = document.getElementById('dev-clear-btn')
    console.log('Debug: Existing button found:', !!existingBtn)
    if (existingBtn) {
      console.log('Debug: Buttons already exist, skipping')
      return
    }

    // Quick clear button
    const clearBtn = document.createElement('button')
    clearBtn.id = 'dev-clear-btn'
    clearBtn.className = 'btn btn-danger'
    clearBtn.textContent = '🗑️ Clear'
    clearBtn.title = 'Quick clear all maps'
    clearBtn.onclick = () => this.quickClear()

    // Force new upload button
    const uploadBtn = document.createElement('button')
    uploadBtn.id = 'dev-upload-btn'
    uploadBtn.className = 'btn btn-primary'
    uploadBtn.textContent = '📁 New'
    uploadBtn.title = 'Clear and upload new'
    uploadBtn.onclick = () => this.forceUploadNew()

    // Add to header
    headerActions.appendChild(clearBtn)
    headerActions.appendChild(uploadBtn)

    console.log('Development buttons added to header')
  }

  /**
   * Remove development buttons
   */
  removeDevButtons () {
    const clearBtn = document.getElementById('dev-clear-btn')
    const uploadBtn = document.getElementById('dev-upload-btn')

    if (clearBtn) clearBtn.remove()
    if (uploadBtn) uploadBtn.remove()

    console.log('Development buttons removed')
  }

  /**
   * Enable auto-loading of dev buttons on page refresh
   */
  enableAutoDevButtons () {
    localStorage.setItem('SnapSpot-dev-buttons', 'true')
    console.log('✅ Dev buttons will auto-load on refresh')

    // Add them now if not already present
    if (!document.getElementById('dev-clear-btn')) {
      this.addDevButtons()
    }
  }

  /**
   * Disable auto-loading of dev buttons
   */
  disableAutoDevButtons () {
    localStorage.setItem('SnapSpot-dev-buttons', 'false')
    console.log('❌ Dev buttons auto-load disabled')
  }

  /**
   * Check if auto dev buttons is enabled
   */
  isAutoDevButtonsEnabled () {
    return localStorage.getItem('SnapSpot-dev-buttons') === 'true'
  }
}

// Function to try loading debugUtils with retries
function tryLoadDebugUtils () {
  if (window.SnapSpotApp) {
    window.debugUtils = new DebugUtils(window.SnapSpotApp)

    // Check if we should auto-load dev buttons
    const autoLoadDevButtons = localStorage.getItem('SnapSpot-dev-buttons') === 'true'
    console.log('Debug: Checking auto-load dev buttons:', autoLoadDevButtons)

    if (autoLoadDevButtons) {
      console.log('Debug: Auto-loading dev buttons...')
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        try {
          window.debugUtils.addDevButtons()
          console.log('🔧 Dev buttons auto-loaded successfully')
        } catch (error) {
          console.error('Failed to auto-load dev buttons:', error)
        }
      }, 200)
    } else {
      console.log('Debug: Auto-load disabled or not set')
    }

    console.log('Debug utilities loaded. Available commands:')
    console.log('- debugUtils.createTestMaps(count)')
    console.log('- debugUtils.clearAllMaps()')
    console.log('- debugUtils.quickClear() - Fast clear without confirmation')
    console.log('- debugUtils.showStorageInfo()')
    console.log('- debugUtils.testStorageOperations()')
    console.log('- debugUtils.testErrorHandling()')
    console.log('- debugUtils.showMapInfo()')
    console.log('- debugUtils.toggleMapDebug()')
    console.log('- debugUtils.diagnoseCanvas()')
    console.log('- debugUtils.resetMapView()')
    console.log('- debugUtils.forceUploadNew() - Clear and upload new')
    console.log('- debugUtils.enableAutoDevButtons() - Auto-load buttons on refresh')
    console.log('- debugUtils.disableAutoDevButtons() - Disable auto-load')
    console.log('')
    console.log('🔧 SIMPLE F5-SAFE COMMANDS:')
    console.log('- localStorage.setItem("SnapSpot-dev-buttons", "true") then refresh')
    console.log('- localStorage.setItem("SnapSpot-dev-buttons", "false") to disable')

    return true
  }
  return false
}

// Try multiple times to handle timing issues
window.addEventListener('load', tryLoadDebugUtils)
window.addEventListener('DOMContentLoaded', tryLoadDebugUtils)

// Also try after a short delay (for F5 compatibility)
setTimeout(tryLoadDebugUtils, 100)
setTimeout(tryLoadDebugUtils, 500)
