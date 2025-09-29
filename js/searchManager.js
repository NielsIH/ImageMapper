// js/searchManager.js
/**
 * @fileoverview Manages the search modal and its functionality.
 */

/* globals document confirm */

import { UIRenderer } from './ui/uiRenderer.js'
import { FileManager } from './fileManager.js'

export class SearchManager {
  constructor (modalManager, appCallbacks) {
    this.modalManager = modalManager
    this.appCallbacks = appCallbacks

    this.searchModal = null
    this.searchInput = null
    this.clearSearchTextBtn = null
    this.searchResultsContainer = null
    this.searchInitialMessage = null
    this.searchOptionsContainer = null
    this.fileManager = new FileManager()

    this.performSearch = this.performSearch.bind(this)
    this.clearSearch = this.clearSearch.bind(this)
    this.handleSearchInput = this.handleSearchInput.bind(this)
  }

  init (modalElement) {
    this.searchModal = modalElement
    this.searchInput = modalElement.querySelector('#search-input')
    this.clearSearchTextBtn = modalElement.querySelector('#clear-search-text-btn')
    this.searchResultsContainer = modalElement.querySelector('#search-results-container')
    this.searchInitialMessage = modalElement.querySelector('#search-initial-message')
    // this.searchOptionsContainer = modalElement.querySelector('#search-options-container') // Assuming this is part of the modal for future use

    this.handleSearchInput()
  }

  openSearchModal (initialQuery = '') {
    const modalElement = this.modalManager.createSearchModal(
      {
        onSearch: this.performSearch,
        onSearchFileSelect: this.appCallbacks.onSearchFileSelect,
        onClearSearch: this.clearSearch,
        onSearchInput: this.handleSearchInput
      },
      () => this.onModalClosed(),
      initialQuery
    )

    if (modalElement) {
      this.init(modalElement)
      this.searchResultsContainer.innerHTML = ''
      this.searchInitialMessage.classList.remove('hidden')

      if (initialQuery) {
        if (this.searchInput) {
          this.searchInput.value = initialQuery
        }
        this.performSearch()
      }
      this.handleSearchInput()
    }
  }

  onModalClosed () {
    this.searchModal = null
    this.searchInput = null
    this.clearSearchTextBtn = null
    this.searchResultsContainer = null
    this.searchInitialMessage = null
    // this.searchOptionsContainer = null // Clean up this if used
    console.log('Search modal closed and SearchManager cleaned up.')
  }

  handleSearchInput () {
    if (this.searchInput && this.clearSearchTextBtn) {
      if (this.searchInput.value.length > 0) {
        this.clearSearchTextBtn.classList.remove('hidden')
      } else {
        this.clearSearchTextBtn.classList.add('hidden')
      }
      if (this.searchInput.value.length === 0 && this.searchInitialMessage) {
        this.searchInitialMessage.classList.remove('hidden')
        if (this.searchResultsContainer) {
          this.searchResultsContainer.innerHTML = ''
        }
      }
    }
  }

  clearSearch () {
    if (this.searchInput) {
      this.searchInput.value = ''
    }
    if (this.searchResultsContainer) {
      this.searchResultsContainer.innerHTML = ''
      if (this.searchInitialMessage) {
        this.searchInitialMessage.classList.remove('hidden')
      }
    }
    this.handleSearchInput()
    if (this.searchInput) {
      this.searchInput.focus()
    }
  }

  async performSearch () {
    if (!this.searchInput || !this.searchResultsContainer || !this.searchInitialMessage) {
      console.error('SearchManager: Critical DOM elements not available for performSearch. Skipped.')
      return
    }
    const query = this.searchInput.value.trim()

    if (!query) {
      this.searchResultsContainer.innerHTML = '<p class="text-caution text-center">Please enter a search term or select a file.</p>'
      this.searchInitialMessage.classList.remove('hidden')
      return
    }

    console.log(`SearchManager: Performing search for: "${query}"`)
    this.searchResultsContainer.innerHTML = '<p class="text-secondary text-center">Searching...</p>'
    this.searchInitialMessage.classList.add('hidden')

    // Fetch both map and photo results
    const mapResults = await this.appCallbacks.searchMaps(query)
    const photoResults = await this.appCallbacks.searchPhotos(query) // NEW: Fetch photo results

    this._displayResults(mapResults, photoResults) // Modified to pass both
  }

  _displayResults (mapResults, photoResults) { // Modified to accept photoResults
    if (!this.searchResultsContainer || !this.searchInitialMessage) {
      console.error('SearchManager: Critical DOM elements not available for _displayResults. Skipped.')
      return
    }
    this.searchResultsContainer.innerHTML = ''

    if (mapResults.length === 0 && photoResults.length === 0) { // Check both
      this.searchResultsContainer.innerHTML = '<p class="text-secondary text-center">No results found for your search.</p>'
      this.searchInitialMessage.classList.remove('hidden')
      return
    }

    // --- Display Map Results ---
    if (mapResults.length > 0) {
      const mapsSection = document.createElement('div')
      mapsSection.classList.add('search-results-section')
      mapsSection.innerHTML = '<h4>Maps Found</h4>'
      const mapsListUl = document.createElement('ul')
      mapsListUl.classList.add('maps-list') // Keep this class for maps

      mapResults.forEach(map => {
        const mapCardCallbacks = {
          onMapSelected: async (mapId) => {
            await this.appCallbacks.switchToMap(mapId)
            this.modalManager.closeTopModal()
          },
          onMapDelete: async (mapId) => {
            if (confirm('Are you sure you want to delete this map? This cannot be undone!')) {
              await this.appCallbacks.deleteMap(mapId)
              this.performSearch()
            }
          },
          onExportHtmlMap: async (mapId) => {
            await this.appCallbacks.exportHtmlReport(mapId)
          },
          onExportJsonMap: async (mapId) => {
            await this.appCallbacks.exportJsonMap(mapId)
          },
          onViewImageInViewer: (mapId, itemType) => this.appCallbacks.onViewImageInViewer(mapId, itemType)
        }
        const mapCard = UIRenderer.createCardElement(map, 'map', mapCardCallbacks, false)
        mapsListUl.appendChild(mapCard)
      })
      mapsSection.appendChild(mapsListUl)
      this.searchResultsContainer.appendChild(mapsSection)
    }

    // --- Display Photo Results --- NEW SECTION
    if (photoResults.length > 0) {
      const photosSection = document.createElement('div')
      photosSection.classList.add('search-results-section')
      photosSection.innerHTML = '<h4>Photos Found</h4>'
      const photosListUl = document.createElement('ul')
      photosListUl.classList.add('photos-list') // New class for photos

      photoResults.forEach(photo => {
        const photoCardCallbacks = {
          onViewPhotoInViewer: async (photoData) => { // photoData includes mapId, markerId, photoId, etc.
            await this.appCallbacks.onViewImageInViewer(photoData, 'photo') // Pass photoData and type
          },
          onShowPhotoOnMap: async (photoData) => { // photoData includes mapId, markerId, photoId
            // This callback will handle switching map and centering marker
            await this.appCallbacks.onShowPhotoOnMap(photoData)
            this.modalManager.closeTopModal() // Close search modal after action
          }
        }
        // UIRenderer will need to be updated to handle 'photo' type cards
        const photoCard = UIRenderer.createCardElement(photo, 'photo', photoCardCallbacks, false)
        photosListUl.appendChild(photoCard)
      })
      photosSection.appendChild(photosListUl)
      this.searchResultsContainer.appendChild(photosSection)
    }

    this.searchInitialMessage.classList.add('hidden')
  }
}
