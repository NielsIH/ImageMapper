/**
 * SnapSpot PWA - Photo Gallery Modal
 * Standalone module for photo gallery modal (extracted from modals.js)
 */

/* global document DOMParser requestAnimationFrame confirm */

export function createPhotoGalleryModal (modalManager, photos, options = {}, onShowOnMap, onDeletePhoto, onClose) {
  const {
    title = 'Photo Gallery',
    showOnMapOption = false,
    initialPhotoId = null
  } = options

  // Determine initial view: 'list' or 'single'
  const initialView = initialPhotoId ? 'single' : 'list'
  const initialPhotoIndex = initialPhotoId
    ? photos.findIndex(photo => photo.id === initialPhotoId)
    : 0

  const currentView = initialView
  const currentPhotoIndex = initialPhotoIndex !== -1 ? initialPhotoIndex : 0
  const photoObjectUrls = {} // To store object URLs for each photo

  // Pagination setup
  const itemsPerPage = 20 // Reduced from 50 to 20 for better performance
  // const totalPages = Math.ceil(photos.length / itemsPerPage);
  // const hasPagination = totalPages > 1;

  // Show the first page of photos
  const firstPagePhotos = photos.length > 0 ? photos.slice(0, itemsPerPage) : photos

  const modalHtml = `
    <div class="modal photo-gallery-modal" id="photo-gallery-modal">
      <div class="modal-backdrop"></div>
      <div class="modal-content photo-gallery-content">
        <div class="modal-header">
          <h3 class="gallery-title">${title}</h3>
          <div class="modal-header-actions">
            <button class="modal-close" type="button" aria-label="Close">×</button>
          </div>
        </div>
        <div class="modal-body photo-gallery-body">
          <!-- List View: Grid of photos -->
          <div id="gallery-list-view" class="gallery-view ${currentView === 'list' ? 'active' : ''}">
            <div class="photo-grid" id="photo-grid-container">
              ${generatePhotoGridItems(firstPagePhotos)}
            </div>
          </div>
          
          <!-- Single Photo View -->
          <div id="gallery-single-view" class="gallery-view ${currentView === 'single' ? 'active' : ''}">
            <div class="single-photo-viewer">
              <div class="photo-display-container">
                <img id="current-photo-display" class="current-photo" alt="Current photo in gallery" />
                
                <!-- Overlay for navigation controls -->
                <div class="nav-controls">
                  <button id="prev-photo-btn" class="nav-btn prev-btn" title="Previous Photo">←</button>
                  <button id="view-list-btn" class="list-btn" title="View All Photos">☷</button>
                  <button id="next-photo-btn" class="nav-btn next-btn" title="Next Photo">→</button>
                </div>
                
                <!-- Overlay for photo info -->
                <div class="photo-overlay-info">
                  <h4 id="current-photo-title">Photo Title</h4>
                  <p>Marker: <span id="marker-description"></span></p>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Footer for action buttons -->
        <div class="modal-footer">
          <div class="modal-actions">
            ${showOnMapOption ? '<button id="show-on-map-btn" class="btn btn-primary">📍 Show on Map</button>' : ''}
            ${onDeletePhoto ? '<button id="delete-photo-btn" class="btn btn-danger">🗑️ Delete Photo</button>' : ''}
          </div>
        </div>
      </div>
    </div>
  `

  const parser = new DOMParser()
  const modalDoc = parser.parseFromString(modalHtml, 'text/html')
  const modal = modalDoc.querySelector('.modal')
  if (!modal) {
    console.error('Failed to create photo gallery modal element.')
    if (onClose) onClose()
    return null
  }

  document.body.appendChild(modal)
  modalManager.activeModals.add(modal) // Add to ModalManager's activeModals

  // Track object URLs for this specific modal (essential for cleanup)
  const modalId = modal.id
  modalManager.trackObjectUrl(modalId, null) // Initialize the set

  // Set up modal functionality
  setupPhotoGalleryModal(modalManager, modal, photos, {
    ...options,
    initialView,
    currentPhotoIndex
  }, photoObjectUrls, onShowOnMap, onDeletePhoto, onClose)

  requestAnimationFrame(() => {
    modal.classList.add('show')
  })

  return modal
}

/**
 * Helper to generate HTML for photo grid items
 * @param {Array<Object>} photos - Array of photo objects
 * @returns {string} HTML string for the photo grid
 */
