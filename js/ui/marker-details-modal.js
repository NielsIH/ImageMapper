/**
 * SnapSpot PWA - Marker Details Modal
 * Handles the marker details modal implementation
 */

/* global document, DOMParser, URL, console, confirm requestAnimationFrame */

export function updateMarkerDetailsDescription (modalManager, markerId, newDescription) {
  /**
   * Update the displayed description in an already open marker details modal.
   * This is for when the description is edited directly in the modal.
   * @param {string} markerId - The ID of the marker whose description is being updated.
   * @param {string} newDescription - The new description text.
   */
  const modal = document.querySelector(`#marker-details-modal[data-marker-id="${markerId}"]`)
  if (modal) {
    const descriptionDisplaySpan = modal.querySelector('.marker-description-display')
    const descriptionEditTextArea = modal.querySelector('.marker-description-edit')

    if (descriptionDisplaySpan) {
      descriptionDisplaySpan.textContent = newDescription || 'No description'
    }
    if (descriptionEditTextArea) {
      descriptionEditTextArea.value = newDescription || '' // Update textarea value to match
    }
    console.log(`Updated description for marker ${markerId} to "${newDescription}"`)
  } else {
    console.warn(`Marker details modal for ${markerId} not found to update description.`)
  }
}

export function createMarkerDetailsModal (
  modalManager,
  markerDetails,
  onAddPhotos,
  onEditMarker,
  onSaveDescription,
  onDeleteMarker,
  onDeletePhoto,
  onViewPhoto,
  onClose
) {
  /**
   * Creates and displays a modal for marker details.
   * @param {Object} markerDetails - Marker data to display (id, description, coords, photoCount, photos[]).
   * @param {Function} onAddPhotos - Callback for 'Add Photos' button.
   * @param {Function} onEditMarker - Callback for 'Edit Marker' button (now handles toggling edit mode).
   * @param {Function} onSaveDescription - Callback when description is saved.
   * @param {Function} onDeleteMarker - Callback for 'Delete Marker' button.
   * @param {Function} onDeletePhoto - Callback when a 'Delete Photo' button is clicked.
   * @param {Function} onViewPhoto - Callback when a photo thumbnail is clicked (receives photo.id).
   * @param {Function} onClose - Callback when the modal is closed.
   * @returns {HTMLElement} - The created modal element.
   */
  // Generate photo thumbnails HTML
  const photoThumbnailsHtml =
    markerDetails.photos && markerDetails.photos.length > 0
      ? markerDetails.photos
        .map(
          (photo) => `
          <div class="photo-thumbnail-item" data-photo-id="${photo.id}" style="position: relative;">
            <img src="" alt="${photo.fileName}" class="photo-thumbnail clickable-thumbnail" data-photo-id="${photo.id}" data-use-full-image="true" />
            <span class="photo-name">${photo.fileName}</span>
            <button class="btn btn-tiny btn-danger delete-photo-btn" data-photo-id="${photo.id}" title="Remove Photo">×</button>
          </div>
        `
        )
        .join('')
      : '<p class="text-secondary text-center">No photos yet. Click "Add Photos" to add some!</p>'

  const modalHtml = `
    <div class="modal" id="marker-details-modal" data-marker-id="${markerDetails.id}">
      <div class="modal-backdrop"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h3>Marker Details</h3>
          <button class="modal-close" type="button" aria-label="Close">×</button>
        </div>
        <div class="modal-body">
          <div class="marker-info-section">
            <p><strong>ID:</strong> <span class="text-xs text-secondary">${markerDetails.id}</span></p>
            <p><strong>Coordinates:</strong> ${markerDetails.coords}</p>
            <p>
              <strong>Description:</strong>
              <span class="marker-description-display">${markerDetails.description || 'No description'}</span>
              <textarea class="marker-description-edit hidden" rows="3" maxlength="500" placeholder="Enter description">${markerDetails.description || ''
}</textarea>
            </p>
            <p><strong>Photos:</strong> <span class="marker-photo-count">${markerDetails.photoCount
}</span> associated</p>
          </div>

          <div class="photo-list-section">
            <h4>Associated Photos</h4>
            <div class="photo-thumbnails-container" id="marker-photo-thumbnails">
              ${photoThumbnailsHtml}
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <div class="modal-actions">
            <button class="btn btn-primary" id="btn-add-photos" type="button">📸 Add Photos</button>
            <button class="btn btn-secondary" id="btn-edit-marker" type="button">✏️ Edit Marker</button>
            <button class="btn btn-primary hidden" id="btn-save-description" type="button">💾 Save</button>
            <button class="btn btn-secondary hidden" id="btn-cancel-description-edit" type="button">✖️ Cancel</button>
            <button class="btn btn-danger" id="btn-delete-marker" type="button">🗑️ Delete Marker</button>
          </div>
        </div>
      </div>
    </div>
  `

  const parser = new DOMParser()
  const modalDoc = parser.parseFromString(modalHtml, 'text/html')
  const modal = modalDoc.querySelector('.modal')
  if (!modal) {
    console.error('Failed to create marker details modal element.')
    if (onClose) onClose()
    return null
  }

  document.body.appendChild(modal)
  modalManager.activeModals.add(modal)

  const closeModal = () => {
    modalManager.closeModal(modal)
    if (onClose) onClose()
  }

  modal.querySelector('.modal-close')?.addEventListener('click', closeModal)
  modal.querySelector('.modal-backdrop')?.addEventListener('click', closeModal)

  // Elements for description editing
  const descriptionDisplay = modal.querySelector('.marker-description-display')
  const descriptionEdit = modal.querySelector('.marker-description-edit')
  const editButton = modal.querySelector('#btn-edit-marker')
  const saveButton = modal.querySelector('#btn-save-description')
  const cancelButton = modal.querySelector('#btn-cancel-description-edit')
  const addPhotosButton = modal.querySelector('#btn-add-photos')
  const deleteMarkerButton = modal.querySelector('#btn-delete-marker')

  // Function to toggle edit mode
  const toggleEditMode = (isEditing) => {
    if (isEditing) {
      descriptionDisplay.classList.add('hidden')
      descriptionEdit.classList.remove('hidden')
      editButton.classList.add('hidden')
      saveButton.classList.remove('hidden')
      cancelButton.classList.remove('hidden')
      addPhotosButton.disabled = true // Disable other buttons during edit
      deleteMarkerButton.disabled = true
      descriptionEdit.focus()
      descriptionEdit.setSelectionRange(descriptionEdit.value.length, descriptionEdit.value.length) // Put cursor at end
    } else {
      descriptionDisplay.classList.remove('hidden')
      descriptionEdit.classList.add('hidden')
      editButton.classList.remove('hidden')
      saveButton.classList.add('hidden')
      cancelButton.classList.add('hidden')
      addPhotosButton.disabled = false // Re-enable
      deleteMarkerButton.disabled = false
    }
  }

  // Action button listeners
  editButton?.addEventListener('click', () => {
    toggleEditMode(true)
    if (onEditMarker) onEditMarker(markerDetails.id) // Notify app.js that edit mode started
  })

  saveButton?.addEventListener('click', () => {
    const newDescription = descriptionEdit.value.trim()
    if (onSaveDescription) {
      onSaveDescription(markerDetails.id, newDescription)
    }
    toggleEditMode(false) // Exit edit mode
  })

  cancelButton?.addEventListener('click', () => {
    descriptionEdit.value = markerDetails.description || '' // Revert to original
    toggleEditMode(false) // Exit edit mode
  })

  addPhotosButton?.addEventListener('click', () => {
    if (onAddPhotos) onAddPhotos(markerDetails.id)
  })

  deleteMarkerButton?.addEventListener('click', () => {
    if (
      onDeleteMarker &&
      confirm(
        'Are you sure you want to delete this marker and all its associated photos? This cannot be undone.'
      )
    ) {
      onDeleteMarker(markerDetails.id)
    }
  })

  // Add event listeners for delete photo buttons if any
  modal.querySelectorAll('.delete-photo-btn').forEach((button) => {
    button.addEventListener('click', (e) => {
      e.stopPropagation()
      const photoId = button.dataset.photoId
      console.log(
        'marker-details-modal.js (delete): Button clicked. Extracted photoId:',
        photoId,
        'MarkerDetails ID:',
        markerDetails.id
      )
      if (onDeletePhoto && confirm('Are you sure you want to remove this photo from the marker?')) {
        onDeletePhoto(markerDetails.id, photoId)
      }
    })
  })

  modal.querySelectorAll('.photo-thumbnail.clickable-thumbnail').forEach((thumbnail) => {
    thumbnail.addEventListener('click', (e) => {
      e.stopPropagation()
      const photoId = thumbnail.dataset.photoId
      console.log('marker-details-modal.js (view): Thumbnail clicked. Extracted photoId:', photoId)
      if (onViewPhoto) {
        onViewPhoto(photoId)
      }
    })
  })
  // Track object URLs for this specific modal (essential for cleanup)
  const modalId = modal.id
  modalManager.trackObjectUrl(modalId, null) // Initialize the set

  // Load images with fallback strategy - try full-size first, fallback to thumbnail
  modal.querySelectorAll('.photo-thumbnail[data-use-full-image="true"]').forEach(async (img) => {
    const photoId = img.dataset.photoId
    const photo = markerDetails.photos.find(p => p.id === photoId)

    if (photo) {
      // First, try to use the full-size image if available
      if (photo.imageData) {
        try {
          const imageUrl = URL.createObjectURL(photo.imageData)
          modalManager.trackObjectUrl(modalId, imageUrl)

          // Set up the fallback to thumbnail BEFORE setting the src
          img.addEventListener('error', () => {
            // On error, try thumbnail as fallback
            if (photo.thumbnailData) {
              img.src = photo.thumbnailData
            }
          }, { once: true })

          // Now set the source to the full-size image
          img.src = imageUrl

          // Optional: Set up load success handling
          img.addEventListener('load', () => {
            // Image loaded successfully, no action needed
            // The object URL will be cleaned up when the modal closes
          }, { once: true })
        } catch (error) {
          console.error('Failed to create object URL, falling back to thumbnail:', error)
          // On creation failure, fallback to thumbnail
          if (photo.thumbnailData) {
            img.src = photo.thumbnailData
          } else {
            // If no thumbnail, show a placeholder
            img.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23f0f0f0"/><text x="50" y="50" font-family="Arial" font-size="10" fill="%23999" text-anchor="middle" dominant-baseline="middle">No Image</text></svg>'
          }
        }
      } else if (photo.thumbnailData) {
        // If no full-size image available, use thumbnail
        img.src = photo.thumbnailData
      } else {
        // If no thumbnail either, show a placeholder
        img.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23f0f0f0"/><text x="50" y="50" font-family="Arial" font-size="10" fill="%23999" text-anchor="middle" dominant-baseline="middle">No Image</text></svg>'
      }
    }
  })

  requestAnimationFrame(() => {
    modal.classList.add('show')
  })

  return modal
}
