/**
 * SnapSpot PWA - Marker and Photo Management System
 * Handles marker creation, management, and photo operations
 */

import * as MapInteractions from './app-map-interactions.js'

// Export all marker and photo management functions
export async function placeMarker (app) {
  if (!app.currentMap || !app.mapRenderer.imageData) {
    console.warn('Cannot place marker: No map loaded or image data unavailable.')
    app.showNotification('Please load a map first before placing a marker.', 'warning')
    return
  }

  app.showLoading('Placing marker...')

  try {
    const centerX = app.mapRenderer.canvas.width / 2
    const centerY = app.mapRenderer.canvas.height / 2

    // Convert canvas center coordinates to map (image) coordinates
    const mapCoords = app.mapRenderer.screenToMap(centerX, centerY)

    if (!mapCoords) {
      throw new Error('Failed to convert screen coordinates to map coordinates.')
    }

    const newMarker = {
      mapId: app.currentMap.id,
      x: mapCoords.x,
      y: mapCoords.y,
      description: `Marker at ${mapCoords.x.toFixed(0)}, ${mapCoords.y.toFixed(0)}` // Default description
    }

    const savedMarker = await app.storage.addMarker(newMarker)
    app.markers.push(savedMarker) // Add to local array
    app.mapRenderer.setMarkers(app.markers) // Update mapRenderer
    app.mapRenderer.render() // Re-render to show the new marker

    app.showNotification('Marker placed successfully!', 'success')
    app.updateAppStatus('Marker added')
    console.log('Placed new marker:', savedMarker)
  } catch (error) {
    console.error('Failed to place marker:', error)
    app.showErrorMessage('Error Placing Marker', error.message)
  } finally {
    app.hideLoading()
  }
}

export function getMarkerAtPoint (app, clientX, clientY) {
  return MapInteractions.getMarkerAtPoint(app, clientX, clientY)
}

