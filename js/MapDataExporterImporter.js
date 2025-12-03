// js/MapDataExporterImporter.js

/* global Blob, URL, crypto, alert, FileReader Image */
import { HtmlReportGenerator } from './HtmlReportGenerator.js'
import { ImageProcessor } from './imageProcessor.js'
/**
 * Utility class for managing the export and import of SnapSpot data.
 * This includes maps, markers, and their associated photo data.
 * It handles the necessary conversions between Blob and Base64 formats
 * for image data to be included in JSON files.
 */
export class MapDataExporterImporter {
  /**
   * Exports a map's data (map, markers, photos) to a JSON file(s).
   * It includes the main map image (map.imageData) and each photo's
   * optimized image data (photo.imageData) as Base64 strings for JSON serialization.
   * It also includes each photo's thumbnail data (photo.thumbnailData) if present.
   *
   * @param {object} map The map object retrieved from storage (includes map.imageData Blob).
   * @param {Array<object>} allMarkers All marker objects for the map.
   * @param {Array<object>} allPhotos All photo objects for the markers.
   * @param {object} imageProcessor An instance of the ImageProcessor class with blobToBase64 method.
   * @param {object} [options] - Optional export options.
   * @param {string[]} [options.datesToExport] - An array of YYYY-MM-DD date strings to filter markers by.
   * @param {boolean} [options.splitByDate] - If true, generates a separate file for each date in datesToExport.
   * @param {MapStorage} [mapStorage] - An instance of MapStorage to update maps when imageHash is calculated.
   */
  static async exportData (map, allMarkers, allPhotos, imageProcessor, options = {}, mapStorage = null) {
    console.log(`MapDataExporterImporter: Preparing data for export for map "${map.name}" (${map.id}).`)

    const { datesToExport, splitByDate } = options

    let markersToExport = [...allMarkers]
    let photosToExport = [...allPhotos]

    if (datesToExport && datesToExport.length > 0) {
      console.log(`MapDataExporterImporter: Filtering markers and photos for selected dates: ${datesToExport.join(', ')}`)

      const filteredMarkers = allMarkers.filter(marker => {
        const createdDate = marker.createdDate instanceof Date ? marker.createdDate : new Date(marker.createdDate)
        const dateKey = createdDate.toISOString().slice(0, 10)
        return datesToExport.includes(dateKey)
      })

      const filteredMarkerIds = new Set(filteredMarkers.map(m => m.id))
      const filteredPhotos = allPhotos.filter(photo => filteredMarkerIds.has(photo.markerId))

      markersToExport = filteredMarkers
      photosToExport = filteredPhotos
    }

    // Prepare Map Data for export
    const exportMap = { ...map }
    delete exportMap.markers
    delete exportMap.filePath

    // Check if imageHash is missing and calculate it if possible
    if (!exportMap.imageHash) {
      console.log(`MapDataExporterImporter: Map "${map.id}" does not have an imageHash. Checking if we can calculate it...`)

      // Calculate imageHash if we have image data and mapStorage is provided
      if (mapStorage && exportMap.imageData instanceof Blob) {
        console.log('MapDataExporterImporter: Calculating imageHash for map during export...')
        try {
          const arrayBuffer = await exportMap.imageData.arrayBuffer()
          const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer)
          const calculatedImageHash = this._arrayBufferToHex(hashBuffer)

          // Update the export map with the calculated hash
          exportMap.imageHash = calculatedImageHash

          // Update the map in storage with the new imageHash
          await mapStorage.updateMap(exportMap.id, { imageHash: calculatedImageHash })

          console.log(`MapDataExporterImporter: Calculated and saved imageHash for map "${map.id}": ${calculatedImageHash}`)
        } catch (error) {
          console.error('MapDataExporterImporter: Failed to calculate imageHash for map:', error)
        }
      } else {
        console.warn(`MapDataExporterImporter: Map "${map.id}" does not have an imageHash and cannot calculate it (no mapStorage or imageData is not a Blob). Export will not be merge-capable.`)
      }
    }

