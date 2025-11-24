/* global DOMParser requestAnimationFrame */

/**
 * SnapSpot PWA - Settings Modal Module
 * Standalone module for creating the App Settings modal.
 * Extracted from modals.js per Phase 4 refactoring plan.
 */

import { UIRenderer } from './uiRenderer.js'

/**
 * Creates and displays the App Settings modal with tabbed sections.
 * @param {Object} modalManager - Instance of ModalManager for closeModal access.
 * @param {Object} callbacks - Object with callbacks for settings actions.
 * @param {Array<Object>} maps - Array of map metadata objects for Maps Management.
 * @param {string|null} activeMapId - ID of the currently active map.
 * @param {Function} [onClose] - Callback when modal closes.
 * @param {string} [initialTab='general-settings'] - Initial tab ID.
 * @returns {HTMLElement} - Created modal element.
 */
export function createSettingsModal (modalManager, callbacks, maps, activeMapId, onClose, initialTab = 'general-settings') {
  console.log('SettingsModal: Creating new Settings Modal.')

  // Generate Maps Management DOM content using UIRenderer
  let mapsListDOMElement
  if (maps.length === 0) {
    const noMapsParagraph = document.createElement('p')
    noMapsParagraph.classList.add('text-center', 'text-secondary')
    noMapsParagraph.textContent = 'No maps available yet. Add your first map!'
    mapsListDOMElement = noMapsParagraph
  } else {
    const mapsListUl = document.createElement('ul')
    mapsListUl.classList.add('maps-list')
    maps.forEach((map) => {
      const card = UIRenderer.createCardElement(
        map,
        'map',
        {
          onMapSelected: callbacks.onMapSelected,
          onMapDelete: callbacks.onMapDelete,
          onExportHtmlMap: callbacks.onExportHtmlMap,
          onExportJsonMap: callbacks.onExportJsonMap,
          onSettingsModalRefresh: callbacks.onSettingsModalRefresh,
          onViewImageInViewer: (id, type) => callbacks.onViewImageInViewer(id, type)
        },
        map.id === activeMapId
      )
      mapsListUl.appendChild(card)
    })
    mapsListDOMElement = mapsListUl
  }

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
              <div id="general-settings" class="tab-pane">
                <h4>General Settings</h4>
                <div class="form-group">
                  <label class="checkbox-label toggle-switch-label">
                    <input type="checkbox" id="toggle-notifications" />
                    <span class="toggle-switch-slider"></span>
                    Enable Notifications
                  </label>
                  <small class="text-secondary mt-xs">Toggle toast notifications for app events.</small>
                </div>
              </div>
              <div id="app-behavior-settings" class="tab-pane">
                <h4>App Behavior Settings</h4>
                <div class="form-group">
                  <label class="checkbox-label toggle-switch-label">
                    <input type="checkbox" id="auto-close-marker-details" />
                    <span class="toggle-switch-slider"></span>
                    Auto-close marker details after adding photo(s)
                  </label>
                  <small class="text-secondary mt-xs">Automatically close the marker details modal after successfully adding photos.</small>
                </div>
                <div class="form-group mt-md">
                  <label class="checkbox-label toggle-switch-label">
                    <input type="checkbox" id="allow-duplicate-photos" />
                    <span class="toggle-switch-slider"></span>
                    Allow adding duplicate photos to markers
                  </label>
                  <small class="text-secondary mt-xs">Enable to allow the same photo file to be associated with multiple markers.</small>
                </div>
              </div>
              <div id="map-display-settings" class="tab-pane">
                <h4>Map Display Settings</h4>
                <div class="form-group">
                  <label class="checkbox-label toggle-switch-label">
                    <input type="checkbox" id="toggle-crosshair-settings" />
                    <span class="toggle-switch-slider"></span>
                    Show Crosshair
                  </label>
                  <small class="text-secondary mt-xs">Enable or disable the crosshair overlay on the map canvas.</small>
                </div>
                <div class="form-group mt-md">
                  <label for="max-markers-slider">Maximum Markers to Display</label>
                  <div class="slider-container">
                    <input type="range" id="max-markers-slider" min="0" max="200" step="5" class="form-control" />
                    <div class="slider-labels">
                      <span>0 (Unlimited)</span>
                      <span id="max-markers-value" class="text-secondary text-right"></span>
                      <span>200</span>
                    </div>
                  </div>
                  <small class="text-secondary mt-xs">Limit the number of most recent markers shown on the map. Set to 0 for unlimited display.</small>
                </div>
                <div class="custom-marker-coloring-section mt-lg">
                  <h4>Custom Marker Coloring Rules</h4>
                  <p class="text-secondary mb-md">Define rules to automatically color markers based on their description. Rules are applied from top to bottom, with the last matching rule taking precedence.</p>
                  <div id="custom-marker-rules-container">
                    <!-- Rule rows injected by JS -->
                  </div>
                </div>
              </div>
              <div id="image-processing-settings" class="tab-pane">
                <h4>Image Processing Settings</h4>
                <div class="form-group">
                  <label for="image-quality-slider">Default Image Quality (%)</label>
                  <input type="range" id="image-quality-slider" min="10" max="100" step="5" class="form-control" />
                  <span id="image-quality-value" class="text-secondary text-right"></span>
                  <small class="text-secondary mt-xs">Adjust the compression quality for images added to markers (10% = lowest, 100% = highest).</small>
                </div>
              </div>
              <div id="data-management-settings" class="tab-pane">
                <h4>Data Management</h4>
                <p class="text-secondary mb-md">Import map data or other application data.</p>
                <div class="form-group">
                  <label for="file-input-import-settings" class="btn btn-secondary btn-large">
                    📥 <span class="btn-text">Import Map Data (JSON)</span>
                  </label>
                  <input type="file" id="file-input-import-settings" accept=".json" style="display: none" />
                  <small class="text-secondary mt-xs">Select a JSON file containing exported map data to import into the application.</small>
                </div>
              </div>
              <div id="maps-management-settings" class="tab-pane">
                <h4>Maps Management</h4>
                <div class="map-management-content">
                  <div id="maps-list-placeholder"></div>
                  <div class="modal-footer no-border">
                    <div class="modal-actions full-width">
                      <button class="btn btn-primary add-new-map-btn" type="button">➕ Add New Map</button>
                    </div>
                  </div>
                </div>
              </div>
              <div id="danger-zone-settings" class="tab-pane">
                <h4>Danger Zone</h4>
                <p class="text-secondary mb-md">Proceed with caution. These actions are irreversible and will permanently delete data.</p>
                <div class="form-group">
                  <button class="btn btn-danger btn-large" id="btn-clear-all-app-data" type="button">Clear All App Data</button>
                  <small class="text-secondary mt-xs">This will delete all maps, markers, and associated images from this device.</small>
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
  modalManager.activeModals.add(modal)

  // Replace maps placeholder
  const mapsListPlaceholder = modal.querySelector('#maps-list-placeholder')
  if (mapsListPlaceholder && mapsListDOMElement) {
    mapsListPlaceholder.replaceWith(mapsListDOMElement)
  }

  // Close handler
  const closeModal = () => {
    modalManager.closeModal(modal)
    if (onClose) onClose()
  }
  modal.querySelector('.modal-close')?.addEventListener('click', closeModal)
  modal.querySelector('.modal-backdrop')?.addEventListener('click', closeModal)

  // Tab switching
  const tabButtons = modal.querySelectorAll('.tab-button')
  const tabPanes = modal.querySelectorAll('.tab-pane')
  const activateTab = (tabId) => {
    tabButtons.forEach((button) => button.classList.toggle('active', button.dataset.tab === tabId))
    tabPanes.forEach((pane) => pane.classList.toggle('active', pane.id === tabId))
    const mobileTabSelector = modal.querySelector('.settings-tab-selector')
    if (mobileTabSelector) mobileTabSelector.value = tabId
  }

  tabButtons.forEach((button) => button.addEventListener('click', () => activateTab(button.dataset.tab)))

  const mobileTabSelector = modal.querySelector('.settings-tab-selector')
  if (mobileTabSelector) {
    mobileTabSelector.addEventListener('change', (e) => activateTab(e.target.value))
    mobileTabSelector.value = initialTab
  }

  requestAnimationFrame(() => {
    activateTab(initialTab)
    modal.classList.add('show')
  })

  // Clear All Data
  const btnClearAllAppData = modal.querySelector('#btn-clear-all-app-data')
  btnClearAllAppData?.addEventListener('click', () => {
    if (callbacks.onClearAllAppData) {
      callbacks.onClearAllAppData()
      modalManager.closeModal(modal)
    }
  })

  // Quality Slider
  const imageQualitySlider = modal.querySelector('#image-quality-slider')
  const imageQualityValueSpan = modal.querySelector('#image-quality-value')
  if (imageQualitySlider && imageQualityValueSpan && callbacks.getPhotoQuality && callbacks.setPhotoQuality) {
    const currentQualityDecimal = callbacks.getPhotoQuality()
    const currentQualityPercentage = Math.round(currentQualityDecimal * 100)
    imageQualitySlider.value = currentQualityPercentage
    imageQualityValueSpan.textContent = `${currentQualityPercentage}%`
    imageQualitySlider.addEventListener('input', () => {
      imageQualityValueSpan.textContent = `${imageQualitySlider.value}%`
    })
    imageQualitySlider.addEventListener('change', () => callbacks.setPhotoQuality(parseInt(imageQualitySlider.value, 10)))
  }

  // Max Markers Slider
  const maxMarkersSlider = modal.querySelector('#max-markers-slider')
  const maxMarkersValueSpan = modal.querySelector('#max-markers-value')
  if (maxMarkersSlider && maxMarkersValueSpan && callbacks.getMaxMarkersToShow && callbacks.setMaxMarkersToShow) {
    const currentMaxMarkers = callbacks.getMaxMarkersToShow()
    maxMarkersSlider.value = currentMaxMarkers
    maxMarkersValueSpan.textContent = currentMaxMarkers === 0 ? 'Unlimited' : `${currentMaxMarkers} markers`
    maxMarkersSlider.addEventListener('input', () => {
      const value = parseInt(maxMarkersSlider.value)
      maxMarkersValueSpan.textContent = value === 0 ? 'Unlimited' : `${value} markers`
    })
    maxMarkersSlider.addEventListener('change', () => callbacks.setMaxMarkersToShow(parseInt(maxMarkersSlider.value)))
  }

  // Add New Map
  modal.querySelector('.add-new-map-btn')?.addEventListener('click', (e) => {
    e.stopPropagation()
    if (callbacks.onAddNewMap) {
      modalManager.closeModal(modal)
      callbacks.onAddNewMap()
    }
  })

  // Import File
  const fileInputImportSettings = modal.querySelector('#file-input-import-settings')
  if (fileInputImportSettings && callbacks.onImportData) {
    fileInputImportSettings.addEventListener('change', async (e) => {
      const file = e.target.files[0]
      if (file) {
        await callbacks.onImportData(file)
        e.target.value = ''
      }
    })
  }

  // Custom Rules Helper
  const generateRuleRowHtml = (index, rule, colors, operators) => {
    const selectedOperator = rule ? rule.operator : 'none'
    const selectedColor = rule ? rule.color : colors[0].hex
    const ruleValue = rule ? rule.value || '' : ''
    const isValueInputDisabled = selectedOperator !== 'contains'

    const operatorOptions = ['<option value="none">None</option>', ...operators.map(op => `<option value="${op.value}" ${selectedOperator === op.value ? 'selected' : ''}>${op.label}</option>`).join('')].join('')

    const colorOptions = colors.map(color => `<option value="${color.hex}" ${selectedColor === color.hex ? 'selected' : ''}>${color.name}</option>`).join('')

    return `
      <div class="custom-marker-rule-row" data-rule-index="${index}">
        <div class="form-group rule-operator">
          <label for="rule-operator-${index}" class="sr-only">Condition for Rule ${index + 1}</label>
          <select id="rule-operator-${index}" class="form-control">${operatorOptions}</select>
        </div>
        <div class="form-group rule-value">
          <label for="rule-value-${index}" class="sr-only">Value for Rule ${index + 1}</label>
          <input type="text" id="rule-value-${index}" class="form-control" placeholder="Enter text to match" value="${ruleValue}" ${isValueInputDisabled ? 'disabled' : ''} />
        </div>
        <div class="form-group rule-color">
          <label for="rule-color-${index}" class="sr-only">Color for Rule ${index + 1}</label>
          <select id="rule-color-${index}" class="form-control color-select">${colorOptions}</select>
          <span class="color-swatch" style="background-color: ${selectedColor};"></span>
        </div>
      </div>
    `
  }

  // Custom Marker Rules
  const customMarkerRulesContainer = modal.querySelector('#custom-marker-rules-container')
  if (customMarkerRulesContainer && callbacks.getCustomMarkerColors && callbacks.getCustomMarkerOperators && callbacks.getCurrentCustomMarkerRules && callbacks.setAndPersistCustomMarkerRules) {
    const colors = callbacks.getCustomMarkerColors()
    const operators = callbacks.getCustomMarkerOperators()
    let rules = callbacks.getCurrentCustomMarkerRules() || []

    const MAX_RULES = 5
    while (rules.length < MAX_RULES) rules.push(null)
    rules = rules.slice(0, MAX_RULES)

    customMarkerRulesContainer.innerHTML = rules.map((rule, i) => generateRuleRowHtml(i, rule, colors, operators)).join('')

    const updateRules = () => {
      const newRules = []
      modal.querySelectorAll('.custom-marker-rule-row').forEach((row, idx) => {
        const op = row.querySelector(`#rule-operator-${idx}`)
        const val = row.querySelector(`#rule-value-${idx}`)
        const col = row.querySelector(`#rule-color-${idx}`)
        if (op.value !== 'none') {
          newRules.push({
            id: `rule_${idx + 1}`,
            field: 'description',
            operator: op.value,
            value: op.value === 'contains' ? val.value.trim() : null,
            color: col.value
          })
        }
      })
      callbacks.setAndPersistCustomMarkerRules(newRules)
    }

    modal.querySelectorAll('.custom-marker-rule-row').forEach(row => {
      const idx = parseInt(row.dataset.ruleIndex)
      const opSel = row.querySelector(`#rule-operator-${idx}`)
      const valIn = row.querySelector(`#rule-value-${idx}`)
      const colSel = row.querySelector(`#rule-color-${idx}`)
      const swatch = row.querySelector('.color-swatch')

      opSel?.addEventListener('change', () => {
        const op = opSel.value
        valIn.disabled = op !== 'contains'
        if (op !== 'contains') valIn.value = ''
        updateRules()
      })

      valIn?.addEventListener('input', updateRules)

      colSel?.addEventListener('change', () => {
        swatch.style.backgroundColor = colSel.value
        updateRules()
      })
    })
  }

  // Crosshair
  const crosshairChk = modal.querySelector('#toggle-crosshair-settings')
  if (crosshairChk && callbacks.isCrosshairEnabled && callbacks.onToggleCrosshair) {
    crosshairChk.checked = callbacks.isCrosshairEnabled()
    crosshairChk.addEventListener('change', () => callbacks.onToggleCrosshair(crosshairChk.checked))
  }

  // Auto-close
  const autoCloseChk = modal.querySelector('#auto-close-marker-details')
  if (autoCloseChk && callbacks.getAutoCloseMarkerDetails && callbacks.setAutoCloseMarkerDetails) {
    autoCloseChk.checked = callbacks.getAutoCloseMarkerDetails()
    autoCloseChk.addEventListener('change', () => callbacks.setAutoCloseMarkerDetails(autoCloseChk.checked))
  }

  // Duplicates
  const dupChk = modal.querySelector('#allow-duplicate-photos')
  if (dupChk && callbacks.getAllowDuplicatePhotos && callbacks.setAllowDuplicatePhotos) {
    dupChk.checked = callbacks.getAllowDuplicatePhotos()
    dupChk.addEventListener('change', () => callbacks.setAllowDuplicatePhotos(dupChk.checked))
  }

  // Notifications
  const notifChk = modal.querySelector('#toggle-notifications')
  if (notifChk && callbacks.getNotificationsEnabled && callbacks.setNotificationsEnabled) {
    notifChk.checked = callbacks.getNotificationsEnabled()
    notifChk.addEventListener('change', () => callbacks.setNotificationsEnabled(notifChk.checked))
  }

  return modal
}