export async function showMarkerDetails (app, markerId) {
  app.showLoading('Loading marker details...')
  try {
    const marker = await app.storage.getMarker(markerId)
    if (!marker) {
      throw new Error('Marker not found.')
    }

    const allPhotosForMarker = await app.storage.getPhotosForMarker(marker.id)
    const validPhotos = allPhotosForMarker.filter(photo => (marker.photoIds || []).includes(photo.id))

    const displayX = marker.x.toFixed(0)
    const displayY = marker.y.toFixed(0)

    app.modalManager.createMarkerDetailsModal(
      {
        id: marker.id,
        description: marker.description,
        coords: `X: ${displayX}, Y: ${displayY}`,
        photoCount: validPhotos.length,
        photos: validPhotos // Pass photo data to the modal
      },
      // Callbacks for modal actions
      // onAddPhotos callback
      async () => {
        console.log('Add photos button clicked for marker', marker.id)
        if (app.modalManager.getTopModalId() === 'marker-details-modal') {
          app.modalManager.closeTopModal()
        }
        await new Promise(resolve => setTimeout(resolve, 350)) // Wait for modal to fully close

        const photosWereAdded = await addPhotosToMarker(app, marker.id)
        console.log('App: onAddPhotos photosWereAdded:', photosWereAdded)

        if (photosWereAdded && app.getAutoCloseMarkerDetails()) {
          app.showNotification('Marker details modal automatically closed after adding photos.', 'info')
        } else {
          await showMarkerDetails(app, marker.id)
        }
      },
      // onEditMarker callback (REVISED: This now directly triggers edit mode in modal)
      async (markerIdToEdit) => {
        console.log(`Edit marker button clicked for ${markerIdToEdit}. Toggling edit mode.`)
        // No need to close/re-open modal here, edit happens in-place
      },
      // onSaveDescription callback (NEW)
      async (markerIdToSave, newDescription) => {
        app.showLoading('Saving description...')
        try {
          await app.storage.updateMarker(markerIdToSave, {
            description: newDescription,
            lastModified: new Date()
          })
          const localMarker = app.markers.find(m => m.id === markerIdToSave)
          if (localMarker) {
            localMarker.description = newDescription
          }
          app.modalManager.updateMarkerDetailsDescription(markerIdToSave, newDescription)
          app.showNotification('Description updated.', 'success')
          console.log(`Marker ${markerIdToSave} description saved.`)
          await app.refreshMarkersDisplay() // Re-render map to reflect potential description changes affecting coloring
        } catch (error) {
          console.error('Failed to save description:', error)
          app.showErrorMessage('Save Error', `Failed to save description: ${error.message}`)
        } finally {
          app.hideLoading()
        }
      },
      // onDeleteMarker callback
      async (markerIdToDelete) => {
        console.log(`Delete marker ${markerIdToDelete} clicked`)
        app.modalManager.closeTopModal()
        await deleteMarker(app, markerIdToDelete)
      },
      // onDeletePhoto callback
      async (markerIdFromModal, photoIdFromModal) => { // <--- These arguments are provided by the modal
        app.modalManager.closeTopModal()
        await deletePhotoFromMarker(app, markerIdFromModal, photoIdFromModal)
        await showMarkerDetails(app, markerIdFromModal) // Correctly calling itself by original name
      },
      // onViewPhoto callback - This now opens the photo gallery in single photo mode
      async (photoIdFromModal) => { // <--- This argument is provided by the modal
        // Get all photos for the current marker
        const markerPhotos = await app.storage.getPhotosForMarker(markerId)

        // Get all markers for the current map to enrich photo data with marker descriptions
        const allMarkersForMap = await app.storage.getMarkersForMap(app.currentMap.id)
        const markerMap = new Map(allMarkersForMap.map(marker => [marker.id, marker]))

        // Enrich photos with associated marker descriptions and ensure thumbnailDataUrl is available
        const enrichedPhotos = await Promise.all(markerPhotos.map(async photo => {
          const associatedMarker = markerMap.get(photo.markerId)

          let thumbnailDataUrl = photo.thumbnailDataUrl
          // If thumbnailDataUrl is not set but thumbnailData exists, convert it
          if (!thumbnailDataUrl && photo.thumbnailData) {
            thumbnailDataUrl = photo.thumbnailData
          } else if (!thumbnailDataUrl && !photo.thumbnailData && photo.imageData) {
            try {
              thumbnailDataUrl = await app.imageProcessor.generateThumbnailDataUrl(
                photo.imageData,
                app.imageCompressionSettings.thumbnail.maxSize
              )
            } catch (error) {
              console.warn(`Failed to generate thumbnail for photo ${photo.id}:`, error)
            }
          }

          return {
            ...photo,
            thumbnailDataUrl: thumbnailDataUrl || null,
            markerDescription: associatedMarker ? associatedMarker.description : 'No marker description'
          }
        }))

        // Close the marker details modal
        app.modalManager.closeTopModal()

        // Show the photo gallery modal starting with the specific photo in single view
        app.modalManager.createPhotoGalleryModal(
          enrichedPhotos,
          {
            title: `Marker Gallery: ${marker.description || 'Untitled Marker'}`,
            showOnMapOption: false,
            initialPhotoId: photoIdFromModal
          },
          null, // onShowOnMap is not available for marker details
          // onDeletePhoto callback for the gallery
          async (photoIdToDelete) => {
            // Delete the photo from storage
            await app.storage.deletePhoto(photoIdToDelete)
            console.log(`Photo ${photoIdToDelete} deleted from storage.`)

            // Update the UI to reflect the deletion
            if (app.currentMap) {
              // Update local markers array if needed
              const localMarker = app.markers.find(m => m.id === marker.id)
              if (localMarker) {
                localMarker.photoIds = localMarker.photoIds.filter(id => id !== photoIdToDelete)
                localMarker.hasPhotos = (localMarker.photoIds.length > 0)
                app.mapRenderer.setMarkers(app.markers)
                app.mapRenderer.render()
              }
            }

            app.showNotification('Photo deleted successfully.', 'success')

            // Close and reopen the gallery to refresh the display
            app.modalManager.closeTopModal()
            await new Promise(resolve => setTimeout(resolve, 350)) // Wait for modal to close
            await showMarkerDetails(app, marker.id) // Show parent marker details again
          },
          // onClose callback
          async () => {
            console.log('Marker photo gallery closed.')
            // Reopen marker details after gallery closes
            await showMarkerDetails(app, marker.id)
          }
        )
      },
      // onClose callback
      () => {
        console.log('Marker details modal closed.')
        app.updateAppStatus('Ready')
      }
    )
    app.updateAppStatus(`Viewing marker: ${marker.id}`)
  } catch (error) {
    console.error('Failed to show marker details:', error)
    app.showErrorMessage('Marker Error', `Failed to open marker details: ${error.message}`) // This catches the "Marker not found" error, or others.
  } finally {
    app.hideLoading()
  }
}