function generatePhotoGridItems (photos) {
  return photos.map((photo, index) => `
    <div class="photo-grid-item" data-photo-id="${photo.id}" data-index="${index}">
      <img 
        src="${photo.thumbnailDataUrl || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23f0f0f0"/><text x="50" y="50" font-family="Arial" font-size="10" fill="%23999" text-anchor="middle" dominant-baseline="middle">No Image</text></svg>'}" 
        alt="${photo.fileName || 'Photo'}" 
        class="photo-grid-thumbnail" 
        data-photo-id="${photo.id}"
        data-use-full-image="true"
      />
      <div class="photo-grid-info">
        <div class="photo-filename">${photo.fileName || 'Untitled'}</div>
        ${photo.markerDescription ? `<div class="photo-marker">${photo.markerDescription}</div>` : ''}
      </div>
    </div>
  `).join('')
}

/**
 * Set up photo gallery modal functionality
 * @param {Object} modalManager - The ModalManager instance
 * @param {HTMLElement} modal - Modal element
 * @param {Array<Object>} photos - Array of photo objects
 * @param {Object} options - Configuration options for the gallery
 * @param {Object} photoObjectUrls - Object to store photo object URLs
 * @param {Function} onShowOnMap - Callback when "Show on Map" is clicked (receives photoId)
 * @param {Function} onDeletePhoto - Callback when "Delete Photo" is clicked (receives photoId)
 * @param {Function} onClose - Callback when the modal is closed
 */
