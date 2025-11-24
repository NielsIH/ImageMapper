/* global DOMParser, requestAnimationFrame */

/**
 * SnapSpot PWA - Upload Modal
 * Handles the upload modal implementation for map files
 */

import { FileManager } from '../fileManager.js'

// Export all upload modal functions
export function createUploadModal (modalManager, onUpload, onCancel) {
  const modalHtml = `
    <div class="modal" id="upload-modal">
      <div class="modal-backdrop"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h3>Upload New Map</h3>
          <button class="modal-close" type="button" aria-label="Close">&times;</button>
        </div>
        <div class="modal-body">
          <div class="upload-step" id="file-selection-step">
            <div class="file-drop-zone" id="file-drop-zone">
              <div class="file-drop-content">
                <div class="file-drop-icon">📁</div>
                <h4>Choose a map image</h4>
                <p>Drop an image file here or click to browse</p>
                <button class="btn btn-primary" id="browse-files-btn" type="button">Browse Files</button>
                <div class="file-info">
                  <small>Supported formats: JPG, PNG, WebP, GIF, BMP, SVG</small><br>
                  <small>Maximum size: 10MB</small>
                </div>
              </div>
            </div>
          </div>
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
                <input type="text" id="map-name" class="form-control" required maxlength="100" placeholder="Enter a name for this map" />
              </div>
              <div class="form-group">
                <label for="map-description">Description (optional)</label>
                <textarea id="map-description" class="form-control" rows="3" maxlength="500" placeholder="Add a description for this map..."></textarea>
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
          <div class="upload-error hidden" id="upload-error">
            <div class="error-content">
              <div class="error-icon">⚠️</div>
              <div class="error-message" id="error-message"></div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <div class="modal-actions">
            <div class="step-actions" id="file-selection-actions">
              <button class="btn btn-secondary" id="cancel-upload-btn" type="button">Cancel</button>
            </div>
            <div class="step-actions hidden" id="file-details-actions">
              <button class="btn btn-secondary" id="back-to-selection-btn" type="button">Back</button>
              <button class="btn btn-primary" id="create-map-btn" type="button">Create Map</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `

  const parser = new DOMParser()
  const modalDoc = parser.parseFromString(modalHtml, 'text/html')
  const modal = modalDoc.querySelector('.modal')
  document.body.appendChild(modal)
  modalManager.activeModals.add(modal)
  setupUploadModal(modal, onUpload, onCancel, modalManager)
  requestAnimationFrame(() => modal.classList.add('show'))
  return modal
}

