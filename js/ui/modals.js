/**
 * Image Mapper PWA - Modal Components
 * Phase 1B: Modal system for file upload and map management
 */

/**
 * Modal manager for creating and managing modal dialogs
 */

/* global document, window DOMParser requestAnimationFrame confirm */

import { UIRenderer } from './uiRenderer.js'
import { FileManager } from '../fileManager.js'

export class ModalManager {
  constructor () {
    this.activeModals = new Set()
    this.setupGlobalListeners()
    this.currentObjectUrl = null // To store the URL created by createObjectURL
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

  /**
     * Create upload modal for map file selection
     * @param {Function} onUpload - Callback when file is uploaded
     * @param {Function} onCancel - Callback when upload is cancelled
     * @returns {HTMLElement} - Modal element
     */
  createUploadModal (onUpload, onCancel) {
    const modalHtml = `
      <div class="modal" id="upload-modal">
        <div class="modal-backdrop"></div>
        <div class="modal-content">
          <div class="modal-header">
            <h3>Upload New Map</h3>
            <button class="modal-close" type="button" aria-label="Close">×</button>
          </div>
          <div class="modal-body">
            <!-- File Selection Step -->
            <div class="upload-step" id="file-selection-step">
              <div class="file-drop-zone" id="file-drop-zone">
                <div class="file-drop-content">
                  <div class="file-drop-icon">📁</div>
                  <h4>Choose a map image</h4>
                  <p>Drop an image file here or click to browse</p>
                  <button class="btn btn-primary" id="browse-files-btn" type="button">
                    Browse Files
                  </button>
                  <div class="file-info">
                    <small>Supported formats: JPG, PNG, WebP, GIF, BMP, SVG</small><br>
                    <small>Maximum size: 10MB</small>
                  </div>
                </div>
              </div>
            </div>

            <!-- File Preview and Details Step -->
            <div class="upload-step hidden" id="file-details-step">
              <div class="file-preview">
                <div class="preview-image-container">
                  <img id="preview-image" alt="Map preview" />
                </div>
                <div class="file-metadata">
                  <div class="metadata-item">
                    <strong>File:</strong> <span id="file-name"></span>
                  </div>
                  <div class="metadata-item">
                    <strong>Size:</strong> <span id="file-size"></span>
                  </div>
                  <div class="metadata-item">
                    <strong>Dimensions:</strong> <span id="file-dimensions"></span>
                  </div>
                </div>
              </div>
              
              <form class="map-details-form" id="map-details-form">
                <div class="form-group">
                  <label for="map-name">Map Name *</label>
                  <input 
                    type="text" 
                    id="map-name" 
                    class="form-control" 
                    required 
                    maxlength="100"
                    placeholder="Enter a name for this map"
                  />
                </div>
                
                <div class="form-group">
                  <label for="map-description">Description (optional)</label>
                  <textarea 
                    id="map-description" 
                    class="form-control" 
                    rows="3"
                    maxlength="500"
                    placeholder="Add a description for this map..."
                  ></textarea>
                </div>
                
                <div class="form-group">
                  <label class="checkbox-label">
                    <input type="checkbox" id="set-as-active" checked />
                    <span class="checkmark"></span>
                    Set as active map
                  </label>
                </div>
              </form>
            </div>

            <!-- Error Display -->
            <div class="upload-error hidden" id="upload-error">
              <div class="error-content">
                <div class="error-icon">⚠️</div>
                <div class="error-message" id="error-message"></div>
              </div>
            </div>
          </div>
          
          <div class="modal-footer">
            <div class="modal-actions">
              <!-- File Selection Actions -->
              <div class="step-actions" id="file-selection-actions">
                <button class="btn btn-secondary" id="cancel-upload-btn" type="button">
                  Cancel
                </button>
              </div>
              
              <!-- File Details Actions -->
              <div class="step-actions hidden" id="file-details-actions">
                <button class="btn btn-secondary" id="back-to-selection-btn" type="button">
                  Back
                </button>
                <button class="btn btn-primary" id="create-map-btn" type="button">
                  Create Map
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `

    // Create modal element
    const parser = new DOMParser()
    const modalDoc = parser.parseFromString(modalHtml, 'text/html')
    const modal = modalDoc.querySelector('.modal')

    // Add to page
    document.body.appendChild(modal)
    this.activeModals.add(modal)

    // Set up modal functionality
    this.setupUploadModal(modal, onUpload, onCancel)

    // Show modal
    requestAnimationFrame(() => {
      modal.classList.add('show')
    })

    return modal
  }

  /**
     * Set up upload modal functionality with file picker strategy testing
     * @param {HTMLElement} modal - Modal element
     * @param {Function} onUpload - Upload callback
     * @param {Function} onCancel - Cancel callback
     */
  setupUploadModal (modal, onUpload, onCancel) {
    let selectedFile = null
    let processedData = null

    // Get modal elements
    const closeBtn = modal.querySelector('.modal-close')
    const backdrop = modal.querySelector('.modal-backdrop')
    const dropZone = modal.querySelector('#file-drop-zone')
    const browseBtn = modal.querySelector('#browse-files-btn')
    const cancelBtn = modal.querySelector('#cancel-upload-btn')
    const backBtn = modal.querySelector('#back-to-selection-btn')
    const createBtn = modal.querySelector('#create-map-btn')

    // Steps
    // const selectionStep = modal.querySelector('#file-selection-step')
    // const detailsStep = modal.querySelector('#file-details-step')
    // const selectionActions = modal.querySelector('#file-selection-actions')
    // const detailsActions = modal.querySelector('#file-details-actions')
    // const errorDisplay = modal.querySelector('#upload-error')

    // Form elements
    const form = modal.querySelector('#map-details-form')
    const nameInput = modal.querySelector('#map-name')
    const descInput = modal.querySelector('#map-description')
    const activeCheckbox = modal.querySelector('#set-as-active')

    // Preview elements
    // const previewImg = modal.querySelector('#preview-image')
    // const fileName = modal.querySelector('#file-name')
    // const fileSize = modal.querySelector('#file-size')
    // const fileDimensions = modal.querySelector('#file-dimensions')

    // File manager instance
    const fileManager = new FileManager()

    // Debug overlay for mobile testing (only in debug mode)
    const showDebugMessage = (message) => {
      // const showDebug = window.location.hostname.includes('localhost') ||
      //              window.location.search.includes('debug')
      const showDebug = window.location.search.includes('debug')

      if (!showDebug) return // Don't show debug in production

      let debugDiv = document.getElementById('picker-debug')
      if (!debugDiv) {
        debugDiv = document.createElement('div')
        debugDiv.id = 'picker-debug'
        debugDiv.style.cssText = `
      position: fixed;
      top: 10px;
      left: 10px;
      right: 10px;
      background: rgba(0,0,0,0.9);
      color: white;
      padding: 10px;
      font-size: 12px;
      z-index: 10001;
      max-height: 150px;
      overflow-y: auto;
      border-radius: 5px;
      font-family: monospace;
    `
        document.body.appendChild(debugDiv)
      }

      const timestamp = new Date().toLocaleTimeString()
      debugDiv.innerHTML += `<div>${timestamp}: ${message}</div>`
      debugDiv.scrollTop = debugDiv.scrollHeight
    }

    // Clear debug overlay
    const clearDebugMessages = () => {
      const debugDiv = document.getElementById('picker-debug')
      if (debugDiv) {
        debugDiv.innerHTML = ''
      }
    }

    // Close modal handlers
    const closeModal = () => {
      // Clean up debug overlay when closing
      const debugDiv = document.getElementById('picker-debug')
      if (debugDiv) {
        debugDiv.remove()
      }
      this.closeModal(modal)
      if (onCancel) onCancel()
    }

    closeBtn.addEventListener('click', closeModal)
    backdrop.addEventListener('click', closeModal)
    cancelBtn.addEventListener('click', closeModal)

    // File selection handlers
    const handleFileSelect = async (file) => {
      if (!file) return

      try {
        clearDebugMessages()
        showDebugMessage(`✅ File selected: ${file.name}`)
        showDebugMessage(`📊 Size: ${Math.round(file.size / 1024)}KB, Type: ${file.type}`)

        this.showError(modal, '')
        this.showLoading(modal, 'Processing file...')

        // Process the file
        processedData = await fileManager.processFileUpload(file, {
          isActive: true
        })
        selectedFile = file

        showDebugMessage('✅ File processing completed successfully')

        // Update preview
        this.updateFilePreview(modal, processedData)

        // Switch to details step
        this.showDetailsStep(modal)
      } catch (error) {
        console.error('File processing error:', error)
        showDebugMessage(`❌ File processing failed: ${error.message}`)
        this.showError(modal, error.message)
      } finally {
        this.hideLoading(modal)
      }
    }

    // Enhanced browse button
    browseBtn.addEventListener('click', async () => {
      const showDebug = window.location.hostname.includes('localhost') || window.location.search.includes('debug')

      if (showDebug) {
        clearDebugMessages()
        showDebugMessage('🔍 Starting file selection...')
        const isAndroid = /Android/i.test(navigator.userAgent)
        const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent)
        showDebugMessage(`📱 Device: ${isAndroid ? 'Android' : isIOS ? 'iOS' : 'Desktop'}`)
      }

      try {
        const files = await fileManager.selectFiles(showDebug, false) // <-- CHANGED HERE: selectFiles, multiple: false
        const file = files && files.length > 0 ? files[0] : null // Get the first file if any

        if (file) {
          if (showDebug) {
            showDebugMessage(`✅ File selected: ${file.name}`)
            showDebugMessage(`📊 Size: ${Math.round(file.size / 1024)}KB, Type: ${file.type}`)
          }
          await handleFileSelect(file)
        } else {
          if (showDebug) {
            showDebugMessage('❌ File selection cancelled')
          }
        }
      } catch (error) {
        console.error('File selection error:', error)
        if (showDebug) {
          showDebugMessage(`❌ Error: ${error.message}`)
        }
        this.showError(modal, 'File selection failed. Please try again.')
      }
    })

    // Add manual strategy test buttons for debugging
    this.addManualStrategyButtons(modal, fileManager, handleFileSelect, showDebugMessage)

    // Drag and drop
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault()
      dropZone.classList.add('drag-over')
    })

    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('drag-over')
    })

    dropZone.addEventListener('drop', async (e) => {
      e.preventDefault()
      dropZone.classList.remove('drag-over')

      const files = e.dataTransfer.files
      if (files.length > 0) {
        showDebugMessage(`📎 File dropped: ${files[0].name}`)
        await handleFileSelect(files[0])
      }
    })

    // Navigation
    backBtn.addEventListener('click', () => {
      this.showSelectionStep(modal)
    })

    // Form submission
    const handleSubmit = async () => {
      if (!processedData || !selectedFile) {
        this.showError(modal, 'No file selected')
        return
      }

      if (!nameInput.value.trim()) {
        this.showError(modal, 'Map name is required')
        nameInput.focus()
        return
      }

      try {
        this.showLoading(modal, 'Creating map...')

        const finalData = {
          ...processedData,
          name: nameInput.value.trim(),
          description: descInput.value.trim(),
          isActive: activeCheckbox.checked
        }

        if (onUpload) {
          await onUpload(finalData, selectedFile)
        }

        this.closeModal(modal)
      } catch (error) {
        console.error('Map creation error:', error)
        showDebugMessage(`❌ Upload failed: ${error.message}`)
        this.showError(modal, error.message)
      } finally {
        this.hideLoading(modal)
      }
    }

    createBtn.addEventListener('click', handleSubmit)
    form.addEventListener('submit', (e) => {
      e.preventDefault()
      handleSubmit()
    })

    nameInput.addEventListener('focus', () => {
      this.showError(modal, '')
    })
  }

  /**
     * Add debug controls (only shown in debug mode)
     * @param {HTMLElement} modal - Modal element
     * @param {FileManager} fileManager - File manager instance
     * @param {Function} handleFileSelect - File selection handler
     * @param {Function} showDebugMessage - Debug message function
     */
  addManualStrategyButtons (modal, fileManager, handleFileSelect, showDebugMessage) {
    const dropZone = modal.querySelector('#file-drop-zone')

    // Only show debug controls in debug mode
    const showDebug = window.location.hostname.includes('localhost') || window.location.search.includes('debug')

    if (!showDebug) return

    const testButtonsHtml = `
    <div class="strategy-test-buttons" style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #ddd;">
      <small style="display: block; margin-bottom: 10px; color: #666;">Debug Controls:</small>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px;">
        <button type="button" class="btn btn-small" onclick="document.getElementById('picker-debug')?.remove()">Clear Debug</button>
        <button type="button" class="btn btn-small" data-test-picker>Test Picker</button>
      </div>
    </div>
  `

    dropZone.insertAdjacentHTML('beforeend', testButtonsHtml)

    // Add test picker button
    modal.querySelector('[data-test-picker]')?.addEventListener('click', async (e) => {
      e.stopPropagation()
      showDebugMessage('🧪 Testing file picker manually...')

      try {
        const file = await fileManager.selectFile(true)
        if (file) {
          showDebugMessage(`✅ Test successful: ${file.name}`)
          await handleFileSelect(file)
        } else {
          showDebugMessage('❌ Test cancelled')
        }
      } catch (error) {
        showDebugMessage(`❌ Test error: ${error.message}`)
      }
    })
  }

  /**
     * Update file preview in modal
     */
  updateFilePreview (modal, processedData) {
    const previewImg = modal.querySelector('#preview-image')
    const fileName = modal.querySelector('#file-name')
    const fileSize = modal.querySelector('#file-size')
    const fileDimensions = modal.querySelector('#file-dimensions')
    const nameInput = modal.querySelector('#map-name')

    // Set preview image
    previewImg.src = processedData.thumbnail

    // Set metadata
    fileName.textContent = processedData.fileName
    fileSize.textContent = new FileManager().formatFileSize(processedData.fileSize)
    fileDimensions.textContent = `${processedData.width} × ${processedData.height} pixels`

    // Set default name
    nameInput.value = processedData.name
  }

  /**
     * Show file details step
     */
  showDetailsStep (modal) {
    const selectionStep = modal.querySelector('#file-selection-step')
    const detailsStep = modal.querySelector('#file-details-step')
    const selectionActions = modal.querySelector('#file-selection-actions')
    const detailsActions = modal.querySelector('#file-details-actions')

    selectionStep.classList.add('hidden')
    detailsStep.classList.remove('hidden')
    selectionActions.classList.add('hidden')
    detailsActions.classList.remove('hidden')

    // Focus name input
    setTimeout(() => {
      modal.querySelector('#map-name').focus()
    }, 100)
  }

  /**
     * Show file selection step
     */
  showSelectionStep (modal) {
    const selectionStep = modal.querySelector('#file-selection-step')
    const detailsStep = modal.querySelector('#file-details-step')
    const selectionActions = modal.querySelector('#file-selection-actions')
    const detailsActions = modal.querySelector('#file-details-actions')

    selectionStep.classList.remove('hidden')
    detailsStep.classList.add('hidden')
    selectionActions.classList.remove('hidden')
    detailsActions.classList.add('hidden')
  }

  /**
     * Show error message in modal
     */
  showError (modal, message) {
    const errorDisplay = modal.querySelector('#upload-error')
    const errorMessage = modal.querySelector('#error-message')

    if (message) {
      errorMessage.textContent = message
      errorDisplay.classList.remove('hidden')
    } else {
      errorDisplay.classList.add('hidden')
    }
  }

  /**
     * Show loading state in modal
     */
  showLoading (modal, message = 'Loading...') {
    // Add loading class to modal
    modal.classList.add('loading')

    // Disable form elements
    const form = modal.querySelector('#map-details-form')
    if (form) {
      const inputs = form.querySelectorAll('input, textarea, button')
      inputs.forEach((input) => {
        input.disabled = true
      })
    }

    // Update button text
    const createBtn = modal.querySelector('#create-map-btn')
    if (createBtn) {
      createBtn.textContent = message
    }
  }

  /**
     * Hide loading state in modal
     */
  hideLoading (modal) {
    modal.classList.remove('loading')

    // Re-enable form elements
    const form = modal.querySelector('#map-details-form')
    if (form) {
      const inputs = form.querySelectorAll('input, textarea, button')
      inputs.forEach((input) => {
        input.disabled = false
      })
    }

    // Restore button text
    const createBtn = modal.querySelector('#create-map-btn')
    if (createBtn) {
      createBtn.textContent = 'Create Map'
    }
  }

  /**
     * Close a specific modal
     */
  // closeModal (modal) {
  //   modal.classList.remove('show')
  //   this.activeModals.delete(modal)

  //   setTimeout(() => {
  //     if (modal.parentNode) {
  //       modal.parentNode.removeChild(modal)
  //     }
  //   }, 300) // Wait for CSS transition
  // }

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
      console.log(`ModalManager: Updated description for marker ${markerId} to "${newDescription}"`)
    } else {
      console.warn(`ModalManager: Marker details modal for ${markerId} not found to update description.`)
    }
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
    // Generate photo thumbnails HTML
    const photoThumbnailsHtml =
            markerDetails.photos && markerDetails.photos.length > 0
              ? markerDetails.photos
                .map(
                  (photo) => `
          <div class="photo-thumbnail-item" data-photo-id="${photo.id}" style="position: relative;">
            <img src="${photo.thumbnailData}" alt="${photo.fileName}" class="photo-thumbnail clickable-thumbnail" data-photo-id="${photo.id}" />
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
                <textarea class="marker-description-edit hidden" rows="3" maxlength="500" placeholder="Enter description">${
                    markerDetails.description || ''
                }</textarea>
              </p>
              <p><strong>Photos:</strong> <span class="marker-photo-count">${
                  markerDetails.photoCount
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
              <button class="btn btn-secondary" id="btn-edit-marker" type="button">✏️ Edit Marker</button>
              <button class="btn btn-primary hidden" id="btn-save-description" type="button">💾 Save</button>
              <button class="btn btn-secondary hidden" id="btn-cancel-description-edit" type="button">✖️ Cancel</button>
              <button class="btn btn-primary" id="btn-add-photos" type="button">📸 Add Photos</button>
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
    this.activeModals.add(modal)

    const closeModal = () => {
      this.closeModal(modal)
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
          'modals.js (delete): Button clicked. Extracted photoId:',
          photoId,
          'MarkerDetails ID:',
          markerDetails.id
        )
        if (onDeletePhoto && confirm('Are you sure you want to remove this photo from the marker?')) {
          onDeletePhoto(markerDetails.id, photoId)
        }
      })
    })

    // NEW: Add event listeners for clickable photo thumbnails
    modal.querySelectorAll('.photo-thumbnail.clickable-thumbnail').forEach((thumbnail) => {
      thumbnail.addEventListener('click', (e) => {
        e.stopPropagation()
        const photoId = thumbnail.dataset.photoId
        console.log('modals.js (view): Thumbnail clicked. Extracted photoId:', photoId)
        if (onViewPhoto) {
          onViewPhoto(photoId)
        }
      })
    })

    requestAnimationFrame(() => {
      modal.classList.add('show')
    })

    return modal
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
                <textarea id="marker-description-edit" class="form-control" rows="5" maxlength="500" placeholder="Enter a description for this marker...">${
                    markerData.description || ''
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
     * Creates and displays the App Settings modal with tabbed sections.
     * @param {Object} callbacks - An object containing callbacks for various settings actions.
     * @param {Array<Object>} maps - Array of map metadata objects for Maps Management.
     * @param {string|null} activeMapId - ID of the currently active map.
     * @param {Function} [onClose] - Callback when the modal is closed.
     * @param {string} [initialTab='general-settings'] - The ID of the tab to open initially.
     * @returns {HTMLElement} - The created modal element.
     */
  createSettingsModal (callbacks, maps, activeMapId, onClose, initialTab = 'general-settings') {
    // <--- Signature updated
    console.log('ModalManager: Creating new Settings Modal.')
    // --- Generate Maps Management DOM content using UIRenderer ---
    let mapsListDOMElement // Renamed to reflect it's a DOM element, not just HTML string
    if (maps.length === 0) {
      const noMapsParagraph = document.createElement('p')
      noMapsParagraph.classList.add('text-center', 'text-secondary')
      noMapsParagraph.textContent = 'No maps available yet. Add your first map!'
      mapsListDOMElement = noMapsParagraph // Store the actual paragraph element
    } else {
      const mapsListUl = document.createElement('ul')
      mapsListUl.classList.add('maps-list')
      maps.forEach((map) => {
        // Iterate through maps to create and append cards
        const card = UIRenderer.createCardElement(
          map,
          'map',
          {
            onMapSelected: callbacks.onMapSelected,
            onMapDelete: callbacks.onMapDelete,
            onExportHtmlMap: callbacks.onExportHtmlMap,
            onExportJsonMap: callbacks.onExportJsonMap,
            // Keep onSettingsModalRefresh if needed for refresh on map delete
            onSettingsModalRefresh: callbacks.onSettingsModalRefresh, // This will be needed when a map is deleted from inside a card
            // NEW: Pass the onViewImageInViewer callback
            onViewImageInViewer: (id, type) => callbacks.onViewImageInViewer(id, type)
          },
          map.id === activeMapId
        )
        mapsListUl.appendChild(card)
      })
      mapsListDOMElement = mapsListUl // Store the actual ul element
    }
    // --- End Maps Management DOM content ---
    const modalHtml = `
    <div class="modal" id="settings-modal">
    <div class="modal-backdrop"></div>
    <div class="modal-content large-modal">
    <div class="modal-header">
    <h3 class="modal-title">App Settings</h3>
    <button class="modal-close" type="button" aria-label="Close">×</button>
    </div>
    <div class="modal-body">
    <div class="settings-tabs">
    <div class="tab-buttons">
    <button class="tab-button" data-tab="general-settings">General</button>
    <button class="tab-button" data-tab="app-behavior-settings">App Behavior</button>
    <button class="tab-button" data-tab="map-display-settings">Map Display</button>
    <button class="tab-button" data-tab="image-processing-settings">Image Processing</button>
    <button class="tab-button" data-tab="data-management-settings">Data Management</button>
    <button class="tab-button" data-tab="maps-management-settings">Maps Management</button>
    <button class="tab-button" data-tab="danger-zone-settings">Danger Zone</button>
    </div>
    <!-- NEW: Mobile Tab Selector (Dropdown) -->
    <select class="settings-tab-selector" aria-label="Select Settings Category">
    <option value="general-settings">General</option>
    <option value="app-behavior-settings">App Behavior</option>
    <option value="map-display-settings">Map Display</option>
    <option value="image-processing-settings">Image Processing</option>
    <option value="data-management-settings">Data Management</option>
    <option value="maps-management-settings">Maps Management</option>
    <option value="danger-zone-settings">Danger Zone</option>
    </select>
    <div class="tab-content">
    <!-- General Settings Tab -->
    <div id="general-settings" class="tab-pane">
    <h4>General Settings</h4>
    <p>Nothing yet.</p>
    </div>
    <!-- App Behavior Settings Tab -->
    <div id="app-behavior-settings" class="tab-pane">
    <h4>App Behavior Settings</h4>
    <div class="form-group">
    <label class="checkbox-label toggle-switch-label">
    <input type="checkbox" id="auto-close-marker-details" />
    <span class="toggle-switch-slider"></span>
    Auto-close marker details after adding photo(s)
    </label>
    <small class="text-secondary mt-xs">
    Automatically close the marker details modal after successfully adding photos.
    </small>
    </div>
    <div class="form-group mt-md">
    <label class="checkbox-label toggle-switch-label">
    <input type="checkbox" id="allow-duplicate-photos" />
    <span class="toggle-switch-slider"></span>
    Allow adding duplicate photos to markers
    </label>
    <small class="text-secondary mt-xs">
    Enable to allow the same photo file to be associated with multiple markers.
    </small>
    </div>
    </div>
    <!-- Map Display Settings Tab -->
    <div id="map-display-settings" class="tab-pane">
    <h4>Map Display Settings</h4>
    <div class="form-group">
    <label class="checkbox-label toggle-switch-label">
    <input type="checkbox" id="toggle-crosshair-settings" />
    <span class="toggle-switch-slider"></span>
    Show Crosshair
    </label>
    <small class="text-secondary mt-xs">
    Enable or disable the crosshair overlay on the map canvas.
    </small>
    </div>
    <p>User-Defined Marker Sizes (to be implemented later)</p>
    </div>
    <!-- Image Processing Settings Tab -->
    <div id="image-processing-settings" class="tab-pane">
    <h4>Image Processing Settings</h4>
    <div class="form-group">
    <label for="image-quality-slider">Default Image Quality (%)</label>
    <input type="range" id="image-quality-slider" min="10" max="100" step="5" class="form-control" />
    <span id="image-quality-value" class="text-secondary text-right"></span>
    <small class="text-secondary mt-xs">
    Adjust the compression quality for images added to markers (10% = lowest, 100% = highest).
    </small>
    </div>
    </div>
    <!-- Data Management Settings Tab -->
    <div id="data-management-settings" class="tab-pane">
    <h4>Data Management</h4>
    <p class="text-secondary mb-md">Import map data or other application data.</p>
    <div class="form-group">
    <label for="file-input-import-settings" class="btn btn-secondary btn-large">
    📥 <span class="btn-text">Import Map Data (JSON)</span>
    </label>
    <input type="file" id="file-input-import-settings" accept=".json" style="display: none" />
    <small class="text-secondary mt-xs">
    Select a JSON file containing exported map data to import into the application.
    </small>
    </div>
    </div>
    <!-- Maps Management Settings Tab -->
    <div id="maps-management-settings" class="tab-pane">
    <h4>Maps Management</h4>
    <div class="map-management-content">
    <div id="maps-list-placeholder"></div> <!-- NEW PLACEHOLDER DIV -->
    <div class="modal-footer no-border">
    <div class="modal-actions full-width">
    <button class="btn btn-primary add-new-map-btn" type="button">
    ➕ Add New Map
    </button>
    </div>
    </div>
    </div>
    </div>
    <!-- Danger Zone Settings Tab -->
    <div id="danger-zone-settings" class="tab-pane">
    <h4>Danger Zone</h4>
    <p class="text-secondary mb-md">
    Proceed with caution. These actions are irreversible and will permanently delete data.
    </p>
    <div class="form-group">
    <button class="btn btn-danger btn-large" id="btn-clear-all-app-data" type="button">
    Clear All App Data
    </button>
    <small class="text-secondary mt-xs">
    This will delete all maps, markers, and associated images from this device.
    </small>
    </div>
    </div>
    </div>
    </div>
    </div>
    </div>
    </div>
    `
    const parser = new DOMParser()
    const modalDoc = parser.parseFromString(modalHtml, 'text/html')
    const modal = modalDoc.querySelector('.modal')
    if (!modal) {
      console.error('Failed to create settings modal element.')
      if (onClose) onClose()
      return null
    }
    document.body.appendChild(modal)
    this.activeModals.add(modal)
    // Append the dynamically created map list here
    const mapsListPlaceholder = modal.querySelector('#maps-list-placeholder')
    if (mapsListPlaceholder && mapsListDOMElement) {
      mapsListPlaceholder.replaceWith(mapsListDOMElement) // Replace the placeholder div with the actual DOM element
    }
    // --- Close Button & Backdrop Listeners ---
    const closeModal = () => {
      this.closeModal(modal)
      if (onClose) onClose()
    }
    modal.querySelector('.modal-close')?.addEventListener('click', closeModal)
    modal.querySelector('.modal-backdrop')?.addEventListener('click', closeModal)
    // --- Tab Switching Logic ---
    const tabButtons = modal.querySelectorAll('.tab-button')
    const tabPanes = modal.querySelectorAll('.tab-pane')
    const activateTab = (tabId) => {
      tabButtons.forEach((button) => {
        if (button.dataset.tab === tabId) {
          button.classList.add('active')
        } else {
          button.classList.remove('active')
        }
      })
      tabPanes.forEach((pane) => {
        if (pane.id === tabId) {
          pane.classList.add('active')
        } else {
          pane.classList.remove('active')
        }
      })
      // Also update the dropdown if it's visible, to ensure consistency
      const mobileTabSelector = modal.querySelector('.settings-tab-selector')
      if (mobileTabSelector) {
        mobileTabSelector.value = tabId
      }
    }
    tabButtons.forEach((button) => {
      button.addEventListener('click', () => {
        activateTab(button.dataset.tab)
      })
    })
    // --- NEW: Mobile Tab Selector (Dropdown) Logic ---
    const mobileTabSelector = modal.querySelector('.settings-tab-selector')
    if (mobileTabSelector) {
      mobileTabSelector.addEventListener('change', (event) => {
        activateTab(event.target.value)
      })
      // Set initial selected option for the dropdown
      mobileTabSelector.value = initialTab
    }
    requestAnimationFrame(() => {
      activateTab(initialTab)
      modal.classList.add('show')
    })
    // Add listener for Clear All App Data button
    const btnClearAllAppData = modal.querySelector('#btn-clear-all-app-data')
    if (btnClearAllAppData) {
      btnClearAllAppData.addEventListener('click', () => {
        if (callbacks.onClearAllAppData) {
          callbacks.onClearAllAppData()
          this.closeModal(modal)
        }
      })
    }
    // --- IMAGE PROCESSING LISTENERS (NEW) ---
    const imageQualitySlider = modal.querySelector('#image-quality-slider')
    const imageQualityValueSpan = modal.querySelector('#image-quality-value')
    if (imageQualitySlider && imageQualityValueSpan) {
      // Initialize slider and display value (convert decimal to percentage)
      const currentQualityDecimal = callbacks.getPhotoQuality ? callbacks.getPhotoQuality() : 0.5 // Default to 0.5 (50%)
      const currentQualityPercentage = Math.round(currentQualityDecimal * 100)
      imageQualitySlider.value = currentQualityPercentage
      imageQualityValueSpan.textContent = `${currentQualityPercentage}%`
      imageQualitySlider.addEventListener('input', () => {
        imageQualityValueSpan.textContent = `${imageQualitySlider.value}%`
      })
      imageQualitySlider.addEventListener('change', () => {
        if (callbacks.setPhotoQuality) {
          callbacks.setPhotoQuality(parseInt(imageQualitySlider.value, 10))
        }
      })
    }
    // Add New Map button listener
    modal.querySelector('.add-new-map-btn')?.addEventListener('click', (e) => {
      e.stopPropagation()
      if (callbacks.onAddNewMap) {
        this.closeModal(modal
        ) // Close settings modal
        callbacks.onAddNewMap() // Call the App's showUploadModal
      }
    })
    // --- END MAPS MANAGEMENT LISTENERS ---
    // --- DATA MANAGEMENT LISTENERS (NEW) ---
    const fileInputImportSettings = modal.querySelector('#file-input-import-settings')
    if (fileInputImportSettings) {
      fileInputImportSettings.addEventListener('change', async (event) => {
        const file = event.target.files[0]
        if (file) {
          if (callbacks.onImportData) {
            await callbacks.onImportData(file)
            // Optionally close the settings modal after import, or let the callback handle it
            // this.closeModal(modal)
          }
        }
        // Clear the file input value to allow importing the same file again if needed
        event.target.value = ''
      })
    }
    // --- MAP DISPLAY LISTENERS (NEW) ---
    const toggleCrosshairSettings = modal.querySelector('#toggle-crosshair-settings')
    if (toggleCrosshairSettings) {
      // Initialize checkbox state from current app setting
      if (callbacks.isCrosshairEnabled) {
        toggleCrosshairSettings.checked = callbacks.isCrosshairEnabled()
      }
      toggleCrosshairSettings.addEventListener('change', () => {
        if (callbacks.onToggleCrosshair) {
          // Pass the new checked state to the callback
          callbacks.onToggleCrosshair(toggleCrosshairSettings.checked)
        }
      })
    }
    // --- APP BEHAVIOR LISTENERS (NEW) ---
    const autoCloseMarkerDetails = modal.querySelector('#auto-close-marker-details')
    const allowDuplicatePhotos = modal.querySelector('#allow-duplicate-photos')
    if (autoCloseMarkerDetails && callbacks.getAutoCloseMarkerDetails) {
      autoCloseMarkerDetails.checked = callbacks.getAutoCloseMarkerDetails()
      autoCloseMarkerDetails.addEventListener('change', () => {
        if (callbacks.setAutoCloseMarkerDetails) {
          callbacks.setAutoCloseMarkerDetails(autoCloseMarkerDetails.checked)
        }
      })
    }
    if (allowDuplicatePhotos && callbacks.getAllowDuplicatePhotos) {
      allowDuplicatePhotos.checked = callbacks.getAllowDuplicatePhotos()
      allowDuplicatePhotos.addEventListener('change', () => {
        if (callbacks.setAllowDuplicatePhotos) {
          callbacks.setAllowDuplicatePhotos(allowDuplicatePhotos.checked)
        }
      })
    }
    return modal
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
}