function setupPhotoGalleryModal (modalManager, modal, photos, options, photoObjectUrls, onShowOnMap, onDeletePhoto, onClose) {
  const { initialView, currentPhotoIndex: initialPhotoIndex } = options
  let currentView = initialView
  let currentPhotoIndex = initialPhotoIndex

  // Get modal elements
  const closeBtn = modal.querySelector('.modal-close')
  const backdrop = modal.querySelector('.modal-backdrop')

  // View containers
  const listView = modal.querySelector('#gallery-list-view')
  const singleView = modal.querySelector('#gallery-single-view')

  // Navigation elements
  const prevPhotoBtn = modal.querySelector('#prev-photo-btn')
  const nextPhotoBtn = modal.querySelector('#next-photo-btn')
  const viewListBtn = modal.querySelector('#view-list-btn')

  // Single photo elements
  const currentPhotoDisplay = modal.querySelector('#current-photo-display')
  const currentPhotoTitle = modal.querySelector('#current-photo-title')
  const markerDescription = modal.querySelector('#marker-description')
  const showOnMapBtn = modal.querySelector('#show-on-map-btn')
  const deletePhotoBtn = modal.querySelector('#delete-photo-btn')

  // Set up close functionality
  const closeModal = () => {
    // Clean up all object URLs when closing the modal
    Object.values(photoObjectUrls).forEach(url => {
      if (url) {
        URL.revokeObjectURL(url)
      }
    })

    modalManager.closeModal(modal)
    if (onClose) onClose()
  }

  // Setup for Pagination functionality
  const itemsPerPage = 20
  const totalPages = Math.ceil(photos.length / itemsPerPage)
  const hasPagination = totalPages > 1
  let currentPage = 1

  // Set up list view photo click handlers for gallery
  const setupGalleryPhotoClickHandlers = () => {
    // Get the photos that are actually displayed in the current view
    // const startIndex = (currentPage - 1) * itemsPerPage;
    // const endIndex = Math.min(startIndex + itemsPerPage, photos.length);
    // const currentPhotos = photos.slice(startIndex, endIndex);

    modal.querySelectorAll('.photo-grid-item').forEach((item, index) => {
      // The index here corresponds to the current page photos, not the full set
      item.addEventListener('click', () => {
        // Find the actual index in the full photos array to ensure correct navigation
        const photoId = item.dataset.photoId
        const actualIndex = photos.findIndex(photo => photo.id === photoId)
        if (actualIndex !== -1) {
          showSingleView(actualIndex)
        }
      })
    })

    // Load images with fallback strategy - try full-size first, fallback to thumbnail for grid view
    modal.querySelectorAll('.photo-grid-thumbnail[data-use-full-image="true"]').forEach(async (img) => {
      const photoId = img.dataset.photoId
      const photo = photos.find(p => p.id === photoId) // Use the full photos array to find the photo

      if (photo) {
        // First, try to use the full-size image if available
        if (photo.imageData) {
          try {
            const imageUrl = URL.createObjectURL(photo.imageData)
            modalManager.trackObjectUrl(modal.id, imageUrl)

            // Set up the fallback to thumbnail BEFORE setting the src
            img.addEventListener('error', (e) => {
              // On error, try thumbnail as fallback
              if (photo.thumbnailDataUrl) {
                img.src = photo.thumbnailDataUrl
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
            // On creation failure, fallback to thumbnail
            if (photo.thumbnailDataUrl) {
              img.src = photo.thumbnailDataUrl
            } else {
              // If no thumbnail, show a placeholder
              img.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23f0f0f0"/><text x="50" y="50" font-family="Arial" font-size="10" fill="%23999" text-anchor="middle" dominant-baseline="middle">No Image</text></svg>'
            }
          }
        } else if (photo.thumbnailDataUrl) {
          // If no full-size image available, use thumbnail
          img.src = photo.thumbnailDataUrl
        } else {
          // If no thumbnail either, show a placeholder
          img.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23f0f0f0"/><text x="50" y="50" font-family="Arial" font-size="10" fill="%23999" text-anchor="middle" dominant-baseline="middle">No Image</text></svg>'
        }
      }
    })
  }

  const updateGalleryDisplay = () => {
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = Math.min(startIndex + itemsPerPage, photos.length)
    const currentPhotos = photos.slice(startIndex, endIndex)

    // Update the photo grid
    const photoGridContainer = modal.querySelector('#photo-grid-container')
    if (photoGridContainer) {
      photoGridContainer.innerHTML = generatePhotoGridItems(currentPhotos)

      // Re-attach event listeners for the new photo grid items
      setupGalleryPhotoClickHandlers()
    }

    // Update pagination controls in footer
    const paginationControls = modal.querySelector('.pagination-controls-footer')
    if (paginationControls) {
      const prevBtn = paginationControls.querySelector('.pagination-prev')
      const nextBtn = paginationControls.querySelector('.pagination-next')
      const infoText = paginationControls.querySelector('.pagination-info')

      if (prevBtn) {
        prevBtn.disabled = currentPage <= 1
      }
      if (nextBtn) {
        nextBtn.disabled = currentPage >= totalPages
      }
      if (infoText) {
        infoText.textContent = `Page ${currentPage} of ${totalPages} (${startIndex + 1}-${endIndex} of ${photos.length} photos)`
      }
    }
  }

  // Add pagination controls to the modal footer only for gallery view
  const modalFooter = modal.querySelector('.modal-footer')
  if (modalFooter && hasPagination) {
    // Create pagination controls container
    const paginationContainer = document.createElement('div')
    paginationContainer.className = 'pagination-controls-footer'
    paginationContainer.innerHTML = `
      <button class="btn pagination-prev" title="Previous Page">← Prev</button>
      <span class="pagination-info">Page 1 of ${totalPages}</span>
      <button class="btn pagination-next" title="Next Page">Next →</button>
    `

    // Insert before the existing action buttons
    modalFooter.insertBefore(paginationContainer, modalFooter.firstChild)

    const prevBtn = paginationContainer.querySelector('.pagination-prev')
    const nextBtn = paginationContainer.querySelector('.pagination-next')

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (currentPage > 1) {
          currentPage--
          updateGalleryDisplay()
        }
      })
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        if (currentPage < totalPages) {
          currentPage++
          updateGalleryDisplay()
        }
      })
    }

    // Initially show pagination controls only in gallery view
    const updatePaginationVisibility = () => {
      if (paginationContainer) {
        if (currentView === 'list') {
          paginationContainer.style.display = 'flex'
        } else {
          paginationContainer.style.display = 'none'
        }
      }
    }

    // Set initial visibility
    updatePaginationVisibility()
  }

  // Initialize the first page
  updateGalleryDisplay()

  closeBtn?.addEventListener('click', closeModal)
  backdrop?.addEventListener('click', closeModal)

  // Function to show the list view
  const showListView = () => {
    currentView = 'list'
    listView.classList.add('active')
    singleView.classList.remove('active')

    // Update action buttons visibility (hide in list view)
    const modalActions = modal.querySelector('.modal-actions')
    if (modalActions) {
      modalActions.style.display = 'none'
    }

    // Update pagination visibility
    const paginationContainer = modal.querySelector('.pagination-controls-footer')
    if (paginationContainer) {
      paginationContainer.style.display = hasPagination ? 'flex' : 'none'
    }
  }

  // Function to show the single photo view
  const showSingleView = (photoIndex) => {
    if (photoIndex < 0 || photoIndex >= photos.length) return

    currentPhotoIndex = photoIndex
    const photo = photos[currentPhotoIndex]

    // Create or get object URL for the photo
    if (!photoObjectUrls[photo.id] && photo.imageData) {
      photoObjectUrls[photo.id] = URL.createObjectURL(photo.imageData)
      modalManager.trackObjectUrl(modal.id, photoObjectUrls[photo.id])
    }

    // Update the image display
    if (photoObjectUrls[photo.id]) {
      currentPhotoDisplay.src = photoObjectUrls[photo.id]
    } else if (photo.thumbnailDataUrl) {
      currentPhotoDisplay.src = photo.thumbnailDataUrl
    } else {
      currentPhotoDisplay.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23f0f0f0"/><text x="50" y="50" font-family="Arial" font-size="10" fill="%23999" text-anchor="middle" dominant-baseline="middle">No Image</text></svg>'
    }

    // Update title and marker info (now in overlay)
    currentPhotoTitle.textContent = photo.fileName || 'Untitled Photo'
    markerDescription.textContent = photo.markerDescription || 'No marker description'

    // Show single photo view
    currentView = 'single'
    singleView.classList.add('active')
    listView.classList.remove('active')

    // Update action buttons visibility (show in single photo view)
    const modalActions = modal.querySelector('.modal-actions')
    if (modalActions) {
      modalActions.style.display = 'flex'
    }

    // Hide pagination controls in single photo view
    const paginationContainer = modal.querySelector('.pagination-controls-footer')
    if (paginationContainer) {
      paginationContainer.style.display = 'none'
    }
  }

  // Set up navigation buttons
  prevPhotoBtn?.addEventListener('click', () => {
    if (currentPhotoIndex > 0) {
      showSingleView(currentPhotoIndex - 1)
    }
  })

  nextPhotoBtn?.addEventListener('click', () => {
    if (currentPhotoIndex < photos.length - 1) {
      showSingleView(currentPhotoIndex + 1)
    }
  })

  // View list button
  viewListBtn?.addEventListener('click', showListView)

  // Show on map button
  showOnMapBtn?.addEventListener('click', () => {
    if (onShowOnMap && currentPhotoIndex >= 0 && currentPhotoIndex < photos.length) {
      onShowOnMap(photos[currentPhotoIndex])
    }
  })

  // Delete photo button
  deletePhotoBtn?.addEventListener('click', () => {
    if (onDeletePhoto && currentPhotoIndex >= 0 && currentPhotoIndex < photos.length) {
      const photoId = photos[currentPhotoIndex].id
      if (confirm('Are you sure you want to delete this photo? This action cannot be undone.')) {
        onDeletePhoto(photoId)
      }
    }
  })

  // Set up swipe and keyboard navigation
  let touchStartX = 0
  let touchEndX = 0

  currentPhotoDisplay.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX
  }, { passive: true })

  currentPhotoDisplay.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX
    handleSwipe()
  }, { passive: true })

  const handleSwipe = () => {
    const swipeThreshold = 50
    if (touchStartX - touchEndX > swipeThreshold) {
      // Swipe left - next photo
      nextPhotoBtn?.click()
    } else if (touchEndX - touchStartX > swipeThreshold) {
      // Swipe right - previous photo
      prevPhotoBtn?.click()
    }
  }

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (currentView === 'single') {
      if (e.key === 'ArrowLeft') {
        prevPhotoBtn?.click()
      } else if (e.key === 'ArrowRight') {
        nextPhotoBtn?.click()
      } else if (e.key === 'Escape') {
        showListView()
      } else if (e.key === 'l' || e.key === 'L') {
        showListView()
      }
    }
  }

  // Add keyboard event listener to the modal
  modal.addEventListener('keydown', handleKeyDown)

  // Initialize the gallery based on the initial view
  if (currentView === 'list') {
    singleView.classList.remove('active')
    listView.classList.add('active')
    setupGalleryPhotoClickHandlers()

    // Hide action buttons in footer when starting with list view
    const modalActions = modal.querySelector('.modal-actions')
    if (modalActions) {
      modalActions.style.display = 'none'
    }

    // Show pagination controls in footer when starting with list view
    const paginationContainer = modal.querySelector('.pagination-controls-footer')
    if (paginationContainer) {
      paginationContainer.style.display = hasPagination ? 'flex' : 'none'
    }
  } else {
    listView.classList.remove('active')
    showSingleView(currentPhotoIndex)
  }
}
