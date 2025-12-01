/**
 * SnapSpot PWA - Search Modal UI
 * Standalone module for creating the search modal UI.
 * Delegates lifecycle management to ModalManager.
 */

/* global document DOMParser requestAnimationFrame */

export function createSearchModal (modalManager, callbacks, onClose, initialQuery = '') {
  console.log('SearchModal: Creating new Search Modal.')
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
  modalManager.activeModals.add(modal)
  const closeModal = () => {
    modalManager.closeModal(modal)
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
    console.warn('SearchModal: #execute-search-btn not found in search modal HTML.')
  } else if (!callbacks.onSearch) {
    console.warn('SearchModal: onSearch callback not provided for search modal.')
  }

  // Choose File button
  const searchFileBtn = modal.querySelector('#search-file-btn')
  if (searchFileBtn && callbacks.onSearchFileSelect) {
    searchFileBtn.addEventListener('click', callbacks.onSearchFileSelect)
  } else if (!searchFileBtn) {
    console.warn('SearchModal: #search-file-btn not found in search modal HTML.')
  } else if (!callbacks.onSearchFileSelect) {
    console.warn('SearchModal: onSearchFileSelect callback not provided for search modal.')
  }

  // Clear "X" button inside search input
  const clearSearchTextBtn = modal.querySelector('#clear-search-text-btn')
  if (clearSearchTextBtn && callbacks.onClearSearch) {
    clearSearchTextBtn.addEventListener('click', callbacks.onClearSearch)
  } else if (!clearSearchTextBtn) {
    console.warn('SearchModal: #clear-search-text-btn not found in search modal HTML.')
  } else if (!callbacks.onClearSearch) {
    console.warn('SearchModal: onClearSearch callback not provided for search modal.')
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
    console.warn('SearchModal: #search-input not found in search modal HTML.')
  } else if (!callbacks.onSearchInput) {
    console.warn('SearchModal: onSearchInput callback not provided for search modal.')
  }

  // Auto-focus search input when modal is shown
  requestAnimationFrame(() => {
    modal.classList.add('show')
    searchInput?.focus() // Focus the search input directly
  })
  return modal
}