export async function deleteMarker (app, markerId) {
  app.showLoading('Deleting marker...')
  try {
    // 1. Delete from IndexedDB (this also handles associated photos via storage.js)
    await app.storage.deleteMarker(markerId)
    console.log(`Marker ${markerId} and its photos deleted from storage.`)

    // 2. Remove from local markers array and update mapRenderer
    app.markers = app.markers.filter(m => m.id !== markerId)
    app.mapRenderer.setMarkers(app.markers)
    app.mapRenderer.render() // Re-render map to remove the marker visually

    app.showNotification('Marker deleted successfully.', 'success')
    app.updateAppStatus('Marker deleted.')

    // If the currently viewed map has no markers left, update status or provide a hint
    if (app.currentMap && app.markers.length === 0) {
      app.updateAppStatus('No markers on this map.')
    }
  } catch (error) {
    console.error('Failed to delete marker:', error)
    app.showErrorMessage('Delete Marker Error', `Failed to delete marker: ${error.message}`)
  } finally {
    app.hideLoading()
  }
}

export async function addPhotosToMarker (app, markerId) {
  app.showLoading('Adding photos...')
  let photosAdded = false
  try {
    const selectedFiles = await app.fileManager.selectFiles(true, true)
    if (!selectedFiles || selectedFiles.length === 0) {
      app.showNotification('Photo selection cancelled.', 'info')
      return false // Indicate no photos were added
    }

    const photoIdsToAdd = []
    // Fetch all photos currently on the active map once before the loop
    // MODIFIED: Use this.currentMap.id to get photos for the active map
    const allPhotosOnMap = await app.storage.getPhotosForMap(app.currentMap.id)

    for (const file of selectedFiles) {
      app.updateAppStatus(`Processing photo: ${file.name}...`)
      const isDuplicateAllowedSetting = app.getAllowDuplicatePhotos()

      if (!isDuplicateAllowedSetting) { // Only do check IF setting says NO duplicates
        const isDuplicateFound = allPhotosOnMap.some(p => p.fileName === file.name)
        // If a duplicate is found ANYWHERE on the map, skip this file
        if (isDuplicateFound) {
          app.showNotification(`Skipping duplicate photo: ${file.name} (already exists on this map)`, 'warning')
          continue // Skip this file
        }
      }
      const processOptions = {
        maxWidth: app.imageCompressionSettings.photo.maxWidth,
        maxHeight: app.imageCompressionSettings.photo.maxHeight,
        quality: app.imageCompressionSettings.photo.quality,
        outputFormat: 'image/jpeg'
      }
      const processedImageBlob = await app.imageProcessor.processImage(file, processOptions)
      const thumbnailDataUrl = await app.imageProcessor.generateThumbnailDataUrl(processedImageBlob, app.imageCompressionSettings.thumbnail.maxSize, 'image/jpeg', app.imageCompressionSettings.thumbnail.quality)
      const photoData = {
        markerId,
        imageData: processedImageBlob,
        thumbnailData: thumbnailDataUrl,
        fileName: file.name,
        fileType: 'image/jpeg',
        fileSize: processedImageBlob.size
      }
      const savedPhoto = await app.storage.addPhoto(photoData)
      photoIdsToAdd.push(savedPhoto.id)
    }
    // Update the marker with the new photo IDs
    if (photoIdsToAdd.length > 0) {
      const marker = await app.storage.getMarker(markerId)
      if (marker) {
        // Ensure photoIds array is initialized and add new unique IDs
        const updatedPhotoIds = [...new Set([...(marker.photoIds || []), ...photoIdsToAdd])]
        await app.storage.updateMarker(markerId, { photoIds: updatedPhotoIds, lastModified: new Date() })
        app.showNotification(`${photoIdsToAdd.length} photo(s) added to marker.`, 'success')
        //  Update local markers array and re-render map for visual change
        const localMarker = app.markers.find(m => m.id === markerId)
        if (localMarker) {
          localMarker.photoIds = updatedPhotoIds // Update local photoIds
          localMarker.hasPhotos = (updatedPhotoIds.length > 0) // Update local hasPhotos status (will be true)
        }
        app.mapRenderer.setMarkers(app.markers) // Pass updated local array
        app.mapRenderer.render() // Re-render to reflect new color if needed
        photosAdded = true // <--- Set flag to true if photos were successfully added
      }
    }
  } catch (error) {
    console.error('Failed to add photos to marker:', error)
    app.showErrorMessage('Photo Error', `Failed to add photos: ${error.message}`)
  } finally {
    app.hideLoading()
  }
  return photosAdded // <--- Return the flag
}

