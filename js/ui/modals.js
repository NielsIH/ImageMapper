/**
 * Image Mapper PWA - Modal Components
 * Phase 1B: Modal system for file upload and map management
 */

/**
 * Modal manager for creating and managing modal dialogs
 */

/* global document, window DOMParser requestAnimationFrame FileManager */

class ModalManager {
  constructor () {
    this.activeModals = new Set()
    this.setupGlobalListeners()
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
   * Creates a comprehensive Map Management Modal to display, select, add, and delete maps.
   * @param {Array<Object>} maps - Array of map metadata objects (with thumbnailDataUrl).
   * @param {string|null} activeMapId - ID of the currently active map.
   * @param {Function} onMapSelected - Callback when a map is selected from the list.
   * @param {Function} onMapDelete - Callback when a map's delete button is clicked.
   * @param {Function} onAddNewMap - Callback when the '+ Add New Map' button is clicked.
   * @param {Function} onClose - Callback when the modal is closed.
   * @param {Function} [onModalReady] - Optional callback when modal is fully displayed/ready.
   * @returns {HTMLElement} - Modal element.
   */
  createMapManagementModal (maps, activeMapId, onMapSelected, onMapDelete, onAddNewMap, onClose, onModalReady) {
    const modalHtml = `
  <div class="modal" id="map-management-modal">
    <div class="modal-backdrop"></div>
    <div class="modal-content">
      <div class="modal-header">
        <h3>Manage Your Maps</h3>
        <button class="modal-close" type="button" aria-label="Close">×</button>
      </div>
      <div class="modal-body">
        <div class="maps-management-container">
          ${maps.length === 0
            ? '<p class="text-center text-secondary">No maps available yet. Add your first map!</p>'
            : `
            <ul class="maps-list">
              ${maps.map(map => `
                <li class="map-list-item ${map.id === activeMapId ? 'active' : ''} ${map.id !== activeMapId ? 'clickable' : ''}" data-map-id="${map.id}">
                  <div class="map-card-content">
                    <div class="map-thumbnail-container">
                      ${map.thumbnailDataUrl ? `<img src="${map.thumbnailDataUrl}" alt="Map thumbnail" class="map-thumbnail" />` : `<div class="map-initials">${map.name.substring(0, 2).toUpperCase()}</div>`}
                    </div>
                    <div class="map-info">
                      <span class="map-name">${map.name}</span>
                      <span class="map-details">${map.width} × ${map.height} px</span>
                      ${map.id === activeMapId ? '<span class="active-status">Active</span>' : ''}
                    </div>
                  </div>
                  <div class="map-item-actions">
                    <button class="btn btn-danger btn-small delete-map-btn" data-map-id="${map.id}" title="Delete Map">🗑️</button>
                  </div>
                </li>
              `).join('')}
            </ul>
          `}
        </div>
        <div class="map-actions-footer">
            <button class="btn btn-primary btn-large add-new-map-btn" type="button">
                ➕ Add New Map
            </button>
        </div>
      </div>
      
      <div class="modal-footer hidden">
        <!-- No footer actions needed here, moved to map-actions-footer inside body -->
      </div>
    </div>
  </div>
`

    const parser = new DOMParser()
    const modalDoc = parser.parseFromString(modalHtml, 'text/html')
    const modal = modalDoc.querySelector('.modal')
    if (!modal) {
      console.error('Failed to create map management modal element.')
      if (onClose) onClose() // Try to close silently or notify if creation failed
      return null
    }

    document.body.appendChild(modal)
    this.activeModals.add(modal)

    // --- Event Listeners ---
    const closeModal = () => {
      this.closeModal(modal)
      if (onClose) onClose()
    }

    modal.querySelector('.modal-close')?.addEventListener('click', closeModal)
    modal.querySelector('.modal-backdrop')?.addEventListener('click', closeModal)
    // The previous maps-list-close-btn is now part of the general close logic or will be replaced.
    // For now, modal footer is hidden, rely on modal-close or backdrop click.

    // Select map (list item click)
    modal.querySelectorAll('.map-list-item.clickable').forEach(item => {
      item.addEventListener('click', (e) => {
        // Prevent event from propagating to delete button if clicked
        if (e.target.closest('.delete-map-btn')) return

        const mapId = item.dataset.mapId
        if (onMapSelected) {
          onMapSelected(mapId)
          // Modal will be re-opened by app.js (showMapManagementModal) to show new active state
          this.closeModal(modal)
        }
      })
    })

    // Delete map button
    modal.querySelectorAll('.delete-map-btn').forEach(button => {
      button.addEventListener('click', (e) => {
        e.stopPropagation() // Prevent this click from triggering the parent li's click
        const mapId = button.dataset.mapId
        if (onMapDelete && confirm('Are you sure you want to delete this map? This cannot be undone.')) {
          onMapDelete(mapId)
          this.closeModal(modal) // Close modal and let app.js re-open to reflect change
        }
      })
    })

    // Add New Map button
    modal.querySelector('.add-new-map-btn')?.addEventListener('click', (e) => {
      e.stopPropagation()
      if (onAddNewMap) {
        onAddNewMap()
        this.closeModal(modal) // Close this modal to open the upload modal
      }
    })

    // Populate map initials if no thumbnail
    modal.querySelectorAll('.map-initials').forEach(initialsDiv => {
      const mapId = initialsDiv.closest('.map-list-item')?.dataset.mapId
      const map = maps.find(m => m.id === mapId)
      if (map) {
        initialsDiv.textContent = map.name.substring(0, 2).toUpperCase()
      }
    })

    requestAnimationFrame(() => {
      modal.classList.add('show')
      if (onModalReady) {
        onModalReady()
      }
    })

    return modal
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
   * Set up upload modal functionality
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
    const selectionStep = modal.querySelector('#file-selection-step')
    const detailsStep = modal.querySelector('#file-details-step')
    const selectionActions = modal.querySelector('#file-selection-actions')
    const detailsActions = modal.querySelector('#file-details-actions')
    const errorDisplay = modal.querySelector('#upload-error')

    // Form elements
    const form = modal.querySelector('#map-details-form')
    const nameInput = modal.querySelector('#map-name')
    const descInput = modal.querySelector('#map-description')
    const activeCheckbox = modal.querySelector('#set-as-active')

    // Preview elements
    const previewImg = modal.querySelector('#preview-image')
    const fileName = modal.querySelector('#file-name')
    const fileSize = modal.querySelector('#file-size')
    const fileDimensions = modal.querySelector('#file-dimensions')

    // File manager instance
    const fileManager = new FileManager()

    // Close modal handlers
    const closeModal = () => {
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
        this.showError(modal, '')
        this.showLoading(modal, 'Processing file...')

        // Process the file
        processedData = await fileManager.processFileUpload(file, {
          isActive: true // Default to active for new uploads
        })
        selectedFile = file

        // Update preview
        this.updateFilePreview(modal, processedData)

        // Switch to details step
        this.showDetailsStep(modal)
      } catch (error) {
        console.error('File processing error:', error)
        this.showError(modal, error.message)
      } finally {
        this.hideLoading(modal)
      }
    }

    // Browse button
    browseBtn.addEventListener('click', async () => {
      const file = await fileManager.selectFile()
      if (file) {
        await handleFileSelect(file)
      }
    })

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

      // Validate form
      if (!nameInput.value.trim()) {
        this.showError(modal, 'Map name is required')
        nameInput.focus()
        return
      }

      try {
        this.showLoading(modal, 'Creating map...')

        // Update processed data with form values
        const finalData = {
          ...processedData,
          name: nameInput.value.trim(),
          description: descInput.value.trim(),
          isActive: activeCheckbox.checked
        }

        // Call upload callback
        if (onUpload) {
          await onUpload(finalData, selectedFile)
        }

        // Close modal
        this.closeModal(modal)
      } catch (error) {
        console.error('Map creation error:', error)
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

    // Auto-focus name input when details step is shown
    nameInput.addEventListener('focus', () => {
      this.showError(modal, '')
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
      inputs.forEach(input => input.disabled = true)
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
      inputs.forEach(input => input.disabled = false)
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
  closeModal (modal) {
    modal.classList.remove('show')
    this.activeModals.delete(modal)

    setTimeout(() => {
      if (modal.parentNode) {
        modal.parentNode.removeChild(modal)
      }
    }, 300) // Wait for CSS transition
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
    Array.from(this.activeModals).forEach(modal => {
      this.closeModal(modal)
    })
  }
}

// Export for use in other modules
window.ModalManager = ModalManager
