// js/MapDataExporterImporter.js

/* global Blob, URL, crypto */ // Declare global objects used in this file

/**
 * Utility class for managing the export and import of Image Mapper data.
 * This includes maps, markers, and their associated photo data.
 * It handles the necessary conversions between Blob and Base64 formats
 * for image data to be included in JSON files.
 */
class MapDataExporterImporter {
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

    if (exportMap.imageData instanceof Blob) {
      exportMap.imageData = await imageProcessor.blobToBase64(exportMap.imageData)
    } else {
      console.warn(`MapDataExporterImporter: Map "${map.id}" imageData is not a Blob. Assuming it's already suitable for JSON export (e.g., Base64 string or missing).`)
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
      version: '1.0', // Data structure version for future compatibility
      type: 'ImageMapperDataExport', // A unique identifier for this type of JSON file
      sourceApp: 'ImageMapper PWA', // For informational purposes, identifies the source app
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
    a.download = `ImageMapper_Export_${map.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url) // Clean up the object URL

    console.log(`MapDataExporterImporter: Map "${map.name}" data exported successfully.`)
  }

  /**
     * Imports map data from a JSON string.
     * Base64 image data (map.imageData, photo.imageData) will be converted back to Blobs.
     * New UIDs will be generated for all imported maps, markers, and photos to prevent collisions.
     * Relationships (mapId for markers, markerId for photos, photoIds for markers) are updated
     * to reflect the new UIDs.
     *
     * @param {string} jsonString The JSON string content from the import file.
     * @param {object} ImageProcessorClass The ImageProcessor CLASS itself (not an instance) for base64ToBlob method.
     * @returns {Promise<{map: object, markers: Array<object>, photos: Array<object>}>} The imported data,
     *          with image data as Blobs and new UIDs, ready for storage.
     * @throws {Error} If the JSON data is invalid or not an ImageMapper export.
     */
  static async importData (jsonString, ImageProcessorClass) {
    console.log('MapDataExporterImporter: Attempting to import data...')
    let importObject
    try {
      importObject = JSON.parse(jsonString)
    } catch (error) {
      throw new Error('MapDataExporterImporter: Invalid JSON file. Could not parse data. Error: ' + error.message)
    }

    if (importObject.type !== 'ImageMapperDataExport' || importObject.version !== '1.0' || !importObject.map || !importObject.markers || !importObject.photos) {
      throw new Error('MapDataExporterImporter: Invalid ImageMapper export file. Version mismatch or incorrect type/structure.')
    }

    // --- DEBUGGING START ---
    console.log('--- DBG: Raw importObject (map) ---', JSON.parse(JSON.stringify(importObject.map)))
    console.log('--- DBG: Raw importObject (markers) ---', JSON.parse(JSON.stringify(importObject.markers)))
    console.log('--- DBG: Raw importObject (photos) ---', JSON.parse(JSON.stringify(importObject.photos)))
    // --- DEBUGGING END ---

    // ---------- 1. GENERATE NEW IDS FOR ALL PRIMARY ENTITIES ----------
    const oldToNewIdMap = new Map()

    const generateAndMapNewId = (oldId) => {
      const newId = crypto.randomUUID()
      oldToNewIdMap.set(oldId, newId)
      console.log(`DBG Mapping: OLD [${oldId}] -> NEW [${newId}]`)
      return newId
    }

    // --- Generate & Map New IDs for Map, Markers, and Photos ---
    console.log('--- DBG: Generating All New IDs ---')

    const originalMapId = importObject.map.id
    const newMapId = generateAndMapNewId(originalMapId)
    console.log(`DBG Final New Map ID stored: ${newMapId}`)

    const newMarkerIds = new Map() // Keep track of old marker ID to new marker ID for direct lookup later
    importObject.markers.forEach(marker => {
      const newId = generateAndMapNewId(marker.id)
      newMarkerIds.set(marker.id, newId)
      console.log(`DBG Final New Marker ID stored for original [${marker.id}]: ${newId}`)
    })

    const newPhotoIds = new Map() // Keep track of old photo ID to new photo ID for direct lookup later
    importObject.photos.forEach(photo => {
      const newId = generateAndMapNewId(photo.id)
      newPhotoIds.set(photo.id, newId)
      console.log(`DBG Final New Photo ID stored for original [${photo.id}]: ${newId}`)
    })
    console.log('--- DBG: All New IDs Generated and Mapped ---')
    console.log('--- DBG: Full oldToNewIdMap ---', oldToNewIdMap)

    // ---------- 2. PROCESS ENTITIES, CONVERT BLOBS, AND ASSIGN NEW IDs / UPDATE RELATIONSHIPS ----------
    console.log('--- DBG: Processing Entities for Final Output ---')

    // Process Map: Assign its newly generated ID
    console.log(`DBG Map Process: Original ID [${importObject.map.id}]`)
    console.log(`DBG Map Process: Assigning new ID [${newMapId}]`)
    const importedMap = { ...importObject.map, id: newMapId }
    if (importedMap.imageData && typeof importedMap.imageData === 'string' && importedMap.imageData.startsWith('data:')) {
      importedMap.imageData = await ImageProcessorClass.base64ToBlob(importedMap.imageData, importedMap.fileType)
    } else {
      console.warn(`MapDataExporterImporter: Imported map "imageData" for ${importedMap.id} is not a Base64 string. Importing as is.`)
    }
    if (importedMap.createdDate) importedMap.createdDate = new Date(importedMap.createdDate)
    if (importedMap.lastModified) importedMap.lastModified = new Date(importedMap.lastModified)
    console.log(`DBG Imported Map: id [${importedMap.id}]`)

    // Process Markers: Assign their new ID, and update mapId reference
    const importedMarkers = await Promise.all(importObject.markers.map(async marker => {
      const currentMarkerNewId = newMarkerIds.get(marker.id) // Get its newly generated ID
      console.log(`DBG Marker Process: Original ID [${marker.id}] -> New ID [${currentMarkerNewId}]`)

      // Use the consistent newMapId for mapId reference
      console.log(`DBG Marker Process: Original mapId [${marker.mapId}] -> Assigning new mapId [${newMapId}] (from stored newMapId)`)
      const newMarker = { ...marker, id: currentMarkerNewId, mapId: newMapId } // Directly assign newMapId

      // Update photoIds array with NEW photo IDs
      newMarker.photoIds = newMarker.photoIds
        .map(oldPhotoId => {
          const newRefPhotoId = newPhotoIds.get(oldPhotoId)
          console.log(`DBG Marker PhotoIds: Original photoId [${oldPhotoId}] -> New Ref PhotoId [${newRefPhotoId}]`)
          return newRefPhotoId
        })
        .filter(newId => newId) // Filter out any undefined/null if an ID lookup failed

      if (newMarker.createdDate) newMarker.createdDate = new Date(newMarker.createdDate)
      if (newMarker.lastModified) newMarker.lastModified = new Date(newMarker.lastModified)

      return newMarker
    }))
    console.log('DBG Imported Markers Array:', importedMarkers.map(m => `[${m.id}] MapRef: [${m.mapId}]`))

    // Process Photos: Assign their new ID, and update markerId reference
    const importedPhotos = await Promise.all(importObject.photos.map(async photo => {
      const currentPhotoNewId = newPhotoIds.get(photo.id) // Get its newly generated ID
      console.log(`DBG Photo Process: Original ID [${photo.id}] -> New ID [${currentPhotoNewId}]`)

      const markerRefOldId = photo.markerId
      const newMarkerRefId = newMarkerIds.get(markerRefOldId) // Get new ID from newMarkerIds map
      console.log(`DBG Photo Process: Original markerId [${markerRefOldId}] -> Assigning new markerId [${newMarkerRefId}]`)

      const newPhoto = { ...photo, id: currentPhotoNewId, markerId: newMarkerRefId }

      if (newPhoto.imageData && typeof newPhoto.imageData === 'string' && newPhoto.imageData.startsWith('data:')) {
        newPhoto.imageData = await ImageProcessorClass.base64ToBlob(newPhoto.imageData, newPhoto.fileType)
      } else {
        console.warn(`MapDataExporterImporter: Imported photo "${newPhoto.id}" imageData is not a Base64 string. Importing as is.`)
      }
      if (newPhoto.createdDate) newPhoto.createdDate = new Date(newPhoto.createdDate)

      return newPhoto
    }))
    console.log('DBG Imported Photos Array:', importedPhotos.map(p => `[${p.id}] MarkerRef: [${p.markerId}]`))

    console.log('MapDataExporterImporter: Data processed for import:', { map: importedMap, markers: importedMarkers, photos: importedPhotos })
    return { map: importedMap, markers: importedMarkers, photos: importedPhotos }
  }
}