export async function deletePhotoFromMarker (app, markerId, photoId) {
  console.log('app.js: deletePhotoFromMarker received markerId:', markerId, 'photoIdToDelete:', photoId) // <--- ADD THIS LOG
  app.showLoading('Removing photo...')
  try {
    // 1. Get the marker and remove the photoId from its photoIds array
    const marker = await app.storage.getMarker(markerId)
    if (marker) {
      const updatedPhotoIds = marker.photoIds.filter(id => id !== photoId)
      await app.storage.updateMarker(markerId, { photoIds: updatedPhotoIds, lastModified: new Date() })
      console.log(`Removed photoId ${photoId} from marker ${markerId}`)

      //  Update local markers array and re-render map for visual change
      const localMarker = app.markers.find(m => m.id === markerId)
      if (localMarker) {
        localMarker.photoIds = updatedPhotoIds // Update local photoIds
        localMarker.hasPhotos = (updatedPhotoIds.length > 0) // Update local hasPhotos status
      }
      app.mapRenderer.setMarkers(app.markers) // Pass updated local array
      app.mapRenderer.render() // Re-render to reflect new color if needed
    } else {
      console.warn(`Marker ${markerId} not found when trying to delete photo ${photoId} reference.`)
    }

    // 2. Delete the photo itself from the photos store
    await app.storage.deletePhoto(photoId)
    console.log(`Photo ${photoId} deleted from storage.`)

    app.showNotification('Photo removed successfully.', 'success')
    // Implicitly, the refresh of the marker details modal will show the update
  } catch (error) {
    console.error('Failed to delete photo from marker:', error)
    app.showErrorMessage('Delete Photo Error', `Failed to remove photo: ${error.message}`)
  } finally {
    app.hideLoading()
  }
}