    // Now convert image data to Base64 for export
    if (exportMap.imageData instanceof Blob) {
      exportMap.imageData = await imageProcessor.blobToBase64(exportMap.imageData)
    } else if (exportMap.imageData) {
      console.warn(`MapDataExporterImporter: Map "${map.id}" imageData is not a Blob but exists. Exporting as is.`)
    } else {
      console.warn(`MapDataExporterImporter: Map "${map.id}" has no imageData. Export will be missing map image.`)
    }

    // Prepare Markers Data for export
    const processedMarkers = markersToExport.map(marker => ({ ...marker }))

    // Prepare Photos Data for export
    const processedPhotos = await Promise.all(photosToExport.map(async photo => {
      const exportPhoto = { ...photo }
      if (exportPhoto.imageData instanceof Blob) {
        exportPhoto.imageData = await imageProcessor.blobToBase64(exportPhoto.imageData)
      } else if (typeof exportPhoto.imageData !== 'string' || !exportPhoto.imageData.startsWith('data:')) {
        console.warn(`MapDataExporterImporter: Photo "${photo.id}" imageData is not a Blob or a Base64 string. Exporting as is (possibly null/undefined).`)
      }
      return exportPhoto
    }))

    if (splitByDate && datesToExport && datesToExport.length > 1) {
      // Handle split by date into multiple files
      await this._exportSplitByDate(exportMap, processedMarkers, processedPhotos, datesToExport)
    } else {
      // Handle single combined file export
      const exportObject = this._createExportObject(exportMap, processedMarkers, processedPhotos)
      const jsonString = JSON.stringify(exportObject, null, 2)
      // If a single date is provided, use it in the filename
      const dateSuffix = (datesToExport && datesToExport.length === 1)
        ? datesToExport[0]
        : new Date().toISOString().slice(0, 10)
      this._triggerDownload(jsonString, `SnapSpot_Export_${map.name.replace(/\s+/g, '_')}_${dateSuffix}.json`)
      console.log(`MapDataExporterImporter: Map "${map.name}" data exported successfully.`)
    }
  }

  /**
   * Helper to create the standard export object format.
   * @param {object} map - The map object prepared for export.
   * @param {Array<object>} markers - The marker objects prepared for export.
   * @param {Array<object>} photos - The photo objects prepared for export.
   * @returns {object} The complete export object.
   * @private
   */
  static _createExportObject (map, markers, photos) {
    return {
      version: '1.1',
      type: 'SnapSpotDataExport',
      sourceApp: 'SnapSpot PWA',
      timestamp: new Date().toISOString(),
      map,
      markers,
      photos
    }
  }

  /**
   * Helper to trigger a file download.
   * @param {string} jsonString - The JSON string to download.
   * @param {string} filename - The desired filename.
   * @private
   */
  static _triggerDownload (jsonString, filename) {
    const blob = new Blob([jsonString], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  /**
   * Helper to export data split by date into multiple files.
   * @param {object} baseMap - The map object (full map data, not filtered).
   * @param {Array<object>} allProcessedMarkers - All markers, already processed (Base64 photos are part of photos).
   * @param {Array<object>} allProcessedPhotos - All photos, already processed (Base64 photos).
   * @param {string[]} datesToExport - The dates selected for export.
   * @private
   */
  static async _exportSplitByDate (baseMap, allProcessedMarkers, allProcessedPhotos, datesToExport) {
    for (const dateKey of datesToExport) {
      const markersForDay = allProcessedMarkers.filter(marker => {
        const createdDate = marker.createdDate instanceof Date ? marker.createdDate : new Date(marker.createdDate)
        return createdDate.toISOString().slice(0, 10) === dateKey
      })

      const markerIdsForDay = new Set(markersForDay.map(m => m.id))
      const photosForDay = allProcessedPhotos.filter(photo => markerIdsForDay.has(photo.markerId))

      if (markersForDay.length > 0 || photosForDay.length > 0) {
        // Create an export object for this specific day
        const exportObject = this._createExportObject(baseMap, markersForDay, photosForDay)
        const jsonString = JSON.stringify(exportObject, null, 2)

        const filename = `SnapSpot_Export_${baseMap.name.replace(/\s+/g, '_')}_${dateKey}.json`
        this._triggerDownload(jsonString, filename)
        console.log(`MapDataExporterImporter: Data for map "${baseMap.name}" and date "${dateKey}" exported.`)
      }
    }
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
    // console.log('--- DBG: Raw importObject (map) ---', JSON.parse(JSON.stringify(importObject.map)))
    // console.log('--- DBG: Raw importObject (markers) ---', JSON.parse(JSON.stringify(importObject.markers)))
    // console.log('--- DBG: Raw importObject (photos) ---', JSON.parse(JSON.stringify(importObject.photos)))
    // --- DEBUGGING END ---

    const importedImageHash = importObject.map ? importObject.map.imageHash : null
    let existingMaps = []
    let importType = 'new' // Default to 'new'

    if (importedImageHash) {
      existingMaps = await mapStorage.getMapsByImageHash(importedImageHash)
      if (existingMaps.length > 0) {
        // Enhance the existing maps with marker counts for display
        const enhancedExistingMaps = []
        for (const map of existingMaps) {
          const markers = await mapStorage.getMarkersForMap(map.id)
          const enhancedMap = {
            ...map,
            markerCount: markers.length
          }
          enhancedExistingMaps.push(enhancedMap)
        }

        // If there are existing maps with the same image hash, we offer merge/replace options
        // The UI (App.js) will need to prompt the user to choose one of these maps
        // and specify if they want to 'merge' or 'replace'.
        // For now, this function will simply return the potential matches.
        // The actual processing (generating new IDs or merging) will happen after user decision.
        console.log(`MapDataExporterImporter: Found ${enhancedExistingMaps.length} existing map(s) with the same image hash.`)
        importType = 'decision_required' // Indicate that a user decision is needed
        // We'll return the raw imported object and the enhanced existing maps for the UI to handle.
        return { importObject, ImageProcessorClass, importType, existingMaps: enhancedExistingMaps }
      }
    } else {
      console.warn('MapDataExporterImporter: Imported data does not contain an imageHash. Treating as a new map import (legacy format).')
    }

    // If no imageHash or no existing matches, try secondary matching
    let secondaryMatches = []
    if (!importedImageHash || existingMaps.length === 0) {
      secondaryMatches = await this.getSecondaryMapMatches(importObject.map, mapStorage)
      if (secondaryMatches.length > 0) {
        console.log(`MapDataExporterImporter: Found ${secondaryMatches.length} potential matches based on secondary criteria.`)
        importType = 'decision_required' // Indicate that a user decision is needed
        return { importObject, ImageProcessorClass, importType, existingMaps: [], secondaryMatches }
      }
    }

    // If no secondary matches either, proceed with processing as a new map import.
    // This calls the helper function to generate new IDs for everything.
    const processedData = await this._processImportedDataForNewMap(importObject, ImageProcessorClass)
    return { ...processedData, importType, existingMaps: [], secondaryMatches: [] }
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

      // Convert imageData if needed
      if (newPhoto.imageData && typeof newPhoto.imageData === 'string' && newPhoto.imageData.startsWith('data:')) {
        newPhoto.imageData = await ImageProcessorClass.base64ToBlob(newPhoto.imageData, newPhoto.fileType)
      }
      // Convert thumbnailData if needed
      if (newPhoto.thumbnailData && typeof newPhoto.thumbnailData === 'string' && newPhoto.thumbnailData.startsWith('data:')) {
        newPhoto.thumbnailData = await ImageProcessorClass.base64ToBlob(newPhoto.thumbnailData, newPhoto.fileType)
      }
      // If thumbnailData is missing or invalid, set to null
      if (!newPhoto.thumbnailData || (typeof newPhoto.thumbnailData === 'object' && !(newPhoto.thumbnailData instanceof Blob))) {
        newPhoto.thumbnailData = null
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
      if (newPhoto.thumbnailData && typeof newPhoto.thumbnailData === 'string' && newPhoto.thumbnailData.startsWith('data:')) {
        newPhoto.thumbnailData = await ImageProcessorClass.base64ToBlob(newPhoto.thumbnailData, newPhoto.fileType)
      }
      // If thumbnailData is missing or invalid, set to null
      if (!newPhoto.thumbnailData || (typeof newPhoto.thumbnailData === 'object' && !(newPhoto.thumbnailData instanceof Blob))) {
        newPhoto.thumbnailData = null
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
   * Retrieves all markers for a given map and groups them by day.
   *
   * @param {string} mapId - The ID of the map.
   * @param {object} mapStorage - An instance of the MapStorage class.
   * @returns {Promise<Object<string, Array<object>>>} A promise that resolves to an object where keys are
   *          date strings (YYYY-MM-DD) and values are arrays of marker objects created on that day.
   */
  static async getMarkersGroupedByDay (mapId, mapStorage) {
    console.log(`MapDataExporterImporter: Grouping markers for map ${mapId} by day...`)
    const markers = await mapStorage.getMarkersForMap(mapId)
    const groupedMarkers = {}

    markers.forEach(marker => {
      // Ensure createdDate is a Date object
      const createdDate = marker.createdDate instanceof Date ? marker.createdDate : new Date(marker.createdDate)
      const dateKey = createdDate.toISOString().slice(0, 10) // YYYY-MM-DD

      if (!groupedMarkers[dateKey]) {
        groupedMarkers[dateKey] = []
      }
      groupedMarkers[dateKey].push(marker)
    })

    console.log(`MapDataExporterImporter: Found ${Object.keys(groupedMarkers).length} days with markers for map ${mapId}.`)
    return groupedMarkers
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

  /**
   * Get secondary map matches based on fuzzy matching criteria when imageHash doesn't match.
   * @param {object} importedMap - The imported map object to match against
   * @param {MapStorage} mapStorage - The storage instance to get all maps from
   * @param {number} [tolerance=0.05] - Tolerance for matching (5%)
   * @returns {Promise<Array>} - Array of potential matching maps with enhanced data
   */
  static async getSecondaryMapMatches (importedMap, mapStorage, tolerance = 0.05) {
    const allMaps = await mapStorage.getAllMaps()

    // For each matching map, get its marker count
    const matchedMaps = []
    for (const map of allMaps) {
      // Check dimension similarity (with tolerance)
      const widthMatch = importedMap.width && map.width &&
        Math.abs(map.width - importedMap.width) / map.width <= tolerance
      const heightMatch = importedMap.height && map.height &&
        Math.abs(map.height - importedMap.height) / map.height <= tolerance

      // Check file size similarity (with tolerance)
      const sizeMatch = importedMap.fileSize && map.fileSize &&
        Math.abs(map.fileSize - importedMap.fileSize) / map.fileSize <= tolerance

      // Check name similarity (substring match)
      const nameMatch = importedMap.fileName && map.fileName &&
        (importedMap.fileName.toLowerCase().includes(map.fileName.toLowerCase()) ||
          map.fileName.toLowerCase().includes(importedMap.fileName.toLowerCase()))

      // Check aspect ratio similarity (with tolerance)
      const importedAspectRatio = importedMap.width / importedMap.height
      const existingAspectRatio = map.width / map.height
      const aspectRatioMatch = importedMap.width && importedMap.height &&
        map.width && map.height &&
        Math.abs(importedAspectRatio - existingAspectRatio) / importedAspectRatio <= tolerance

      // If it's a match, add it with marker count
      if ((widthMatch && heightMatch) && (sizeMatch || nameMatch || aspectRatioMatch)) {
        // Get marker count for the map
        const markers = await mapStorage.getMarkersForMap(map.id)
        const enhancedMap = {
          ...map,
          markerCount: markers.length
        }
        matchedMaps.push(enhancedMap)
      }
    }

    return matchedMaps
  }

  /**
   * Handle new map upload: process image, save, display (extracted from app.js).
   * @param {Object} app - SnapSpotApp instance
   * @param {Object} mapData - Map metadata
   * @param {File|Blob} originalFile - Original file
   */
  static async handleMapUpload (app, mapData, originalFile) {
    console.log('MapDataExporterImporter.handleNewMapUpload:', mapData.name)

    try {
      app.updateAppStatus('Processing and saving map image...')

      // --- NEW STEP: Process the image for storage ---
      const processedImageBlob = await app.imageProcessor.processImage(originalFile, {
        maxWidth: app.imageCompressionSettings.map.maxWidth, // Max width for storing
        maxHeight: app.imageCompressionSettings.map.maxHeight, // Max height for storing
        quality: app.imageCompressionSettings.map.quality, // JPEG quality
        // You can consider 'image/webp' here if you want, but check browser compatibility for Canvas toBlob
        outputFormat: originalFile.type.startsWith('image/') ? originalFile.type : 'image/jpeg'
      })

      console.log('Original size:', originalFile.size, 'Processed size:', processedImageBlob.size)

      // We need to update mapData with the *new* dimensions and size of the processed image
      // To get the new dimensions easily, we can load the blob back into an image temporarily
      const processedImg = await new Promise((resolve, reject) => {
        const url = URL.createObjectURL(processedImageBlob)
        const img = new Image()
        img.onload = () => {
          URL.revokeObjectURL(url)
          resolve(img)
        }
        img.onerror = reject
        img.src = url
      })

      // Update mapData with the processed image details
      mapData.width = processedImg.width
      mapData.height = processedImg.height
      mapData.fileSize = processedImageBlob.size
      mapData.fileType = processedImageBlob.type
      // -----------------------------------------------

      // If app is set as active, deactivate other maps first
      if (mapData.isActive && app.mapsList.length > 0) {
        console.log('Setting as active map, deactivating others...')
      }

      // Save to storage (now including the processedImageBlob)
      const storageData = {
        name: mapData.name,
        description: mapData.description,
        fileName: mapData.fileName,
        filePath: mapData.filePath, // Consider if filePath is still relevant now it's a blob
        width: mapData.width, // Updated with processed dimensions
        height: mapData.height, // Updated with processed dimensions
        fileSize: mapData.fileSize, // Updated with processed size
        fileType: mapData.fileType, // Updated with processed type
        isActive: mapData.isActive,
        imageHash: mapData.imageHash, // Include imageHash for duplicate detection
        settings: mapData.settings,
        imageData: processedImageBlob // --- Store the actual BLOB data ---
      }

      const savedMap = await app.storage.addMap(storageData)
      console.log('Map saved successfully:', savedMap.id)

      // Store the *ORIGINAL* file reference (or the processed blob) for immediate rendering
      // We will now store the processed blob for immediate rendering too
      app.uploadedFiles.set(savedMap.id, processedImageBlob) // Changed from originalFile to processedImageBlob

      // Set as active if requested
      if (mapData.isActive) {
        await app.storage.setActiveMap(savedMap.id)
      }

      // Reload maps list
      await app.loadMaps()

      // Update UI
      app.checkWelcomeScreen()

      // Load and display the map if it's active
      if (mapData.isActive) {
        await app.displayMap(savedMap) // savedMap now contains imageData
      }

      // Show success message
      app.showNotification(`Map "${savedMap.name}" uploaded successfully!`, 'success')
      app.updateAppStatus(`Map uploaded: ${savedMap.name}`)

      console.log('Map upload completed successfully')
    } catch (error) {
      console.error('Map upload failed:', error)
      app.showErrorMessage('Map Upload Error', `Failed to save map: ${error.message}`)
      throw new Error(`Failed to save map: ${error.message}`)
    } finally {
      app.hideLoading() // Ensure loading indicator is hidden after processing
    }
  }

  /**
   * Exports a map's data to an HTML report (extracted from app.js).
   * @param {Object} app - SnapSpotApp instance
   * @param {string} mapId - Map ID
   */
  static async exportHtmlReport (app, mapId) {
    app.modalManager.closeAllModals()
    await new Promise(resolve => setTimeout(resolve, 100))
    app.updateAppStatus(`Generating HTML report for map ${mapId}...`)
    try {
      const map = await app.storage.getMap(mapId)
      if (!map) {
        console.error('MapDataExporterImporter: Map not found for HTML export:', mapId)
        alert('Map not found for HTML export.')
        app.updateAppStatus('Ready', 'error')
        return
      }
      const markers = await app.storage.getMarkersForMap(mapId)
      let allPhotos = []
      const photoPromises = []
      for (const marker of markers) {
        const markerPhotos = await app.storage.getPhotosForMarker(marker.id)
        markerPhotos.forEach(photo => {
          photoPromises.push(app.imageProcessor.blobToBase64(photo.imageData)
            .then(dataUrl => {
              photo.imageDataUrl = dataUrl
              return photo
            }))
        })
      }
      allPhotos = await Promise.all(photoPromises)
      allPhotos.sort((a, b) => a.fileName.localeCompare(b.fileName))
      await HtmlReportGenerator.generateReport(map, markers, allPhotos, app.imageProcessor)
      app.updateAppStatus(`HTML report for map "${map.name}" generated successfully.`, 'success')
    } catch (error) {
      console.error('MapDataExporterImporter: Error generating HTML report:', error)
      alert('Error generating HTML report. Check console for details.')
      app.updateAppStatus('HTML report generation failed', 'error')
    }
  }

  /**
   * Handles JSON map export with date filtering options (extracted from app.js).
   * @param {Object} app - SnapSpotApp instance
   * @param {string} mapId - Map ID
   */
  static async exportJsonMap (app, mapId) { // Renamed from _handleExportMapJson to match your existing method name
    // Close any open modals before export to prevent conflicts
    app.modalManager.closeAllModals()

    // Small delay to ensure cleanup is complete
    await new Promise(resolve => setTimeout(resolve, 100))

    app.updateAppStatus(`Preparing data for JSON export for map ${mapId}...`)
    try {
      const map = await app.storage.getMap(mapId)
      if (!map) {
        console.error('MapDataExporterImporter: Map not found for JSON export:', mapId)
        alert('Map not found for JSON export.')
        app.updateAppStatus('Ready', 'error')
        return
      }

      // Retrieve ALL markers and photos for the selected map initially
      // The MapDataExporterImporter will filter these based on user selection if needed.
      const allMarkers = await app.storage.getMarkersForMap(mapId)
      const allPhotos = []
      for (const marker of allMarkers) { // Iterate through the fetched markers
        const markerPhotos = await app.storage.getPhotosForMarker(marker.id)
        allPhotos.push(...markerPhotos)
      }

      // Group markers by day for the modal options -- using the new static method
      const groupedMarkersByDay = await MapDataExporterImporter.getMarkersGroupedByDay(mapId, app.storage)

      app.updateAppStatus('Ready to choose export options.')

      // Show the new export decision modal
      const exportDecision = await app.modalManager.createExportDecisionModal(map, groupedMarkersByDay)

      if (!exportDecision) {
        // User cancelled the export decision modal
        app.updateAppStatus('JSON export cancelled.', 'info')
        return
      }

      app.updateAppStatus('Exporting map data...')

      if (exportDecision.action === 'exportComplete') {
        // Perform complete export using the existing MapDataExporterImporter.exportData
        await MapDataExporterImporter.exportData(
          map,
          allMarkers, // Pass all markers
          allPhotos, // Pass all photos
          app.imageProcessor,
          {}, // options
          app.storage // mapStorage to update imageHash if missing
        )
        app.updateAppStatus(`JSON data for map "${map.name}" exported completely.`, 'success')
      } else if (exportDecision.action === 'exportByDays') {
        // Perform day-based export using the enhanced MapDataExporterImporter.exportData
        await MapDataExporterImporter.exportData(
          map,
          allMarkers, // Pass all markers
          allPhotos, // Pass all photos
          app.imageProcessor,
          {
            datesToExport: exportDecision.selectedDates,
            splitByDate: exportDecision.exportAsSeparateFiles
          },
          app.storage // mapStorage to update imageHash if missing
        )
        // Construct a more descriptive success message
        const numDates = exportDecision.selectedDates.length
        const exportType = exportDecision.exportAsSeparateFiles ? 'separate files' : 'a single file'
        app.updateAppStatus(`JSON data for map "${map.name}" for ${numDates} day(s) exported as ${exportType}.`, 'success')
      }
    } catch (error) {
      console.error('MapDataExporterImporter: Error during map export process:', error)
      alert(`Error exporting map: ${error.message}`) // Use alert for critical errors
      app.updateAppStatus('JSON export failed', 'error')
    } finally {
      // Ensure that app status is reset or indicates completion
      // The previous updateAppStatus calls already handle completion message.
    }
  }

  /**
 * Handles the file selected by the user for import.
 * @param {Object} app - SnapSpotApp instance
  * @param {File} file The JSON file to import.
 * @returns {Promise<Object|null>} A promise that resolves with the imported map object if successful, otherwise null.
 */
  static async handleImportFile (app, file) {
    app.updateAppStatus(`Importing data from "${file.name}"...`, 'info', true) // 'info' for starting, 'true' for dismissible
    try {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (e) => {
          // The actual processing must be awaited within this handler
          (async () => { // <--- Wrap the processing in an immediately invoked async function expression
            try {
              const jsonData = e.target.result

              //  Call importData, passing this.storage and handling the new return structure
              const importResult = await MapDataExporterImporter.importData(
                jsonData,
                ImageProcessor, // Assuming ImageProcessor is defined appropriately
                app.storage
              )

              if (importResult.importType === 'decision_required') {
                // Pause here, display modal for user decision
                const userChoice = await MapDataExporterImporter._showImportDecisionModal(app, importResult) // This will be async and wait for user input

                if (userChoice) {
                  const { action, selectedMapId } = userChoice
                  let finalMap = null
                  let finalMarkers = []
                  let finalPhotos = []
                  let successMessage = ''

                  if (action === 'merge') {
                    app.updateAppStatus(`Merging data into map "${selectedMapId}"...`, 'info', true)
                    // Call mergeData (which processes importedObject.markers/photos into existing map)
                    const mergedData = await MapDataExporterImporter.mergeData(
                      selectedMapId,
                      importResult.importObject,
                      ImageProcessor,
                      app.storage
                    )
                    finalMap = mergedData.map
                    finalMarkers = mergedData.markers
                    // finalPhotos = mergedData.photos // Removed unused assignment
                    successMessage = `Data merged into map '${finalMap.name}' successfully.`
                  } else if (action === 'replace') {
                    app.updateAppStatus(`Replacing map "${selectedMapId}" with imported data...`, 'info', true)
                    // First, get the processed new map data (with new IDs)
                    const processedNewData = await MapDataExporterImporter._processImportedDataForNewMap(
                      importResult.importObject,
                      ImageProcessor
                    )
                    finalMap = { ...processedNewData.map, id: selectedMapId } // Keep the old map ID for replacement
                    finalMarkers = processedNewData.markers.map(m => ({ ...m, mapId: selectedMapId }))
                    finalPhotos = processedNewData.photos.map(p => ({ ...p, markerId: finalMarkers.find(fm => fm.id === p.markerId).id })) // Link to the new marker IDs, which are based on old marker IDs

                    // Re-map photoIds in markers to the new marker IDs
                    // This is tricky if marker IDs are regenerated. We need to ensure photo.markerId links to the NEW marker ID for the replaced map
                    // It's cleaner to just regenerate all IDs and then re-assign the main map's ID.
                    // Let's refine the _processImportedDataForNewMap to handle this more cleanly if it's meant for replacement.
                    // For now, let's assume _processImportedDataForNewMap returns data with proper RELATIVE IDs, and we change the root map ID.

                    await this._deleteMapAndImportNew(app, selectedMapId, finalMap, finalMarkers, finalPhotos)
                    successMessage = `Map '${finalMap.name}' replaced successfully.`
                  } else if (action === 'new') {
                    app.updateAppStatus('Importing data as a new map...', 'info', true)
                    // Fallback to original "import as new" logic
                    const processedNewData = await MapDataExporterImporter._processImportedDataForNewMap(
                      importResult.importObject,
                      ImageProcessor
                    )
                    finalMap = processedNewData.map
                    finalMarkers = processedNewData.markers
                    finalPhotos = processedNewData.photos
                    await this._saveImportedData(app, finalMap, finalMarkers, finalPhotos)
                    successMessage = `Map '${finalMap.name}' imported as new successfully.`
                  }

                  if (finalMap) {
                    await app.loadMaps() // Reload maps to show changes
                    app.updateAppStatus(successMessage, 'success')
                    if (finalMap.id) {
                      await app.switchToMap(finalMap.id)
                      console.log('Processed map loaded and set as active.')
                    }
                    resolve(finalMap)
                  } else {
                    // User selected an action but it didn't result in a map (e.g., error in merge)
                    reject(new Error('Import/Merge operation cancelled or failed to produce a map.'))
                  }
                } else {
                  // User cancelled the decision modal
                  app.updateAppStatus('Import cancelled by user.', 'info')
                  resolve(null) // Resolve as null to indicate cancellation
                }
              } else { // Handle 'new' importType (legacy or no hash match)
                // ORIGINAL LOGIC for new import or legacy import fallback
                // (from importResult, which is already processed by _processImportedDataForNewMap if no decision needed)
                const { map, markers, photos } = importResult
                await this._saveImportedData(app, map, markers, photos) // Helper to encapsulate saving
                await app.loadMaps() // <= This must complete before resolve
                app.updateAppStatus(`Data from "${file.name}" imported successfully.`, 'success')
                if (map && map.id) {
                  await app.switchToMap(map.id)
                  console.log('Imported map loaded and set as active.')
                }
                resolve(map) // ONLY resolve AFTER all awaits here successfully completed
              }
            } catch (importError) {
              console.error('MapDataExporterImporter: Error processing imported data:', importError)
              alert(`Error processing imported data: ${importError.message}`)
              app.updateAppStatus('Import failed', 'error')
              reject(importError) // Reject if error in processing
            }
          })() // IIFE invoked
        }
        reader.onerror = (e) => {
          console.error('MapDataExporterImporter: Error reading file:', e)
          alert('Error reading file.')
          app.updateAppStatus('File read failed', 'error')
          reject(new Error('File read failed'))
        }
        reader.readAsText(file)
      })
    } catch (error) {
      console.error('MapDataExporterImporter: Unexpected error during file import setup:', error)
      alert('Unexpected error during file import setup.')
      app.updateAppStatus('Import setup failed', 'error')
      // Errors here occur *before* the FileReader is even set up
      return Promise.reject(error) // <--- Return a rejected Promise for consistency
    }
  }

  /**
 * Helper method to save imported map, markers, and photos to storage.
 * @param {Object} app - SnapSpotApp instance
  * @param {object} map - The map object to save.
 * @param {Array<object>} markers - An array of marker objects to save.
 * @param {Array<object>} photos - An array of photo objects to save.
 * @private
 */
  static async _saveImportedData (app, map, markers, photos) {
    await app.storage.saveMap(map)
    for (const marker of markers) {
      await app.storage.saveMarker(marker)
    }
    for (const photo of photos) {
      // Note: photo.imageData is already a Blob here due to ImageProcessorClass.base64ToBlob during import
      await app.storage.savePhoto(photo)
    }
  }

  /**
 * Helper method to delete an existing map and then import new data, maintaining the original map ID.
 * Used for the "Replace" action.
 * @param {Object} app - SnapSpotApp instance
 * @param {string} existingMapId - The ID of the map to be replaced.
 * @param {object} newMapData - The new map object to save (contains original map ID).
 * @param {Array<object>} newMarkersData - New marker objects.
 * @param {Array<object>} newPhotosData - New photo objects.
 * @private
 */
  static async _deleteMapAndImportNew (app, existingMapId, newMapData, newMarkersData, newPhotosData) {
    // First, delete the existing map and all its associated markers and photos
    await app.storage.deleteMap(existingMapId)

    // Then, save the new map data. The newMapData should already have existingMapId set for its ID.
    await app.storage.saveMap(newMapData)
    for (const marker of newMarkersData) {
      await app.storage.saveMarker(marker)
    }
    for (const photo of newPhotosData) {
      await app.storage.savePhoto(photo)
    }
  }

  /**
   * Displays a modal for the user to decide how to handle an imported map that matches
   * one or more existing maps by image hash.
   * @param {Object} app - SnapSpotApp instance
   * @param {object} importResult - The result object from MapDataExporterImporter.importData
   *                                including { importObject, ImageProcessorClass, importType, existingMaps }.
   * @returns {Promise<{action: string, selectedMapId: string}|null>} A promise that resolves with the user's
   *          chosen action ('merge', 'replace', 'new') and the ID of the selected existing map (if applicable),
   *          or null if the user cancels.
   * @private
   */
  static async _showImportDecisionModal (app, importResult) {
    // Prepare maps with thumbnails and marker counts for display
    const preparedExistingMaps = await app.imageProcessor.prepareMapsForDisplay(importResult.existingMaps || [], app.thumbnailCache, app.imageCompressionSettings)
    const preparedSecondaryMatches = await app.imageProcessor.prepareMapsForDisplay(importResult.secondaryMatches || [], app.thumbnailCache, app.imageCompressionSettings)

    // Show the new modal to get user's decision
    const userChoice = await app.modalManager.createImportDecisionModal(preparedExistingMaps, preparedSecondaryMatches)
    return userChoice
  }
}
