/**
 * SnapSpot PWA - Search Functionality
 * Handles search operations for maps, markers, and photos
 */

// Export all search-related functions
export async function searchMaps (app, query) {
  console.log('App: Performing map search for query:', query)
  const lowerCaseQuery = query.toLowerCase()

  // 1. Get all maps from storage (now includes markerCount from storage.getAllMaps())
  const allMapsWithCounts = await app.storage.getAllMaps()

  // 2. Prepare all maps with thumbnails, inline from _getPreparedMapsForDisplay
  const allMapsPrepared = await Promise.all(allMapsWithCounts.map(async (map) => {
    let thumbnailDataUrl = app.thumbnailCache.get(map.id)
    // If no thumbnail in cache and map data is a Blob (from storage)
    if (!thumbnailDataUrl && map.imageData instanceof Blob) {
      try {
        // Use a smaller size for thumbnails displayed in lists
        const mapThumbnailSettings = app.imageCompressionSettings.thumbnail
        thumbnailDataUrl = await app.imageProcessor.generateThumbnailDataUrl(map.imageData, mapThumbnailSettings.maxSize)
        if (thumbnailDataUrl) {
          app.thumbnailCache.set(map.id, thumbnailDataUrl)
        }
      } catch (thumbError) {
        console.warn(`App: Failed to generate thumbnail for map ${map.id}:`, thumbError)
        thumbnailDataUrl = null
      }
    } else if (!map.imageData || !(map.imageData instanceof Blob)) {
      // If map.imageData is null/undefined or not a Blob, explicitly set thumbnail to null
      thumbnailDataUrl = null
    }
    // Return map object with the generated/cached thumbnailDataUrl
    return { ...map, thumbnailDataUrl }
  }))

  // 3. Filter this prepared list based on the search query
  const filteredMaps = allMapsPrepared.filter(map =>
    map.name.toLowerCase().includes(lowerCaseQuery) ||
    (map.description && map.description.toLowerCase().includes(lowerCaseQuery)) ||
    (map.fileName && map.fileName.toLowerCase().includes(lowerCaseQuery))
  )

  console.log(`App: Found ${filteredMaps.length} maps matching query "${query}".`)
  return filteredMaps
}

export async function searchPhotos (app, query) {
  if (!query) {
    return []
  }
  const searchTerm = query.toLowerCase()
  const allEnrichedPhotos = await app.storage.getAllPhotosWithContext()

  // Generate thumbnails for each photo before returning them
  const preparedPhotos = await Promise.all(allEnrichedPhotos.map(async (photo) => {
    let thumbnailDataUrl = app.thumbnailCache.get(photo.id)
    if (!thumbnailDataUrl && photo.imageData instanceof Blob) {
      try {
        const photoThumbnailSettings = app.imageCompressionSettings.thumbnail
        thumbnailDataUrl = await app.imageProcessor.generateThumbnailDataUrl(photo.imageData, photoThumbnailSettings.maxSize)
        if (thumbnailDataUrl) {
          app.thumbnailCache.set(photo.id, thumbnailDataUrl)
        }
      } catch (thumbError) {
        console.warn(`App: Failed to generate thumbnail for photo ${photo.id}:`, thumbError)
        thumbnailDataUrl = null
      }
    }
    return { ...photo, thumbnailDataUrl }
  }))

  return preparedPhotos.filter(photo =>
    photo.fileName.toLowerCase().includes(searchTerm)
  )
}

export async function handleSearchFileSelection (app) {
  try {
    // Replicate the successful pattern: close modal, then delay
    if (app.modalManager.getTopModalId() === 'search-modal') {
      app.modalManager.closeTopModal()
    }
    await new Promise(resolve => setTimeout(resolve, 350)) // Ensure modal is truly gone

    // Now, call fileManager.selectFiles. The file picker will appear.
    const selectedFiles = await app.fileManager.selectFiles(false, true) // (allowMultiple = false, acceptImagesOnly = true)
    app.showLoading('Processing file for search...')

    if (selectedFiles === null || selectedFiles.length === 0) {
      app.showNotification('File selection cancelled.', 'info')
      return
    }

    const selectedFile = selectedFiles[0]

    // Re-open the search modal if it was closed, to show results within it
    // This will also trigger the performSearch logic if initialQuery is set
    app.searchManager.openSearchModal(selectedFile.name)
  } catch (error) {
    console.error('Error selecting file for search:', error)
    app.showErrorMessage('File Selection Error', `Failed to select file for search: ${error.message}`)
    // Re-open the search modal if an error occurred after closing it
    app.searchManager.openSearchModal()
  } finally {
    app.hideLoading() // Always hide loading in the end
  }
}

export async function onShowPhotoOnMap (app, photoData) {
  if (!photoData || !photoData.mapId || !photoData.markerId) {
    console.error('App: Invalid photoData for onShowPhotoOnMap', photoData)
    return
  }

  app.showLoading(`Showing photo ${photoData.fileName} on map ${photoData.mapName}...`)

  try {
    // 1. Switch to the map where the photo's marker is located
    // This will also trigger mapRenderer to load and render the correct map.
    await app.switchToMap(photoData.mapId)

    // 2. Fetch the marker to get its coordinates
    const marker = await app.storage.getMarker(photoData.markerId)
    if (marker) {
      // Close search modal if it's open, as we're navigating to the map
      app.modalManager.closeTopModal() // This closes the search modal

      // 3. Pan and zoom the map to center on the marker
      const targetZoomFactor = 1.5
      app.mapRenderer.panAndZoomToCoordinates(marker.x, marker.y, targetZoomFactor)

      // 4. Highlight the marker to draw attention to it
      app.mapRenderer.highlightMarker(marker.id)

      app.showNotification(`Focused on marker for photo "${photoData.fileName}"`, 'info')
      console.log(`App: Focused on marker ${marker.id} on map ${photoData.mapId} for photo ${photoData.id}`)
    } else {
      console.warn(`App: Marker ${photoData.markerId} not found for photo ${photoData.id}. Cannot focus on marker.`)
      app.showNotification(`Could not find marker for photo "${photoData.fileName}" on map.`, 'warning')
    }
  } catch (error) {
    console.error(`App: Error showing photo ${photoData.id} on map:`, error)
    app.showErrorMessage('Error Showing Photo on Map', `Failed to show photo on map: ${error.message}`)
  } finally {
    app.hideLoading()
  }
}