export async function showMapPhotoGallery (app) {
  if (!app.currentMap) {
    app.showNotification('Please load a map first before viewing the gallery.', 'warning')
    return
  }

  app.showLoading('Loading photo gallery...')
  try {
    // Get all photos for the current map
    const allPhotosForMap = await app.storage.getPhotosForMap(app.currentMap.id)

    // Get all markers for the current map to enrich photo data with marker descriptions
    const allMarkersForMap = await app.storage.getMarkersForMap(app.currentMap.id)
    const markerMap = new Map(allMarkersForMap.map(marker => [marker.id, marker]))

    // Enrich photos with associated marker descriptions and ensure thumbnailDataUrl is available
    const enrichedPhotos = await Promise.all(allPhotosForMap.map(async photo => {
      const associatedMarker = markerMap.get(photo.markerId)

      let thumbnailDataUrl = photo.thumbnailDataUrl
      // If thumbnailDataUrl is not set but thumbnailData exists, convert it
      if (!thumbnailDataUrl && photo.thumbnailData) {
        thumbnailDataUrl = photo.thumbnailData // thumbnailData should already be a data URL
      // If neither exists but we have imageData, try to generate a thumbnail
      } else if (!thumbnailDataUrl && !photo.thumbnailData && photo.imageData) {
        try {
          thumbnailDataUrl = await app.imageProcessor.generateThumbnailDataUrl(
            photo.imageData,
            app.imageCompressionSettings.thumbnail.maxSize
          )
        } catch (error) {
          console.warn(`Failed to generate thumbnail for photo ${photo.id}:`, error)
        }
      }

      return {
        ...photo,
        mapId: app.currentMap.id, // Add mapId for onShowPhotoOnMap function
        mapName: app.currentMap.name, // Add mapName for display
        thumbnailDataUrl: thumbnailDataUrl || null,
        markerDescription: associatedMarker ? associatedMarker.description : 'No marker description'
      }
    }))

    // Show the gallery modal
    app.modalManager.createPhotoGalleryModal(
      enrichedPhotos,
      {
        title: `Map Gallery: ${app.currentMap.name}`,
        showOnMapOption: true
      },
      // onShowOnMap callback
      async (photoData) => {
        // Close gallery modal
        app.modalManager.closeTopModal()

        // Switch to the map where the photo's marker is located (current map in this case)
        // and focus on the marker
        await app.onShowPhotoOnMap(photoData)
      },
      // onDeletePhoto callback
      async (photoId) => {
        // Find the photo to get its markerId
        const photo = enrichedPhotos.find(p => p.id === photoId)
        if (!photo) {
          app.showNotification('Photo not found.', 'warning')
          return
        }

        // Delete the photo from storage
        await app.storage.deletePhoto(photoId)
        console.log(`Photo ${photoId} deleted from storage.`)

        // Update the UI to reflect the deletion
        if (app.currentMap) {
          // Update local markers array if needed
          const localMarker = app.markers.find(m => m.id === photo.markerId)
          if (localMarker) {
            localMarker.photoIds = localMarker.photoIds.filter(id => id !== photoId)
            localMarker.hasPhotos = (localMarker.photoIds.length > 0)
            app.mapRenderer.setMarkers(app.markers)
            app.mapRenderer.render()
          }
        }

        app.showNotification('Photo deleted successfully.', 'success')

        // Close and reopen the gallery to refresh the display
        app.modalManager.closeTopModal()
        await new Promise(resolve => setTimeout(resolve, 350)) // Wait for modal to close
        await showMapPhotoGallery(app)
      },
      // onClose callback
      () => {
        console.log('Map photo gallery closed.')
        app.updateAppStatus('Ready')
      }
    )
    app.updateAppStatus(`Viewing photo gallery for map: ${app.currentMap.name}`)
  } catch (error) {
    console.error('Failed to load photo gallery:', error)
    app.showErrorMessage('Gallery Error', `Failed to load photo gallery: ${error.message}`)
  } finally {
    app.hideLoading()
  }
}

