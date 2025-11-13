/**
 * @fileoverview UIRenderer module for generating reusable UI components.
 */
/* globals  */
export class UIRenderer {
  /**
   * Creates a card element for a map, marker, or photo.
   * @param {Object} itemData - The data for the item (map, marker, or photo).
   * @param {string} itemType - The type of item ('map', 'marker', or 'photo').
   * @param {Object} callbacks - Object containing various callbacks for actions.
   * @param {boolean} [isActive=false] - Whether this item is currently active (e.g., the currently selected map).
   * @returns {HTMLElement} The created list item element.
   */
  static createCardElement (itemData, itemType, callbacks, isActive = false) {
    const li = document.createElement('li')
    li.classList.add(`${itemType}-list-item`)
    if (isActive) {
      li.classList.add('active')
    }

    let thumbnailHtml = ''
    let nameHtml = ''
    let detailsHtml = ''
    let actionsHtml = ''

    // Determine content based on itemType
    switch (itemType) {
      case 'map': {
        const initials = itemData.name ? itemData.name.substring(0, 2).toUpperCase() : '??'
        const markerCountText = itemData.markerCount === 1 ? '1 Marker' : `${itemData.markerCount} Markers`

        thumbnailHtml = `
            <div class="map-thumbnail-container">
                ${itemData.thumbnailDataUrl ? `<img src="${itemData.thumbnailDataUrl}" alt="Map Thumbnail" class="map-thumbnail">` : `<span class="map-initials">${initials}</span>`}
            </div>
          `
        nameHtml = `<span class="map-name">${itemData.name}</span>`
        detailsHtml = `<span class="map-details">${markerCountText}</span>`

        // Conditionally visible buttons
        const hasMarkers = itemData.markerCount > 0

        const viewImageButton = callbacks.onViewImageInViewer
          ? `<button class="btn map-action-btn view-map-image-btn" data-id="${itemData.id}" title="View Map Image">👁️ <span class="btn-text">View</span></button>`
          : ''

        const exportHtmlButton = hasMarkers // Conditional display for HTML Report
          ? `<button class="btn map-action-btn export-map-btn" data-id="${itemData.id}" title="Export HTML Map">📝 <span class="btn-text">Report</span></button>`
          : ''

        const exportJsonButton = `<button class="btn map-action-btn export-json-btn" data-id="${itemData.id}" title="Export JSON Map">💾 <span class="btn-text">Export</span></button>` // Always available

        const deleteButton = !isActive // Conditional display for Delete (not active map)
          ? `<button class="btn map-action-btn delete-map-btn" data-id="${itemData.id}" title="Delete Map">🗑️ <span class="btn-text">Delete</span></button>`
          : ''

        actionsHtml = `
            <div class="map-item-actions-wrapper">
                ${viewImageButton}
                ${exportHtmlButton}
                ${exportJsonButton}
                ${deleteButton}
            </div>
            `
        if (!isActive) {
          li.classList.add('clickable')
        } else {
          detailsHtml += '<span class="active-status">Active Map</span>'
        }
        break
      }

      case 'photo': {
        const initials = itemData.fileName ? itemData.fileName.substring(0, 2).toUpperCase() : '??'
        thumbnailHtml = `
              <div class="photo-thumbnail-container">
                  ${itemData.thumbnailDataUrl ? `<img src="${itemData.thumbnailDataUrl}" alt="Photo Thumbnail" class="photo-thumbnail">` : `<span class="photo-initials">${initials}</span>`}
              </div>
          `
        nameHtml = `<span class="photo-name">${itemData.fileName}</span>`
        detailsHtml = `
              <span class="photo-details">Map: ${itemData.mapName}</span>
              <span class="photo-details">Marker: ${itemData.markerDescription}</span>
          `

        const viewPhotoButton = callbacks.onViewPhotoInViewer
          ? `<button class="btn photo-action-btn view-photo-btn" data-id="${itemData.id}" title="View Photo">👁️ <span class="btn-text">View</span></button>`
          : ''

        // The "Show on Map" button will pass the entire itemData for context
        const showOnMapButton = callbacks.onShowPhotoOnMap
          ? `<button class="btn photo-action-btn show-on-map-btn" data-id="${itemData.id}" title="Show on Map">📍<span class="btn-text">Marker</span></button>`
          : ''

        actionsHtml = `
              <div class="photo-item-actions-wrapper">
                  ${viewPhotoButton}
                  ${showOnMapButton}
              </div>
          `
        li.classList.add('clickable') // Photos are always clickable based on their actions
        break
      }

      // ... (other itemType cases like 'marker' if they exist) ...
      default:
        nameHtml = `<span>${itemData.name || itemData.fileName || 'Unnamed Item'}</span>`
        break
    }

    li.innerHTML = `
        <div class="${itemType}-card-content">
            ${thumbnailHtml}
            <div class="${itemType}-info">
                ${nameHtml}
                ${detailsHtml}
            </div>
        </div>
        ${actionsHtml}
    `

    // --- Attach Event Listeners ---
    // Listener for the View Map Image button (existing)
    li.querySelector('.view-map-image-btn')?.addEventListener('click', (e) => {
      e.stopPropagation() // Prevent the li click (map selection) from firing
      if (callbacks.onViewImageInViewer) {
        callbacks.onViewImageInViewer(itemData.id, itemType)
      }
    })

    if (itemType === 'map') {
      if (!isActive) {
        li.addEventListener('click', (e) => {
          // Only trigger if a specific action button (including the new view button and other export/delete buttons) wasn't clicked
          if (!e.target.closest('.map-action-btn') && callbacks.onMapSelected) {
            callbacks.onMapSelected(itemData.id)
          }
        })
      }
      li.querySelector('.export-map-btn')?.addEventListener('click', (e) => {
        e.stopPropagation() // Prevent li click from firing
        if (callbacks.onExportHtmlMap) callbacks.onExportHtmlMap(itemData.id)
      })
      li.querySelector('.export-json-btn')?.addEventListener('click', (e) => {
        e.stopPropagation() // Prevent li click from firing
        if (callbacks.onExportJsonMap) callbacks.onExportJsonMap(itemData.id)
      })
      li.querySelector('.delete-map-btn')?.addEventListener('click', async (e) => {
        e.stopPropagation() // Prevent li click from firing
        if (callbacks.onMapDelete) await callbacks.onMapDelete(itemData.id)
        if (callbacks.onSettingsModalRefresh) await callbacks.onSettingsModalRefresh('maps-management-settings')
      })
    }

    if (itemType === 'photo') {
      li.querySelector('.view-photo-btn')?.addEventListener('click', (e) => {
        e.stopPropagation()
        if (callbacks.onViewPhotoInViewer) {
          // For photo viewer, we pass the photo ID directly
          callbacks.onViewPhotoInViewer(itemData.id, itemType)
        }
      })

      li.querySelector('.show-on-map-btn')?.addEventListener('click', (e) => {
        e.stopPropagation()
        if (callbacks.onShowPhotoOnMap) {
          // For 'show on map', we pass the entire enriched itemData
          callbacks.onShowPhotoOnMap(itemData)
        }
      })
    }
    // ... (other event listeners for marker/photo types) ...

    return li
  }
}