export function setupUploadModal (modal, onUpload, onCancel, modalManager) {
  let selectedFile = null
  let processedData = null

  const closeBtn = modal.querySelector('.modal-close')
  const backdrop = modal.querySelector('.modal-backdrop')
  const dropZone = modal.querySelector('#file-drop-zone')
  const browseBtn = modal.querySelector('#browse-files-btn')
  const cancelBtn = modal.querySelector('#cancel-upload-btn')
  const backBtn = modal.querySelector('#back-to-selection-btn')
  const createBtn = modal.querySelector('#create-map-btn')
  const form = modal.querySelector('#map-details-form')
  const nameInput = modal.querySelector('#map-name')
  const descInput = modal.querySelector('#map-description')
  const activeCheckbox = modal.querySelector('#set-as-active')

  const fileManager = new FileManager()

  const showDebugMessage = (message) => {
    const showDebug = window.location.search.includes('debug')
    if (!showDebug) return
    let debugDiv = document.getElementById('picker-debug')
    if (!debugDiv) {
      debugDiv = document.createElement('div')
      debugDiv.id = 'picker-debug'
      debugDiv.style.cssText = 'position:fixed;top:10px;left:10px;right:10px;background:rgba(0,0,0,0.9);color:white;padding:10px;font-size:12px;z-index:10001;max-height:150px;overflow-y:auto;border-radius:5px;font-family:monospace;'
      document.body.appendChild(debugDiv)
    }
    const timestamp = new Date().toLocaleTimeString()
    debugDiv.innerHTML += `<div>${timestamp}: ${message}</div>`
    debugDiv.scrollTop = debugDiv.scrollHeight
  }

  const clearDebugMessages = () => {
    const debugDiv = document.getElementById('picker-debug')
    if (debugDiv) debugDiv.innerHTML = ''
  }

  const closeModal = () => {
    const debugDiv = document.getElementById('picker-debug')
    if (debugDiv) debugDiv.remove()
    modalManager.closeModal(modal)
    if (onCancel) onCancel()
  }

  closeBtn.addEventListener('click', closeModal)
  backdrop.addEventListener('click', closeModal)
  cancelBtn.addEventListener('click', closeModal)

  const handleFileSelect = async (file) => {
    if (!file) return
    try {
      clearDebugMessages()
      showDebugMessage(`✅ File selected: ${file.name}`)
      showDebugMessage(`📊 Size: ${Math.round(file.size / 1024)}KB, Type: ${file.type}`)
      showError(modal, '')
      showLoading(modal, 'Processing file...')
      processedData = await fileManager.processFileUpload(file, { isActive: true })
      selectedFile = file
      showDebugMessage('✅ File processing completed successfully')
      updateFilePreview(modal, processedData)
      showDetailsStep(modal)
    } catch (error) {
      console.error('File processing error:', error)
      showDebugMessage(`❌ File processing failed: ${error.message}`)
      showError(modal, error.message)
    } finally {
      hideLoading(modal)
    }
  }

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
      const files = await fileManager.selectFiles(showDebug, false)
      const file = files && files.length > 0 ? files[0] : null
      if (file) {
        if (showDebug) {
          showDebugMessage(`✅ File selected: ${file.name}`)
          showDebugMessage(`📊 Size: ${Math.round(file.size / 1024)}KB, Type: ${file.type}`)
        }
        await handleFileSelect(file)
      } else if (showDebug) {
        showDebugMessage('❌ File selection cancelled')
      }
    } catch (error) {
      console.error('File selection error:', error)
      if (showDebug) showDebugMessage(`❌ Error: ${error.message}`)
      showError(modal, 'File selection failed. Please try again.')
    }
  })

  addManualStrategyButtons(modal, fileManager, handleFileSelect, showDebugMessage)

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault()
    dropZone.classList.add('drag-over')
  })
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'))
  dropZone.addEventListener('drop', async (e) => {
    e.preventDefault()
    dropZone.classList.remove('drag-over')
    const files = e.dataTransfer.files
    if (files.length > 0) {
      showDebugMessage(`📎 File dropped: ${files[0].name}`)
      await handleFileSelect(files[0])
    }
  })

  backBtn.addEventListener('click', () => showSelectionStep(modal))

  const handleSubmit = async () => {
    if (!processedData || !selectedFile) {
      showError(modal, 'No file selected')
      return
    }
    if (!nameInput.value.trim()) {
      showError(modal, 'Map name is required')
      nameInput.focus()
      return
    }
    try {
      showLoading(modal, 'Creating map...')
      const finalData = {
        ...processedData,
        name: nameInput.value.trim(),
        description: descInput.value.trim(),
        isActive: activeCheckbox.checked
      }
      if (onUpload) await onUpload(finalData, selectedFile)
      closeModal()
    } catch (error) {
      console.error('Map creation error:', error)
      showDebugMessage(`❌ Upload failed: ${error.message}`)
      showError(modal, error.message)
    } finally {
      hideLoading(modal)
    }
  }

  createBtn.addEventListener('click', handleSubmit)
  form.addEventListener('submit', (e) => {
    e.preventDefault()
    handleSubmit()
  })
  nameInput.addEventListener('focus', () => showError(modal, ''))

  function addManualStrategyButtons (modal, fileManager, handleFileSelect, showDebugMessage) {
    const dropZone = modal.querySelector('#file-drop-zone')
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

  function updateFilePreview (modal, processedData) {
    const previewImg = modal.querySelector('#preview-image')
    const fileName = modal.querySelector('#file-name')
    const fileSize = modal.querySelector('#file-size')
    const fileDimensions = modal.querySelector('#file-dimensions')
    const nameInput = modal.querySelector('#map-name')
    previewImg.src = processedData.thumbnail
    fileName.textContent = processedData.fileName
    fileSize.textContent = new FileManager().formatFileSize(processedData.fileSize)
    fileDimensions.textContent = `${processedData.width} x ${processedData.height} pixels`
    nameInput.value = processedData.name
  }

  function showDetailsStep (modal) {
    const selectionStep = modal.querySelector('#file-selection-step')
    const detailsStep = modal.querySelector('#file-details-step')
    const selectionActions = modal.querySelector('#file-selection-actions')
    const detailsActions = modal.querySelector('#file-details-actions')
    selectionStep.classList.add('hidden')
    detailsStep.classList.remove('hidden')
    selectionActions.classList.add('hidden')
    detailsActions.classList.remove('hidden')
    setTimeout(() => modal.querySelector('#map-name').focus(), 100)
  }

  function showSelectionStep (modal) {
    const selectionStep = modal.querySelector('#file-selection-step')
    const detailsStep = modal.querySelector('#file-details-step')
    const selectionActions = modal.querySelector('#file-selection-actions')
    const detailsActions = modal.querySelector('#file-details-actions')
    selectionStep.classList.remove('hidden')
    detailsStep.classList.add('hidden')
    selectionActions.classList.remove('hidden')
    detailsActions.classList.add('hidden')
  }

  function showError (modal, message) {
    const errorDisplay = modal.querySelector('#upload-error')
    const errorMessage = modal.querySelector('#error-message')
    if (message) {
      errorMessage.textContent = message
      errorDisplay.classList.remove('hidden')
    } else {
      errorDisplay.classList.add('hidden')
    }
  }

  function showLoading (modal, message = 'Loading...') {
    modal.classList.add('loading')
    const form = modal.querySelector('#map-details-form')
    if (form) {
      const inputs = form.querySelectorAll('input, textarea, button')
      inputs.forEach((input) => { input.disabled = true })
    }
    const createBtn = modal.querySelector('#create-map-btn')
    if (createBtn) createBtn.textContent = message
  }

  function hideLoading (modal) {
    modal.classList.remove('loading')
    const form = modal.querySelector('#map-details-form')
    if (form) {
      const inputs = form.querySelectorAll('input, textarea, button')
      inputs.forEach((input) => { input.disabled = false })
    }
    const createBtn = modal.querySelector('#create-map-btn')
    if (createBtn) createBtn.textContent = 'Create Map'
  }
}