export async function deletePhotoFromImageViewer (app, photoId, markerId) {
  console.log(`App: Deleting photo ${photoId} for marker ${markerId} from image viewer.`)
  app.showLoading('Deleting image...')
  try {
    // 1. Close the image viewer modal first
    app.modalManager.closeTopModal() // This also handles object URL cleanup

    // 2. Call the existing method to handle the actual deletion from storage and UI updates
    await deletePhotoFromMarker(app, markerId, photoId)

    // 3. CRITICAL FIX: Explicitly close any existing marker details modal *before* displaying updated one
    const existingMarkerDetailsModal = document.getElementById('marker-details-modal')
    if (existingMarkerDetailsModal) {
      // Use closeModal (which handles transitions) with the specific modal element
      await app.modalManager.closeModal(existingMarkerDetailsModal)
      console.log('App: Closed existing marker details modal before refreshing.')
    }

    // 4. After deletion and successful UI update, re-open the marker details modal with the latest data
    //    This ensures the photo list in the marker details modal is also updated.
    await showMarkerDetails(app, markerId) // This will create and display a new, updated modal.

    app.showNotification('Image deleted successfully.', 'success')
    app.updateAppStatus('Image deleted.')
  } catch (error) {
    console.error('App: Failed to delete photo from image viewer:', error)
    app.showErrorMessage('Delete Photo Error', `Failed to delete image: ${error.message}`)
  } finally {
    app.hideLoading()
  }
}

export async function handleViewImageInViewer (app, id, type) {
  console.log(`app.js: handleViewImageInViewer received ID: ${id}, type: ${type}`)
  app.showLoading('Loading image...')
  try {
    let item
    let imageBlob
    let title
    let onDeleteCallback = null
    let photoIdForViewer = null

    if (type === 'map') {
      item = await app.storage.getMap(id)
      if (!item || !item.imageData) {
        console.error('Map data or image data not found for ID:', id)
        app.showErrorMessage('Image Load Error', 'Map image data not found.')
        return
      }
      imageBlob = item.imageData
      title = item.name || item.fileName || 'Map Image'
      // No delete option for maps from image viewer
    } else if (type === 'photo') {
      item = await app.storage.getPhoto(id)
      if (!item || !item.imageData) { // Check for photo.markerId
        console.error('Photo data or image data not found for ID:', id)
        app.showErrorMessage('Image Load Error', 'Photo image data not found.')
        return
      }
      imageBlob = item.imageData
      title = item.fileName || 'Photo Image'
      photoIdForViewer = item.id // Pass photo ID for viewer deletion context

      // CORRECTED: Retrieve markerId directly from the fetched photo object
      const markerIdFromPhoto = item.markerId
      if (markerIdFromPhoto) {
        onDeleteCallback = async (idToDelete) => {
          await deletePhotoFromImageViewer(app, idToDelete, markerIdFromPhoto)
        }
      } else {
        console.warn(`Photo ID ${id} has no associated markerId. Cannot provide delete functionality.`)
      }
    } else {
      console.error('Unknown type for handleViewImageInViewer:', type)
      app.showErrorMessage('Image Load Error', 'Invalid image type specified.')
      return
    }

    // Create object URL and pass to modalManager
    const imageUrl = URL.createObjectURL(imageBlob)
    // Track this object URL for cleanup if needed in the future
    app.modalManager.trackObjectUrl('image-viewer-modal', imageUrl)
    app.modalManager.currentObjectUrl = imageUrl

    app.modalManager.createImageViewerModal(
      app.modalManager.currentObjectUrl,
      title,
      photoIdForViewer,
      onDeleteCallback,
      () => {
        // Clean up the object URL when the image viewer closes
        if (app.modalManager.currentObjectUrl) {
          URL.revokeObjectURL(app.modalManager.currentObjectUrl)
          app.modalManager.currentObjectUrl = null
        }
        app.updateAppStatus('Image viewer closed.')
      }
    )
    app.updateAppStatus(`Viewing image: ${title}`)
  } catch (error) {
    console.error('Error displaying image in viewer:', error)
    app.showErrorMessage('Image Load Error', `Failed to load image: ${error.message}`)
  } finally {
    app.hideLoading()
  }
}
