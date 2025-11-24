/**
 * SnapSpot App Settings Module
 * Moved from app.js: showSettings orchestration, data prep, settings getters/setters.
 * All functions take `app` instance as first param.
 */

/* global localStorage */

import { handleViewImageInViewer } from './app-marker-photo-manager.js'

/**
  * Returns the current photo quality setting.
  */
export function getPhotoQuality (app) {
  return app.imageCompressionSettings.photo.quality
}

/**
 * Sets photo quality and persists.
 */
export function setPhotoQuality (app, qualityPercentage) {
  // Convert percentage (10-100) to decimal (0.1-1.0)
  const decimalQuality = qualityPercentage / 100
  // Ensure quality is within valid range (0.1 to 1.0)
  const clampedQuality = Math.max(0.1, Math.min(1.0, decimalQuality))
  app.imageCompressionSettings.photo.quality = clampedQuality
  localStorage.setItem('defaultPhotoQuality', clampedQuality) // Persist the decimal value
  app.showNotification(`Image quality for markers set to ${qualityPercentage}%.`, 'info')
  console.log('Image quality for markers set to:', clampedQuality)
}

/**
 * Returns auto-close marker details setting.
 */
export function getAutoCloseMarkerDetails (app) {
  return app.autoCloseMarkerDetails
}

/**
 * Sets auto-close marker details and persists.
 */
export function setAutoCloseMarkerDetails (app, value) {
  app.autoCloseMarkerDetails = value
  localStorage.setItem('autoCloseMarkerDetails', value)
  app.showNotification(`Auto-close marker details: ${app.autoCloseMarkerDetails ? 'Enabled' : 'Disabled'}.`, 'info')
  console.log('Auto-close marker details:', app.autoCloseMarkerDetails)
}

/**
 * Returns allow duplicate photos setting.
 */
export function getAllowDuplicatePhotos (app) {
  return app.allowDuplicatePhotos
}

/**
 * Sets allow duplicate photos and persists.
 */
export function setAllowDuplicatePhotos (app, value) {
  app.allowDuplicatePhotos = value
  localStorage.setItem('allowDuplicatePhotos', value)
  app.showNotification(`Allow duplicate photos: ${app.allowDuplicatePhotos ? 'Enabled' : 'Disabled'}.`, 'info')
  console.log('Allow duplicate photos:', app.allowDuplicatePhotos)
}

/**
 * Returns max markers to show.
 */
export function getMaxMarkersToShow (app) {
  return app.maxMarkersToShow
}

/**
 * Sets max markers to show and persists, refreshes display if map active.
 */
export function setMaxMarkersToShow (app, maxMarkers) {
  app.maxMarkersToShow = maxMarkers
  localStorage.setItem('maxMarkersToShow', maxMarkers.toString())
  console.log(`App: Max markers to show set to: ${maxMarkers === 0 ? 'unlimited' : maxMarkers}`)
  // If we have a current map loaded, refresh the marker display
  if (app.currentMap) {
    app.refreshMarkersDisplay()
  }
}

/**
 * Returns notifications enabled.
 */
export function getNotificationsEnabled (app) {
  return app.notificationsEnabled
}

/**
 * Sets notifications enabled and persists.
 */
export function setNotificationsEnabled (app, value) {
  app.notificationsEnabled = value
  localStorage.setItem('notificationsEnabled', value)
  app.showNotification(`Notifications: ${app.notificationsEnabled ? 'Enabled' : 'Disabled'}.`, 'info')
  console.log('Notifications enabled:', app.notificationsEnabled)
}

/**
 * Retrieves custom marker coloring rules from localStorage.
 */
export function getCustomMarkerColorRules (app) {
  try {
    const rulesJson = localStorage.getItem(app.customMarkerRulesKey)
    return rulesJson ? JSON.parse(rulesJson) : []
  } catch (error) {
    console.error('App: Error parsing custom marker rules from localStorage', error)
    return []
  }
}

/**
 * Saves custom marker coloring rules to localStorage.
 */
export function setCustomMarkerColorRules (app, rules) {
  try {
    localStorage.setItem(app.customMarkerRulesKey, JSON.stringify(rules))
    app.customMarkerRules = rules // Update internal state
    console.log('App: Custom marker rules saved to localStorage.', rules)
    // Re-render map to apply new rules if a map is active
    if (app.currentMap) {
      app.refreshMarkersDisplay()
    }
  } catch (error) {
    console.error('App: Error saving custom marker rules to localStorage', error)
    app.showErrorMessage('Save Error', 'Failed to save custom marker coloring rules.')
  }
}

/**
 * Returns predefined custom marker colors.
 */
export function getCustomMarkerColors (app) {
  return app.customMarkerColors
}

/**
 * Returns predefined custom marker operators.
 */
export function getCustomMarkerOperators (app) {
  return app.customMarkerOperators
}

/**
 * Returns current custom marker rules.
 */
export function getCurrentCustomMarkerRules (app) {
  return app.customMarkerRules
}

