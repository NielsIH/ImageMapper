// js/MapDataExporterImporter.js

/* global Blob, URL, crypto */ // Declare global objects used in this file

/**
 * Utility class for managing the export and import of SnapSpot data.
 * This includes maps, markers, and their associated photo data.
 * It handles the necessary conversions between Blob and Base64 formats
 * for image data to be included in JSON files.
 */
export class MapDataExporterImporter {
  /**
     * Exports a map's data (map, markers, photos) to a JSON file.
     * It includes the main map image (map.imageData) and each photo's
     * optimized image data (photo.imageData) as Base64 strings for JSON serialization.
     * It also includes each photo's thumbnail data (photo.thumbnailData) if present.
     *
     * @param {object} map The map object retrieved from storage (includes map.imageData Blob).
     * @param {Array<object>} markers Array of marker objects for the map.
     * @param {Array<object>} photos Array of photo objects for the markers (includes photo.imageData Blob and photo.thumbnailData Base64).
     * @param {object} imageProcessor An instance of the ImageProcessor class with blobToBase64 method.
     */
  static async exportData (map, markers, photos, imageProcessor) {
    console.log(`MapDataExporterImporter: Preparing data for export for map "${map.name}" (${map.id}).`)

    // 1. Prepare Map Data for export
    const exportMap = { ...map } // Create a shallow copy to modify image data for export
    // The `markers` property on the map object itself is usually denormalized or not fully populated from storage;
    // we'll explicitly remove it as the full markers array is exported separately.
    delete exportMap.markers
    delete exportMap.filePath // filePath property may not be relevant for a data export
    // RE-ADDED: Convert map.imageData (Blob) to Base64 for export
    if (exportMap.imageData instanceof Blob) {
      exportMap.imageData = await imageProcessor.blobToBase64(exportMap.imageData)
    } else if (exportMap.imageData) { // If it exists but isn't a blob, assume it's already base64 or suitable
      console.warn(`MapDataExporterImporter: Map "${map.id}" imageData is not a Blob but exists. Exporting as is.`)
    } else {
      console.warn(`MapDataExporterImporter: Map "${map.id}" has no imageData. Export will be missing map image.`)
    }

    // NEW: Ensure imageHash is part of the exported map metadata
    if (!exportMap.imageHash) {
      console.warn(`MapDataExporterImporter: Map "${map.id}" does not have an imageHash. Export will not be merge-capable.`)
    }

    // 2. Prepare Markers Data for export
    // Markers contain photoIds which should be preserved. No Blobs directly in markers.
    const exportMarkers = markers.map(marker => ({ ...marker })) // Create shallow copies

    // 3. Prepare Photos Data for export
    const exportPhotos = await Promise.all(photos.map(async photo => {
      const exportPhoto = { ...photo } // Create a shallow copy

      // Convert photo.imageData (Blob) to Base64
      if (exportPhoto.imageData instanceof Blob) {
        exportPhoto.imageData = await imageProcessor.blobToBase64(exportPhoto.imageData)
      } else if (typeof exportPhoto.imageData !== 'string' || !exportPhoto.imageData.startsWith('data:')) {
        console.warn(`MapDataExporterImporter: Photo "${photo.id}" imageData is not a Blob or a Base64 string. Exporting as is (possibly null/undefined).`)
      }
      // `thumbnailData` is already a Base64 string, so it can be included directly.

      return exportPhoto
    }))

    // 4. Assemble the full export object
    const exportObject = {
      version: '1.1', // Data structure version for future compatibility - bumping for imageHash inclusion
      type: 'SnapSpotDataExport', // A unique identifier for this type of JSON file
      sourceApp: 'SnapSpot PWA', // For informational purposes, identifies the source app
      timestamp: new Date().toISOString(), // UTC timestamp when the export was created
      map: exportMap,
      markers: exportMarkers,
      photos: exportPhotos
    }

    // 5. Convert the JavaScript object to a pretty-printed JSON string
    const jsonString = JSON.stringify(exportObject, null, 2)

    // 6. Create a Blob from the JSON string and trigger a download
    const blob = new Blob([jsonString], { type: 'application/json' })
    const url = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = url
    // Generate a user-friendly filename based on map name and date
    a.download = `SnapSpot_Export_${map.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url) // Clean up the object URL

    console.log(`MapDataExporterImporter: Map "${map.name}" data exported successfully.`)
  }

  /**
   * Imports map data from a JSON string.
   * Base64 image data (map.imageData, photo.imageData) will be converted back to Blobs.
   * New UIDs will be generated for all imported maps, markers, and photos to prevent collisions
   * if importing as a new map. Relationships (mapId for markers, markerId for photos, photoIds for markers)
   * are updated to reflect the new UIDs.
   *
   * @param {string} jsonString The JSON string content from the import file.
   * @param {object} ImageProcessorClass The ImageProcessor CLASS itself (not an instance) for base64ToBlob method.
   * @param {MapStorage} mapStorage An instance of MapStorage for querying existing maps.
   * @returns {Promise<{map: object, markers: Array<object>, photos: Array<object>, importType: string, existingMaps: Array<object>}>} The imported data,
   *          with image data as Blobs and new UIDs, ready for storage. Also returns importType ('new', 'replace', 'merge')
   *          and matching existing maps if any, for UI decision making.
   * @throws {Error} If the JSON data is invalid or not an SnapSpot export.
   */
  static async importData (jsonString, ImageProcessorClass, mapStorage) {
    console.log('MapDataExporterImporter: Attempting to import data...')
    let importObject
    try {
      importObject = JSON.parse(jsonString)
    } catch (error) {
      throw new Error('MapDataExporterImporter: Invalid JSON file. Could not parse data. Error: ' + error.message)
    }

    if (importObject.type !== 'SnapSpotDataExport' || (!importObject.map || !importObject.markers || !importObject.photos)) {
      throw new Error('MapDataExporterImporter: Invalid SnapSpot export file. Missing required sections (map, markers, photos) or incorrect type.')
    }

    // Check version for compatibility and presence of imageHash
    if (parseFloat(importObject.version) < 1.0) {
      throw new Error(`MapDataExporterImporter: Export file version ${importObject.version} is too old. Minimum supported version is 1.0.`)
    }

    // --- DEBUGGING START ---
    console.log('--- DBG: Raw importObject (map) ---', JSON.parse(JSON.stringify(importObject.map)))
    console.log('--- DBG: Raw importObject (markers) ---', JSON.parse(JSON.stringify(importObject.markers)))
    console.log('--- DBG: Raw importObject (photos) ---', JSON.parse(JSON.stringify(importObject.photos)))
    // --- DEBUGGING END ---

    // NEW LOGIC: Decision point based on imageHash
    const importedImageHash = importObject.map ? importObject.map.imageHash : null
    let existingMaps = []
    let importType = 'new' // Default to 'new'

    if (importedImageHash) {
      existingMaps = await mapStorage.getMapsByImageHash(importedImageHash)
      if (existingMaps.length > 0) {
        // If there are existing maps with the same image hash, we offer merge/replace options
        // The UI (App.js) will need to prompt the user to choose one of these maps
        // and specify if they want to 'merge' or 'replace'.
        // For now, this function will simply return the potential matches.
        // The actual processing (generating new IDs or merging) will happen after user decision.
        console.log(`MapDataExporterImporter: Found ${existingMaps.length} existing map(s) with the same image hash.`)
        importType = 'decision_required' // Indicate that a user decision is needed
        // We'll return the raw imported object and the existing maps for the UI to handle.
        return { importObject, ImageProcessorClass, importType, existingMaps }
      }
    } else {
      console.warn('MapDataExporterImporter: Imported data does not contain an imageHash. Treating as a new map import (legacy format).')
    }

    // If no imageHash or no existing matches, proceed with processing as a new map import.
    // This calls the helper function to generate new IDs for everything.
    const processedData = await this._processImportedDataForNewMap(importObject, ImageProcessorClass)
    return { ...processedData, importType, existingMaps: [] }
  }

  /**
   * Helper method to process imported data, generating new UIDs for map, markers, and photos.
   * This is used when importing a file that is either legacy or the user chooses to treat it as a new map.
   * @param {object} importObject - The raw parsed import data.
   * @param {object} ImageProcessorClass - The ImageProcessor CLASS itself for base64ToBlob method.
   * @returns {Promise<{map: object, markers: Array<object>, photos: Array<object>}>} - Processed data with new UIDs.
   * @private
   */
  static async _processImportedDataForNewMap (importObject, ImageProcessorClass) {
    console.log('MapDataExporterImporter: Processing data for new map import (generating all new UIDs)...')

    const oldToNewIdMap = new Map()

    const generateAndMapNewId = (oldId) => {
      const newId = crypto.randomUUID()
      oldToNewIdMap.set(oldId, newId)
      return newId
    }

    // --- Generate & Map New IDs for Map, Markers, and Photos ---
    const newMapId = generateAndMapNewId(importObject.map.id)

    const newMarkerIds = new Map()
    importObject.markers.forEach(marker => {
      const newId = generateAndMapNewId(marker.id)
      newMarkerIds.set(marker.id, newId)
    })

    const newPhotoIds = new Map()
    importObject.photos.forEach(photo => {
      const newId = generateAndMapNewId(photo.id)
      newPhotoIds.set(photo.id, newId)
    })

    // ---------- 2. PROCESS ENTITIES, CONVERT BLOBS, AND ASSIGN NEW IDs / UPDATE RELATIONSHIPS ----------

    // Process Map: Assign its newly generated ID
    const importedMap = { ...importObject.map, id: newMapId }
    if (importedMap.imageData && typeof importedMap.imageData === 'string' && importedMap.imageData.startsWith('data:')) {
      importedMap.imageData = await ImageProcessorClass.base64ToBlob(importedMap.imageData, importedMap.fileType)
    }
    // ensure imageHash is there for new maps (if available from import or generated during processing later)
    if (!importedMap.imageHash && importObject.map.imageHash) {
      importedMap.imageHash = importObject.map.imageHash
    }

    // NEW LOGIC: Generate imageHash if it's missing (e.g., from legacy import)
    if (!importedMap.imageHash && importedMap.imageData instanceof Blob) {
      console.log('MapDataExporterImporter: Generating imageHash for legacy imported map.')
      try {
        const arrayBuffer = await importedMap.imageData.arrayBuffer()
        const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer)
        importedMap.imageHash = this._arrayBufferToHex(hashBuffer)
        console.log(`Generated hash for legacy map: ${importedMap.imageHash}`)
      } catch (error) {
        console.error('Failed to generate imageHash for legacy map:', error)
        // Continue without hash if it fails for some reason
      }
    }

    if (importedMap.createdDate) importedMap.createdDate = new Date(importedMap.createdDate)
    if (importedMap.lastModified) importedMap.lastModified = new Date(importedMap.lastModified)

    // Process Markers: Assign their new ID, and update mapId reference
    const importedMarkers = await Promise.all(importObject.markers.map(async marker => {
      const currentMarkerNewId = newMarkerIds.get(marker.id)
      const newMarker = { ...marker, id: currentMarkerNewId, mapId: newMapId } // Directly assign newMapId

      // Update photoIds array with NEW photo IDs
      newMarker.photoIds = newMarker.photoIds
        .map(oldPhotoId => newPhotoIds.get(oldPhotoId))
        .filter(newId => newId) // Filter out any undefined/null if an ID lookup failed

      if (newMarker.createdDate) newMarker.createdDate = new Date(newMarker.createdDate)
      if (newMarker.lastModified) newMarker.lastModified = new Date(newMarker.lastModified)

      return newMarker
    }))

    // Process Photos: Assign their new ID, and update markerId reference
    const importedPhotos = await Promise.all(importObject.photos.map(async photo => {
      const currentPhotoNewId = newPhotoIds.get(photo.id)
      const markerRefOldId = photo.markerId
      const newMarkerRefId = newMarkerIds.get(markerRefOldId)

      const newPhoto = { ...photo, id: currentPhotoNewId, markerId: newMarkerRefId }

      if (newPhoto.imageData && typeof newPhoto.imageData === 'string' && newPhoto.imageData.startsWith('data:')) {
        newPhoto.imageData = await ImageProcessorClass.base64ToBlob(newPhoto.imageData, newPhoto.fileType)
      }
      if (newPhoto.createdDate) newPhoto.createdDate = new Date(newPhoto.createdDate)

      return newPhoto
    }))

    console.log('MapDataExporterImporter: Data processed for new map import:', { map: importedMap, markers: importedMarkers, photos: importedPhotos })
    return { map: importedMap, markers: importedMarkers, photos: importedPhotos }
  }

  // --- NEW: Method for Merging Data into an Existing Map ---
  // This method will be responsible for applying imported markers and photos
  // to an already existing map, handling duplicates and updating relationships
  static async mergeData (existingMapId, importedObject, ImageProcessorClass, mapStorage) {
    console.log(`MapDataExporterImporter: Merging data into existing map "${existingMapId}"...`)

    // IMPORTANT: The existing map's full data (markers, photos) will need to be fetched
    // to compare against the imported data. For efficiency, fetching only data for the chosen map.
    const existingMap = await mapStorage.getMap(existingMapId)
    if (!existingMap) {
      throw new Error(`MapDataExporterImporter: Existing map with ID ${existingMapId} not found for merge operation.`)
    }

    const existingMarkers = await mapStorage.getMarkersForMap(existingMapId)
    const existingPhotos = await mapStorage.getPhotosForMap(existingMapId) // Note: getPhotosForMap returns photos with mapId, not just photo.imageData.

    const newMarkersToAdd = []
    const updatedMarkersToSave = []
    const newPhotosToAdd = []

    // --- Helper to convert Base64 to Blob for imported photos ---
    const convertPhotoToBlob = async (photo) => {
      const newPhoto = { ...photo } // Clone to avoid modifying original
      if (typeof newPhoto.imageData === 'string' && newPhoto.imageData.startsWith('data:')) {
        newPhoto.imageData = await ImageProcessorClass.base64ToBlob(newPhoto.imageData, newPhoto.fileType)
      }
      if (newPhoto.createdDate) newPhoto.createdDate = new Date(newPhoto.createdDate)
      return newPhoto
    }

    // --- Process Imported Markers ---
    for (const importedMarker of importedObject.markers) {
      // Find a matching existing marker by (x, y) coordinates
      const matchingExistingMarker = existingMarkers.find(
        m => m.x === importedMarker.x && m.y === importedMarker.y
      )

      if (matchingExistingMarker) {
        console.log(`MapDataExporterImporter: Found matching marker at (${importedMarker.x}, ${importedMarker.y}). Checking for new photos...`)

        // Update existing marker: only add new photos
        const updatedPhotoIds = new Set(matchingExistingMarker.photoIds) // Use a Set for efficient de-duplication

        for (const importedPhoto of importedObject.photos.filter(p => p.markerId === importedMarker.id)) {
          // Check if this imported photo already exists in the matching existing marker's photos by `id` or `fileName`
          // For simplicity, we'll assume `id` in the export is unique enough OR that `fileName` is a good indicator
          // (if IDs might not be globally unique but locally unique within an export)
          const photoAlreadyExists = existingPhotos.some(
            ep => ep.markerId === matchingExistingMarker.id && ep.fileName === importedPhoto.fileName
          )

          if (!photoAlreadyExists) {
            console.log(`MapDataExporterImporter: Adding new photo "${importedPhoto.fileName}" to existing marker "${matchingExistingMarker.id}"`)
            const processedPhoto = await convertPhotoToBlob(importedPhoto)
            processedPhoto.id = mapStorage.generateId('photo') // Generate new ID for the new photo
            processedPhoto.markerId = matchingExistingMarker.id // Link to the existing marker
            newPhotosToAdd.push(processedPhoto)
            updatedPhotoIds.add(processedPhoto.id)
          }
        }
        // Update the photoIds array of the existing marker
        if (updatedPhotoIds.size !== matchingExistingMarker.photoIds.length) {
          matchingExistingMarker.photoIds = Array.from(updatedPhotoIds)
          matchingExistingMarker.lastModified = new Date()
          updatedMarkersToSave.push(matchingExistingMarker)
        }
      } else {
        console.log(`MapDataExporterImporter: Adding new marker at (${importedMarker.x}, ${importedMarker.y}).`)
        // New marker: generate new IDs for the marker and its photos
        const newMarkerId = mapStorage.generateId('marker')
        const newPhotoIdsForMarker = []

        const newMarker = {
          ...importedMarker,
          id: newMarkerId,
          mapId: existingMapId, // Link to the target existing map
          createdDate: new Date(importedMarker.createdDate),
          lastModified: new Date()
        }

        for (const importedPhoto of importedObject.photos.filter(p => p.markerId === importedMarker.id)) {
          const processedPhoto = await convertPhotoToBlob(importedPhoto)
          processedPhoto.id = mapStorage.generateId('photo')
          processedPhoto.markerId = newMarkerId // Link to the newly generated marker ID
          newPhotosToAdd.push(processedPhoto)
          newPhotoIdsForMarker.push(processedPhoto.id)
        }
        newMarker.photoIds = newPhotoIdsForMarker
        newMarkersToAdd.push(newMarker)
      }
    }

    // --- Save all changes ---
    // Update existing markers (if photos were added to them)
    for (const marker of updatedMarkersToSave) {
      await mapStorage.saveMarker(marker)
    }

    // Add new photos
    for (const photo of newPhotosToAdd) {
      await mapStorage.savePhoto(photo)
    }

    // Add new markers
    for (const marker of newMarkersToAdd) {
      await mapStorage.saveMarker(marker)
    }

    console.log(`MapDataExporterImporter: Merge completed for map "${existingMapId}". Added ${newMarkersToAdd.length} new markers and ${newPhotosToAdd.length} new photos. Updated ${updatedMarkersToSave.length} existing markers.`)

    // Return the updated existing map (or null if it wasn't modified directly, but its children were)
    // For simplicity, we just return the existingMap and let App.js refresh data.
    return {
      map: existingMap,
      markers: [...existingMarkers, ...newMarkersToAdd], // A combined set of markers for potential UI refresh
      photos: [...existingPhotos, ...newPhotosToAdd] // A combined set of photos
    }
  }

  /**
   * Helper to convert an ArrayBuffer to a hexadecimal string.
   * This is duplicated from FileManager to avoid circular dependency,
   * as this class might need to handle raw image data for conversion in the future
   * (e.g., if re-serializing a map image for export, though currently only hash is exported).
   * @param {ArrayBuffer} buffer - The ArrayBuffer to convert.
   * @returns {string} - The hexadecimal string representation.
   */
  static _arrayBufferToHex (buffer) {
    return Array.prototype.map.call(new Uint8Array(buffer), (x) =>
      ('00' + x.toString(16)).slice(-2)
    ).join('')
  }
}
