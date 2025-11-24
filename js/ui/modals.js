/**
 * SnapSpot PWA - Modal Components
 * Phase 1B: Modal system for file upload and map management
 */

/**
 * Modal manager for creating and managing modal dialogs
 */

/* global document, window DOMParser requestAnimationFrame confirm alert */

import { createUploadModal } from './upload-modal.js'
import { createSettingsModal } from './settings-modal.js'
import { createMarkerDetailsModal, updateMarkerDetailsDescription } from './marker-details-modal.js'

export class ModalManager {
  constructor () {
    this.activeModals = new Set()
    this.setupGlobalListeners()
    this.currentObjectUrl = null // To store the URL created by createObjectURL
    this.activeObjectUrls = new Map() // Track object URLs by modal ID
  }

  /**
     * Set up global event listeners for modal system
     */
  setupGlobalListeners () {
    // Close modals on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeTopModal()
      }
    })
  }

  // Track object URLs for cleanup (essential for all platforms)
  trackObjectUrl (modalId, url) {
    if (!this.activeObjectUrls.has(modalId)) {
      this.activeObjectUrls.set(modalId, new Set())
    }
    if (url) {
      this.activeObjectUrls.get(modalId).add(url)
    }
  }

  // Revoke all object URLs for a modal
  revokeObjectUrlsForModal (modalId) {
    if (this.activeObjectUrls.has(modalId)) {
      const urls = this.activeObjectUrls.get(modalId)
      urls.forEach(url => {
        try {
          URL.revokeObjectURL(url)
        } catch (e) {
          console.debug('URL already revoked:', e.message)
        }
      })
      this.activeObjectUrls.delete(modalId)
    }
  }

  /**
     * Create upload modal for map file selection (delegates to upload-modal.js)
     * @param {Function} onUpload - Callback when file is uploaded
     * @param {Function} onCancel - Callback when upload is cancelled
     * @returns {HTMLElement} - Modal element
     */
  createUploadModal (onUpload, onCancel) {
    return createUploadModal(this, onUpload, onCancel)
  }

  /**
     * Close a specific modal.
     * Returns a Promise that resolves when the modal is fully removed from DOM.
     */
  closeModal (modal) {
    return new Promise((resolve) => {
      if (!modal || !this.activeModals.has(modal)) {
        console.warn(
          `ModalManager: closeModal called for non-active or null modal: ${modal ? modal.id : 'N/A'}`
        )
        resolve()
        return
      }

      // Essential cleanup: Revoke all object URLs associated with this modal before closing
      this.revokeObjectUrlsForModal(modal.id)

      modal.classList.remove('show')
      this.activeModals.delete(modal)
      console.log(
        `ModalManager: Removed modal ${modal.id} from activeModals set. Remaining: ${this.activeModals.size}`
      )

      // If the closed modal was the image viewer, revoke the object URL
      if (modal.id === 'image-viewer-modal' && this.currentObjectUrl) {
        URL.revokeObjectURL(this.currentObjectUrl)
        this.currentObjectUrl = null
      }

      const handleTransitionEnd = () => {
        modal.removeEventListener('transitionend', handleTransitionEnd)
        if (modal.parentNode) {
          modal.parentNode.removeChild(modal)
          console.log(`ModalManager: Modal ${modal.id} removed from DOM via transitionend.`)
        } else {
          console.warn(`ModalManager: Modal ${modal.id} parentNode was null on transitionend.`)
        }
        resolve()
      }

      const computedStyle = window.getComputedStyle(modal)
      const transitionDuration = parseFloat(computedStyle.transitionDuration || '0') * 1000

      if (transitionDuration === 0) {
        if (modal.parentNode) {
          modal.parentNode.removeChild(modal)
          console.log(`ModalManager: Modal ${modal.id} removed from DOM (no transition).`)
        } else {
          console.warn(`ModalManager: Modal ${modal.id} parentNode was null (no transition).`)
        }
        resolve()
      } else {
        modal.addEventListener('transitionend', handleTransitionEnd)
        const fallbackTimer = setTimeout(() => {
          // Store for potential clear
          if (modal.parentNode && modal.contains(modal.parentNode)) {
            modal.parentNode.removeChild(modal)
            console.warn(`ModalManager: Modal ${modal.id} removed from DOM via setTimeout fallback.`)
          } else if (!modal.parentNode) {
            console.warn(`ModalManager: Modal ${modal.id} parentNode was null on setTimeout fallback.`)
          }
          resolve()
        }, transitionDuration + 100) // Increased buffer

        // Clear fallback if transitionend fires first
        modal.addEventListener('transitionend', () => clearTimeout(fallbackTimer), { once: true })
      }
    })
  }

  /**
     * Close the topmost modal
     */
  closeTopModal () {
    if (this.activeModals.size > 0) {
      const modals = Array.from(this.activeModals)
      const topModal = modals[modals.length - 1]
      this.closeModal(topModal)
    }
  }

  /**
     * Close all modals
     */
  closeAllModals () {
    Array.from(this.activeModals).forEach((modal) => {
      this.revokeObjectUrlsForModal(modal.id) // Clean up before closing
      this.closeModal(modal)
    })
  }

  /**
     * Returns the ID of the topmost active modal, or null if no modals are active.
     * This assumes modal elements have an 'id' attribute.
     * @returns {string|null} - ID of the topmost modal.
     */
  getTopModalId () {
    if (this.activeModals.size > 0) {
      const modals = Array.from(this.activeModals)
      const topModal = modals[modals.length - 1]
      return topModal.id || null
    }
    return null
  }

  /**
     * NEW: Update the displayed description in an already open marker details modal.
     * This is for when the description is edited directly in the modal.
     * @param {string} markerId - The ID of the marker whose description is being updated.
     * @param {string} newDescription - The new description text.
     */
  updateMarkerDetailsDescription (markerId, newDescription) {
    return updateMarkerDetailsDescription(this, markerId, newDescription)
  }

  /**
     * Creates and displays a modal for marker details.
     * @param {Object} markerDetails - Marker data to display (id, description, coords, photoCount, photos[]).
     * @param {Function} onAddPhotos - Callback for 'Add Photos' button.
     * @param {Function} onEditMarker - Callback for 'Edit Marker' button (now handles toggling edit mode).
     * @param {Function} onSaveDescription - Callback when description is saved.
     * @param {Function} onDeleteMarker - Callback for 'Delete Marker' button.
     * @param {Function} onDeletePhoto - Callback when a 'Delete Photo' button is clicked.
     * @param {Function} onViewPhoto - NEW: Callback when a photo thumbnail is clicked (receives photo.id).
     * @param {Function} onClose - Callback when the modal is closed.
     * @returns {HTMLElement} - The created modal element.
     */
  createMarkerDetailsModal (
    markerDetails,
    onAddPhotos,
    onEditMarker,
    onSaveDescription,
    onDeleteMarker,
    onDeletePhoto,
    onViewPhoto, // <-- NEW PARAMETER
    onClose
  ) {
    return createMarkerDetailsModal(this, markerDetails, onAddPhotos, onEditMarker, onSaveDescription, onDeleteMarker, onDeletePhoto, onViewPhoto, onClose)
  }

  /**
     * Creates and displays a modal for editing marker details.
     * @param {Object} markerData - Marker data to edit (id, description).
     * @param {Function} onSave - Callback when save button is clicked (receives updated description).
     * @param {Function} onCancel - Callback when cancel button or close is clicked.
     * @returns {HTMLElement} - The created modal element.
     */
  createEditMarkerModal (markerData, onSave, onCancel) {
    const modalHtml = `
      <div class="modal" id="edit-marker-modal" data-marker-id="${markerData.id}">
        <div class="modal-backdrop"></div>
        <div class="modal-content">
          <div class="modal-header">
            <h3>Edit Marker: ${markerData.id.substring(markerData.id.length - 4)}</h3>
            <button class="modal-close" type="button" aria-label="Close">×</button>
          </div>
          <div class="modal-body">
            <form id="edit-marker-form">
              <div class="form-group">
                <label for="marker-description-edit">Description</label>
                <textarea id="marker-description-edit" class="form-control" rows="5" maxlength="500" placeholder="Enter a description for this marker...">${markerData.description || ''
      }</textarea>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="btn-cancel-edit" type="button">Cancel</button>
            <button class="btn btn-primary" id="btn-save-edit" type="submit" form="edit-marker-form">Save Changes</button>
          </div>
        </div>
      </div>
    `

    const parser = new DOMParser()
    const modalDoc = parser.parseFromString(modalHtml, 'text/html')
    const modal = modalDoc.querySelector('.modal')
    if (!modal) {
      console.error('Failed to create edit marker modal element.')
      if (onCancel) onCancel()
      return null
    }

    document.body.appendChild(modal)
    this.activeModals.add(modal)

    const descriptionInput = modal.querySelector('#marker-description-edit')

    const closeModal = () => {
      this.closeModal(modal)
      if (onCancel) onCancel()
    }

    modal.querySelector('.modal-close')?.addEventListener('click', closeModal)
    modal.querySelector('.modal-backdrop')?.addEventListener('click', closeModal)
    modal.querySelector('#btn-cancel-edit')?.addEventListener('click', closeModal)

    modal.querySelector('#btn-save-edit')?.addEventListener('click', (e) => {
      e.preventDefault() // Prevent form default submission
      if (onSave) {
        onSave(descriptionInput.value)
      }
      this.closeModal(modal)
    })

    // If form has a submit event, ensure it also calls onSave
    modal.querySelector('#edit-marker-form')?.addEventListener('submit', (e) => {
      e.preventDefault()
      if (onSave) {
        onSave(descriptionInput.value)
      }
      this.closeModal(modal)
    })

    requestAnimationFrame(() => {
      modal.classList.add('show')
      // Auto-focus description field
      descriptionInput.focus()
    })

    return modal
  }

  /**
 * Creates and displays a modal for viewing a full-size image.
 * @param {string} imageUrl - The URL of the image to display (can be Data URL or object URL).
 * @param {string} [imageTitle='Image Viewer'] - An optional title for the image.
 * @param {string} photoId - The ID of the photo being viewed.
 * @param {Function} onDeleteImage - Callback when the delete button is clicked (receives photoId).
 * @param {Function} onClose - Callback when the modal is closed.
 * @returns {HTMLElement} - The created modal element.
 */
  createImageViewerModal (imageUrl, imageTitle = 'Image Viewer', photoId, onDeleteImage, onClose) {
    console.log('ModalManager: Creating new Image Viewer Modal.')
    const modalHtml = `
      <div class="modal image-viewer-modal" id="image-viewer-modal">
        <div class="modal-backdrop"></div>
        <div class="modal-content image-viewer-content">
          <div class="modal-header">
            <h3 class="image-viewer-title">${imageTitle}</h3>
            <div class="modal-header-actions">
                <button class="modal-close" type="button" aria-label="Close">×</button>
            </div>
          </div>
          <div class="modal-body image-viewer-body">
            <div class="image-viewer-image-wrapper">
                <img src="${imageUrl}" alt="${imageTitle}" class="full-size-image" />
                ${onDeleteImage ? '<button class="btn btn-tiny btn-danger delete-photo-overlay-btn" id="btn-delete-image-viewer" type="button" title="Delete Image">✕</button>' : ''}
            </div>
          </div>
        </div>
      </div>
    `
    const parser = new DOMParser()
    const modalDoc = parser.parseFromString(modalHtml, 'text/html')
    const modal = modalDoc.querySelector('.modal')
    if (!modal) {
      console.error('Failed to create image viewer modal element.')
      if (onClose) onClose()
      return null
    }

    document.body.appendChild(modal)
    this.activeModals.add(modal)

    const closeModal = () => {
      this.closeModal(modal)
      if (onClose) onClose()
    }

    modal.querySelector('.modal-close')?.addEventListener('click', closeModal)
    modal.querySelector('.modal-backdrop')?.addEventListener('click', closeModal)

    // Event listener for the delete image button
    const deleteImageButton = modal.querySelector('#btn-delete-image-viewer')
    if (deleteImageButton) {
      deleteImageButton.addEventListener('click', (e) => {
        e.stopPropagation() // Prevent click from bubbling up
        if (
          onDeleteImage &&
          confirm('Are you sure you want to delete this image? This action cannot be undone.')
        ) {
          onDeleteImage(photoId)
        }
      })
    }

    // REMOVE any previous event listener logic for imageWrapper/fullSizeImage if you had it.
    // We are deliberately keeping the delete button *always visible* and *not* reacting to hover/tap for now.

    requestAnimationFrame(() => {
      modal.classList.add('show')
    })
    return modal
  }

  /**
   * Creates and displays a photo gallery modal with a list of photos and single photo viewer functionality.
   * @param {Array<Object>} photos - Array of photo objects to display in the gallery
   * @param {Object} options - Configuration options for the gallery
   * @param {string} options.title - Title for the gallery modal
   * @param {boolean} options.showOnMapOption - Whether to show "Show on Map" option
   * @param {string} [options.initialPhotoId] - Optional ID of the photo to start viewing in single photo mode
   * @param {Function} onShowOnMap - Callback when "Show on Map" is clicked (receives photoId)
   * @param {Function} onDeletePhoto - Callback when "Delete Photo" is clicked (receives photoId)
   * @param {Function} onClose - Callback when the modal is closed
   * @returns {HTMLElement} - The created modal element
   */
  createPhotoGalleryModal (photos, options, onShowOnMap, onDeletePhoto, onClose) {
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
    // const totalPages = Math.ceil(photos.length / itemsPerPage)
    // const hasPagination = totalPages > 1

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
                ${this._generatePhotoGridItems(firstPagePhotos)}
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
    this.activeModals.add(modal)

    // Track object URLs for this specific modal (essential for cleanup)
    const modalId = modal.id
    this.trackObjectUrl(modalId, null) // Initialize the set

    // Set up modal functionality
    this.setupPhotoGalleryModal(modal, photos, {
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
  _generatePhotoGridItems (photos) {
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
   * @param {HTMLElement} modal - Modal element
   * @param {Array<Object>} photos - Array of photo objects
   * @param {Object} options - Configuration options for the gallery
   * @param {Object} photoObjectUrls - Object to store photo object URLs
   * @param {Function} onShowOnMap - Callback when "Show on Map" is clicked (receives photoId)
   * @param {Function} onDeletePhoto - Callback when "Delete Photo" is clicked (receives photoId)
   * @param {Function} onClose - Callback when the modal is closed
   */
  setupPhotoGalleryModal (modal, photos, options, photoObjectUrls, onShowOnMap, onDeletePhoto, onClose) {
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

      this.closeModal(modal)
      if (onClose) onClose()
    }

    // Setup for Pagination functionality
    const itemsPerPage = 20 // Reduced from 50 to 20 for better performance
    const totalPages = Math.ceil(photos.length / itemsPerPage)
    const hasPagination = totalPages > 1
    let currentPage = 1

    // Set up list view photo click handlers for gallery
    const setupGalleryPhotoClickHandlers = () => {
      // Get the photos that are actually displayed in the current view
      // const startIndex = (currentPage - 1) * itemsPerPage
      // const endIndex = Math.min(startIndex + itemsPerPage, photos.length)
      // const currentPhotos = photos.slice(startIndex, endIndex)

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
              this.trackObjectUrl(modal.id, imageUrl)

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
        photoGridContainer.innerHTML = this._generatePhotoGridItems(currentPhotos)

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
        this.trackObjectUrl(modal.id, photoObjectUrls[photo.id])
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
        onShowOnMap(photos[currentPhotoIndex].id)
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

  /**
     * Creates and displays the App Settings modal with tabbed sections.
     * Delegates to the standalone module.
     * @param {Object} callbacks - An object containing callbacks for various settings actions.
     * @param {Array<Object>} maps - Array of map metadata objects for Maps Management.
     * @param {string|null} activeMapId - ID of the currently active map.
     * @param {Function} [onClose] - Callback when the modal is closed.
     * @param {string} [initialTab='general-settings'] - The ID of the tab to open initially.
     * @returns {HTMLElement} - The created modal element.
     */
  createSettingsModal (callbacks, maps, activeMapId, onClose, initialTab = 'general-settings') {
    return createSettingsModal(this, callbacks, maps, activeMapId, onClose, initialTab)
  }

  createSearchModal (callbacks, onClose, initialQuery = '') {
    console.log('ModalManager: Creating new Search Modal.')
    const modalHtml = `
    <div class="modal search-modal" id="search-modal">
      <div class="modal-backdrop"></div>
      <div class="modal-content medium-modal">
        <div class="modal-header">
          <h3 class="modal-title">Search Maps, Markers, Photos</h3>
          <button class="modal-close" type="button" aria-label="Close">×</button>
        </div>
        <div class="modal-body">
          <div class="search-controls">
            <div class="form-group search-input-group">
              <div class="search-input-wrapper">
                <input type="text" id="search-input" class="form-control" placeholder="Search by name, description, or photo filename" value="${initialQuery}" />
                <button type="button" id="clear-search-text-btn" class="clear-search-text-btn hidden">×</button>
              </div>
              <button class="btn btn-primary" id="execute-search-btn" title="Search">
                <span class="btn-text">Search</span>
              </button>
            </div>
            <div class="search-file-input-group">
              <button type="button" class="btn btn-yellow" id="search-file-btn">
                <span class="btn-text">Choose File</span>
              </button>
            </div>
          </div>
          <div id="search-results-container" class="mt-md">
            <p class="text-secondary text-center" id="search-initial-message">Enter a search term or choose a file to begin.</p>
          </div>
        </div>
        <!-- No explicit footer for search modal, actions are inline -->
      </div>
    </div>
  `
    const parser = new DOMParser()
    const modalDoc = parser.parseFromString(modalHtml, 'text/html')
    const modal = modalDoc.querySelector('.modal')
    if (!modal) {
      console.error('Failed to create search modal element.')
      if (onClose) onClose()
      return null
    }
    document.body.appendChild(modal)
    this.activeModals.add(modal)
    const closeModal = () => {
      this.closeModal(modal)
      if (onClose) onClose()
    }
    modal.querySelector('.modal-close')?.addEventListener('click', closeModal)
    modal.querySelector('.modal-backdrop')?.addEventListener('click', closeModal)

    // -- ALL EVENT LISTENERS ARE ATTACHED HERE --

    // Search button
    const executeSearchBtn = modal.querySelector('#execute-search-btn')
    if (executeSearchBtn && callbacks.onSearch) {
      executeSearchBtn.addEventListener('click', callbacks.onSearch)
    } else if (!executeSearchBtn) {
      console.warn('ModalManager: #execute-search-btn not found in search modal HTML.')
    } else if (!callbacks.onSearch) {
      console.warn('ModalManager: onSearch callback not provided for search modal.')
    }

    // Choose File button
    const searchFileBtn = modal.querySelector('#search-file-btn')
    if (searchFileBtn && callbacks.onSearchFileSelect) {
      searchFileBtn.addEventListener('click', callbacks.onSearchFileSelect)
    } else if (!searchFileBtn) {
      console.warn('ModalManager: #search-file-btn not found in search modal HTML.')
    } else if (!callbacks.onSearchFileSelect) {
      console.warn('ModalManager: onSearchFileSelect callback not provided for search modal.')
    }

    // Clear "X" button inside search input
    const clearSearchTextBtn = modal.querySelector('#clear-search-text-btn')
    if (clearSearchTextBtn && callbacks.onClearSearch) {
      clearSearchTextBtn.addEventListener('click', callbacks.onClearSearch)
    } else if (!clearSearchTextBtn) {
      console.warn('ModalManager: #clear-search-text-btn not found in search modal HTML.')
    } else if (!callbacks.onClearSearch) {
      console.warn('ModalManager: onClearSearch callback not provided for search modal.')
    }

    // Search Input field (for 'input' event to show/hide 'X' button)
    const searchInput = modal.querySelector('#search-input')
    if (searchInput && callbacks.onSearchInput) {
      // The 'input' event will call back to SearchManager to toggle the 'X' button
      searchInput.addEventListener('input', callbacks.onSearchInput)
      // Also attach keypress for Enter key to trigger search
      searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          if (callbacks.onSearch) {
            callbacks.onSearch()
          }
        }
      })
    } else if (!searchInput) {
      console.warn('ModalManager: #search-input not found in search modal HTML.')
    } else if (!callbacks.onSearchInput) {
      console.warn('ModalManager: onSearchInput callback not provided for search modal.')
    }

    // Auto-focus search input when modal is shown
    requestAnimationFrame(() => {
      modal.classList.add('show')
      searchInput?.focus() // Focus the search input directly
    })
    return modal
  }

  /**
   * Format file size for display
   * @param {number} bytes - Size in bytes
   * @returns {string} - Formatted size string
   */
  formatFileSize (bytes) {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  /**
   * Creates and displays a modal for the user to decide how to process an imported map
   * that matches existing maps by image content or secondary criteria.
   * @param {Array<Object>} existingMaps - An array of map objects that match the imported data's image hash (primary matches).
   * @param {Array<Object>} secondaryMatches - An array of map objects that match based on secondary criteria (fuzzy matching).
   * @returns {Promise<{action: string, selectedMapId?: string}|null>} A promise that resolves with the user's
   *          chosen action ('merge', 'replace', 'new') and the ID of the selected existing map (if applicable),
   *          or null if the user cancels.
   */
  createImportDecisionModal (existingMaps, secondaryMatches = []) {
    // If no primary or secondary matches, return early (should be handled by caller)
    if ((!existingMaps || existingMaps.length === 0) && (!secondaryMatches || secondaryMatches.length === 0)) {
      console.error('ModalManager: createImportDecisionModal called without any matches.')
      return Promise.resolve(null)
    }

    const modalId = 'import-decision-modal'
    let resolvePromise // Will be set by the new Promise constructor
    const userChoicePromise = new Promise((resolve) => {
      resolvePromise = resolve
    })

    // Create HTML for primary matches (imageHash matches) using map cards with radio selection
    let primaryMatchesHtml = ''
    if (existingMaps && existingMaps.length > 0) {
      // Create HTML content for primary matches using the same layout as map cards in UIRenderer
      const primaryCardsHtml = existingMaps.map(map => {
        const initials = map.name ? map.name.substring(0, 2).toUpperCase() : '??'
        const markerCountText = map.markerCount !== undefined ? (map.markerCount === 1 ? '1 Marker' : `${map.markerCount} Markers`) : 'Loading markers...'

        // Create thumbnail HTML (similar to UIRenderer.createCardElement)
        const thumbnailHtml = `
          <div class="map-thumbnail-container">
            ${map.thumbnailDataUrl ? `<img src="${map.thumbnailDataUrl}" alt="Map Thumbnail" class="map-thumbnail">` : `<span class="map-initials">${initials}</span>`}
          </div>
        `

        return `
          <div class="form-group map-selection-item">
            <label class="map-card-label radio-label">
              <input type="radio" name="selectedMap" value="${map.id}" data-map-name="${map.name}" data-match-type="primary"/>
              <div class="map-card-content">
                ${thumbnailHtml}
                <div class="map-info">
                  <span class="map-name">${map.name}</span>
                  <div class="map-details">${markerCountText}</div>
                  <div class="map-dimensions">${map.width} × ${map.height} px</div>
                  <div class="map-size">${this.formatFileSize(map.fileSize)}</div>
                </div>
              </div>
              <span class="checkmark"></span>
            </label>
          </div>
        `
      }).join('')

      primaryMatchesHtml = `
        <div class="form-group">
          <label>Exact matches (by image content):</label>
          <div class="map-selection-list">${primaryCardsHtml}</div>
        </div>
      `
    }

    // Create HTML for secondary matches (fuzzy matches) using map cards with radio selection
    let secondaryMatchesHtml = ''
    if (secondaryMatches && secondaryMatches.length > 0) {
      const secondaryCardsHtml = secondaryMatches.map(map => {
        const initials = map.name ? map.name.substring(0, 2).toUpperCase() : '??'
        const markerCountText = map.markerCount !== undefined ? (map.markerCount === 1 ? '1 Marker' : `${map.markerCount} Markers`) : 'Loading markers...'

        // Create thumbnail HTML (similar to UIRenderer.createCardElement)
        const thumbnailHtml = `
          <div class="map-thumbnail-container">
            ${map.thumbnailDataUrl ? `<img src="${map.thumbnailDataUrl}" alt="Map Thumbnail" class="map-thumbnail">` : `<span class="map-initials">${initials}</span>`}
          </div>
        `

        return `
          <div class="form-group map-selection-item">
            <label class="map-card-label radio-label">
              <input type="radio" name="selectedMap" value="${map.id}" data-map-name="${map.name}" data-match-type="secondary"/>
              <div class="map-card-content">
                ${thumbnailHtml}
                <div class="map-info">
                  <span class="map-name">${map.name}</span>
                  <div class="map-details">${markerCountText}</div>
                  <div class="map-dimensions">${map.width} × ${map.height} px</div>
                  <div class="map-size">${this.formatFileSize(map.fileSize)}</div>
                </div>
              </div>
              <span class="checkmark"></span>
            </label>
          </div>
        `
      }).join('')

      secondaryMatchesHtml = `
        <div class="form-group">
          <label>Potential matches (by secondary criteria):</label>
          <div class="map-selection-list">${secondaryCardsHtml}</div>
        </div>
      `
    }

    // Determine the message based on type of matches
    const hasPrimaryMatches = existingMaps && existingMaps.length > 0
    const hasSecondaryMatches = secondaryMatches && secondaryMatches.length > 0
    let message = 'An imported map matches existing map(s) on this device. Please choose how to proceed:'
    if (!hasPrimaryMatches && hasSecondaryMatches) {
      message = "An imported map doesn't match exactly but has potential matches based on secondary criteria. Please choose how to proceed:"
    } else if (hasPrimaryMatches && !hasSecondaryMatches) {
      message = 'An imported map matches existing map(s) on this device based on its image content. Please choose how to proceed:'
    }

    const modalHtml = `
      <div class="modal" id="${modalId}">
        <div class="modal-backdrop"></div>
        <div class="modal-content large-modal">
          <div class="modal-header">
            <h3>Import Decision</h3>
            <button class="modal-close" type="button" aria-label="Close">×</button>
          </div>
          <div class="modal-body">
            <p>${message}</p>
            
            ${primaryMatchesHtml}
            ${secondaryMatchesHtml}

            <div class="button-group decision-buttons">
                <button class="btn btn-primary" id="btn-action-merge" type="button" disabled>Merge into selected map</button>
                <button class="btn btn-warning" id="btn-action-replace" type="button" disabled>Replace selected map</button>
                <button class="btn btn-secondary" id="btn-action-new" type="button">Import as new map</button>
            </div>
            <p class="text-secondary text-xs mt-sm">
                <strong>Merge:</strong> Add imported markers/photos to the selected existing map. Duplicate markers will be skipped, but new photos attached to them will be added.
            </p>
            <p class="text-secondary text-xs">
                <strong>Replace:</strong> Delete the selected existing map and import this data as a new map, taking its place (retains its ID).
            </p>
            <p class="text-secondary text-xs">
                <strong>Import as new:</strong> Import this data as a completely new map with a new ID, ignoring existing matches.
            </p>
          </div>
           <div class="modal-footer">
            <button class="btn btn-secondary" id="btn-cancel-decision" type="button">Cancel</button>
          </div>
        </div>
      </div>
    `

    const parser = new DOMParser()
    const modalDoc = parser.parseFromString(modalHtml, 'text/html')
    const modal = modalDoc.querySelector('.modal')
    if (!modal) {
      console.error('Failed to create import decision modal element.')
      resolvePromise(null)
      return userChoicePromise
    }

    document.body.appendChild(modal)
    this.activeModals.add(modal)

    const closeAndResolve = (result) => {
      this.closeModal(modal).then(() => resolvePromise(result))
    }

    modal.querySelector('.modal-close')?.addEventListener('click', () => closeAndResolve(null))
    modal.querySelector('.modal-backdrop')?.addEventListener('click', () => closeAndResolve(null))
    modal.querySelector('#btn-cancel-decision')?.addEventListener('click', () => closeAndResolve(null))

    const mergeBtn = modal.querySelector('#btn-action-merge')
    const replaceBtn = modal.querySelector('#btn-action-replace')
    const importNewBtn = modal.querySelector('#btn-action-new')
    const radioButtons = modal.querySelectorAll('input[name="selectedMap"]')

    let selectedMapId = null // Stores the ID of the map selected by radio button

    const updateButtonStates = () => {
      const hasSelection = selectedMapId !== null
      mergeBtn.disabled = !hasSelection
      replaceBtn.disabled = !hasSelection
    }

    radioButtons.forEach(radio => {
      radio.addEventListener('change', (event) => {
        selectedMapId = event.target.value
        updateButtonStates()
      })
    })

    mergeBtn?.addEventListener('click', () => {
      if (selectedMapId) {
        closeAndResolve({ action: 'merge', selectedMapId })
      } else {
        alert('Please select an existing map to merge into.')
      }
    })

    replaceBtn?.addEventListener('click', () => {
      if (selectedMapId) {
        if (confirm(`Are you sure you want to REPLACE the map "${modal.querySelector(`input[value="${selectedMapId}"]`).dataset.mapName}"? This action will permanently delete its current markers and photos and override it with the imported data.`)) {
          closeAndResolve({ action: 'replace', selectedMapId })
        }
      } else {
        alert('Please select an existing map to replace.')
      }
    })

    importNewBtn?.addEventListener('click', () => {
      closeAndResolve({ action: 'new' })
    })

    // Initial state of buttons
    updateButtonStates()

    requestAnimationFrame(() => {
      modal.classList.add('show')
    })

    return userChoicePromise
  }

  /**
   * Creates and displays a modal for the user to select export options for a map.
   * Allows for complete export or day-based export of markers and photos.
   *
   * @param {object} map - The map object to export.
   * @param {Object<string, Array<object>>} groupedMarkersByDay - Markers grouped by date (YYYY-MM-DD).
   * @returns {Promise<{action: 'exportComplete'}|{action: 'exportByDays', selectedDates: string[], exportAsSeparateFiles: boolean}|null>}
   *          A promise that resolves with the user's chosen action and options, or null if cancelled.
   */
  createExportDecisionModal (map, groupedMarkersByDay) {
    const modalId = 'export-decision-modal'
    let resolvePromise
    const userChoicePromise = new Promise((resolve) => {
      resolvePromise = resolve
    })

    // Sort uniqueDays in descending order to show newest first
    const uniqueDays = Object.keys(groupedMarkersByDay).sort((a, b) => new Date(b) - new Date(a))

    const dayCheckboxesHtml = uniqueDays.length > 0
      ? uniqueDays.map(date => {
        const markerCount = groupedMarkersByDay[date].length
        const displayDate = new Date(date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
        return `
        <div class="form-group checkbox-group">
          <label class="checkbox-label">
            <input type="checkbox" name="selectedDay" value="${date}" />
            <span class="checkmark"></span>
            ${displayDate} <span class="text-secondary text-xs">(${markerCount} markers)</span>
          </label>
        </div>
      `
      }).join('')
      : '<p class="text-secondary">No markers with dates available for day-based export.</p>'

    const modalHtml = `
      <div class="modal" id="${modalId}">
        <div class="modal-backdrop"></div>
        <div class="modal-content medium-modal">
          <div class="modal-header">
            <h3>Export Map: ${map.name}</h3>
            <button class="modal-close" type="button" aria-label="Close">×</button>
          </div>
          <div class="modal-body">
            <p>Please choose your export options for map <strong>"${map.name}"</strong> (ID: <span class="text-xs text-secondary">${map.id.substring(map.id.length - 8)}</span>):</p>
            
            <div class="export-option-section">
              <h4>Full Map Export</h4>
              <button class="btn btn-primary" id="btn-export-complete" type="button">📊 Export Complete Map</button>
              <p class="text-secondary text-xs mt-sm">Exports the entire map, including all markers and photos.</p>
            </div>

            <hr class="my-md">

            <div class="export-option-section">
              <h4>Day-based Export (<span id="selected-days-summary">0 days selected</span>)</h4>
              <div class="day-selection-list">
                ${dayCheckboxesHtml}
              </div>

              <div class="form-group mt-md">
                <label>Export Format:</label>
                <div class="radio-group">
                  <label class="radio-label">
                    <input type="radio" name="exportDayFormat" value="combined" checked />
                    <span class="radiomark"></span>
                    Single combined file
                  </label>
                  <label class="radio-label">
                    <input type="radio" name="exportDayFormat" value="separate" ${uniqueDays.length === 0 || uniqueDays.length === 1 ? 'disabled' : ''} />
                    <span class="radiomark"></span>
                    Separate file for each day
                  </label>
                </div>
              </div>

              <button class="btn btn-secondary mt-md" id="btn-export-selected-days" type="button" disabled>Export Selected Day(s)</button>
              <p class="text-secondary text-xs mt-sm">Only exports markers and photos from the selected days.</p>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="btn-cancel-export" type="button">Cancel</button>
          </div>
        </div>
      </div>
    `

    const parser = new DOMParser()
    const modalDoc = parser.parseFromString(modalHtml, 'text/html')
    const modal = modalDoc.querySelector('.modal')
    if (!modal) {
      console.error('Failed to create export decision modal element.')
      resolvePromise(null)
      return userChoicePromise
    }

    document.body.appendChild(modal)
    this.activeModals.add(modal)

    const closeAndResolve = (result) => {
      this.closeModal(modal).then(() => resolvePromise(result))
    }

    modal.querySelector('.modal-close')?.addEventListener('click', () => closeAndResolve(null))
    modal.querySelector('.modal-backdrop')?.addEventListener('click', () => closeAndResolve(null))
    modal.querySelector('#btn-cancel-export')?.addEventListener('click', () => closeAndResolve(null))

    const completeExportBtn = modal.querySelector('#btn-export-complete')
    const exportSelectedDaysBtn = modal.querySelector('#btn-export-selected-days')
    const dayCheckboxes = modal.querySelectorAll('input[name="selectedDay"]')
    // const exportDayFormatRadios = modal.querySelectorAll('input[name="exportDayFormat"]'); // Not directly used in listener
    const selectedDaysSummary = modal.querySelector('#selected-days-summary')

    const currentlySelectedDays = new Set() // To track selected dates

    const updateSelectedDaysSummary = () => {
      selectedDaysSummary.textContent = `${currentlySelectedDays.size} days selected`
      exportSelectedDaysBtn.disabled = currentlySelectedDays.size === 0

      // Enable/disable the "separate" radio button based on selection count
      const separateRadio = modal.querySelector('input[name="exportDayFormat"][value="separate"]')
      if (separateRadio) {
        separateRadio.disabled = currentlySelectedDays.size <= 1
        // If it was selected and becomes disabled, switch back to combined
        if (separateRadio.disabled && separateRadio.checked) {
          modal.querySelector('input[name="exportDayFormat"][value="combined"]').checked = true
        }
      }
    }

    dayCheckboxes.forEach(checkbox => {
      checkbox.addEventListener('change', (event) => { // Corrected 'events.target' to 'event.target'
        if (event.target.checked) {
          currentlySelectedDays.add(event.target.value)
        } else {
          currentlySelectedDays.delete(event.target.value)
        }
        updateSelectedDaysSummary()
      })
    })

    if (completeExportBtn) {
      completeExportBtn.addEventListener('click', () => {
        closeAndResolve({ action: 'exportComplete' })
      })
    }

    if (exportSelectedDaysBtn) {
      exportSelectedDaysBtn.addEventListener('click', () => {
        if (currentlySelectedDays.size === 0) {
          alert('Please select at least one day to export.')
          return
        }
        const exportAsSeparateFiles = modal.querySelector('input[name="exportDayFormat"]:checked').value === 'separate'
        closeAndResolve({
          action: 'exportByDays',
          selectedDates: Array.from(currentlySelectedDays),
          exportAsSeparateFiles
        })
      })
    }

    // Initial state update for summary and button
    updateSelectedDaysSummary()
    // In HTML itself, we already set disabled for 'separate' if uniqueDays.length === 0 || uniqueDays.length === 1
    // The updateSelectedDaysSummary will handle dynamic disabling/enabling correctly based on user checkbox selection.

    requestAnimationFrame(() => {
      modal.classList.add('show')
    })

    return userChoicePromise
  }
}