/**
 * Sets custom marker rules and persists.
 */
export function setAndPersistCustomMarkerRules (app, rules) {
  setCustomMarkerColorRules(app, rules)
}

/**
 * Displays the App Settings modal.
 * @param {Object} app - SnapSpotApp instance.
 * @param {string} [initialTab='general-settings'] - Initial tab.
 */
export async function showSettings (app, initialTab = 'general-settings') {
  app.showLoading('Loading settings...', false)
  try {
    // Load maps from storage
    app.mapsList = await app.storage.getAllMaps()
    // Prepare maps with thumbnails using shared util
    const mapsWithDetails = await app.imageProcessor.prepareMapsForDisplay(
      app.mapsList,
      app.thumbnailCache,
      app.imageCompressionSettings
    )
    // Separate active map for sorting
    let activeMap = null
    const currentActiveMapId = app.currentMap ? app.currentMap.id : null
    if (currentActiveMapId) {
      const activeMapIndex = mapsWithDetails.findIndex(map => map.id === currentActiveMapId)
      if (activeMapIndex !== -1) {
        activeMap = mapsWithDetails.splice(activeMapIndex, 1)[0]
      }
    }
    // Sort remaining maps by name alphabetically
    mapsWithDetails.sort((a, b) => a.name.localeCompare(b.name))
    // Prepend active map if it exists
    if (activeMap) {
      mapsWithDetails.unshift(activeMap)
    }

    const settingsCallbacks = {
      onClearAllAppData: () => app.clearAllAppData(),
      // Maps Management Callbacks
      onMapSelected: async (mapId) => {
        await app.switchToMap(mapId)
        app.updateAppStatus(`Switched to map: ${app.currentMap.name}`)
        if (app.modalManager.getTopModalId() === 'settings-modal') {
          app.modalManager.closeTopModal()
        }
      },
      onMapDelete: async (mapId) => {
        await app.deleteMap(mapId)
        // showSettings will be called again by onSettingsModalRefresh after deletion
      },
      onAddNewMap: () => {
        app.showUploadModal()
      },
      onExportHtmlMap: async (mapId) => {
        await app.exportHtmlReport(mapId)
      },
      onExportJsonMap: async (mapId) => {
        await app.exportJsonMap(mapId)
      },
      onSettingsModalRefresh: (tabToReopen) => {
        // Close current and re-open to refresh maps list
        if (app.modalManager.getTopModalId() === 'settings-modal') {
          app.modalManager.closeTopModal()
        }
        showSettings(app, tabToReopen)
      },
      // Image viewer callback
      onViewImageInViewer: (id, type) => handleViewImageInViewer(app, id, type),
      // Data Management Callbacks
      onImportData: async (file) => {
        await app.handleImportFile(file)
        app.updateAppStatus('Data import complete.', 'success')
        // Trigger refresh
        settingsCallbacks.onSettingsModalRefresh('maps-management-settings')
      },
      // Map Display Callbacks
      isCrosshairEnabled: () => app.isCrosshairEnabled(),
      onToggleCrosshair: (enabled) => app.toggleCrosshair(enabled),
      // Image Processing Callbacks
      getPhotoQuality: () => getPhotoQuality(app),
      setPhotoQuality: (qualityPercentage) => setPhotoQuality(app, qualityPercentage),
      // App Behavior Callbacks
      getAutoCloseMarkerDetails: () => getAutoCloseMarkerDetails(app),
      setAutoCloseMarkerDetails: (value) => setAutoCloseMarkerDetails(app, value),
      getAllowDuplicatePhotos: () => getAllowDuplicatePhotos(app),
      setAllowDuplicatePhotos: (value) => setAllowDuplicatePhotos(app, value),
      // Max Markers Display Callbacks
      getMaxMarkersToShow: () => getMaxMarkersToShow(app),
      setMaxMarkersToShow: (maxMarkers) => setMaxMarkersToShow(app, maxMarkers),
      // Notifications
      getNotificationsEnabled: () => getNotificationsEnabled(app),
      setNotificationsEnabled: (value) => setNotificationsEnabled(app, value),
      // Custom Marker Coloring Callbacks
      getCustomMarkerColors: () => getCustomMarkerColors(app),
      getCustomMarkerOperators: () => getCustomMarkerOperators(app),
      getCurrentCustomMarkerRules: () => getCurrentCustomMarkerRules(app),
      setAndPersistCustomMarkerRules: (rules) => setAndPersistCustomMarkerRules(app, rules)
    }
    // Create and display the settings modal
    app.modalManager.createSettingsModal(
      settingsCallbacks,
      mapsWithDetails,
      currentActiveMapId,
      () => { // onClose
        app.updateAppStatus('Settings closed')
      },
      initialTab
    )
    app.updateAppStatus('Settings displayed')
  } catch (error) {
    console.error('App: Error showing settings modal:', error)
    app.showErrorMessage('Failed to open settings', error.message)
  } finally {
    app.hideLoading()
  }
}
