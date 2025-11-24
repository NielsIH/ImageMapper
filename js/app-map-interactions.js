/**
 * SnapSpot PWA - Map Interaction System
 * Handles all map interaction functionality (mouse, touch, zoom, pan, rotation)
 */

import * as MarkerPhotoManager from './app-marker-photo-manager.js'

// Export all map interaction functions
export function setupMapInteractionListeners (app) {
  // Implementation will be moved from app.js
}

export function handleMapMouseDown (app, event) {
  if (!app.currentMap || event.button !== 0) return

  app.initialDownX = event.clientX
  app.initialDownY = event.clientY

  const clickedMarker = getMarkerAtPoint(app, event.clientX, event.clientY)

  if (clickedMarker && !app.markersLocked) {
    app.interactionType = 'marker_drag'
    app.isDraggingMarker = true
    app.draggedMarkerId = clickedMarker.id
    app.dragStartMapX = clickedMarker.x
    app.dragStartMapY = clickedMarker.y
    console.log('Interaction start: Marker drag detected for:', clickedMarker.id)
  } else {
    app.interactionType = 'map_pan'
    app.isDragging = true
    app.lastX = event.clientX
    app.lastY = event.clientY
    console.log('Interaction start: Map pan detected.')
  }

  const mapContainer = document.getElementById('map-container')
  if (mapContainer) {
    mapContainer.style.cursor = 'grabbing'
    mapContainer.style.userSelect = 'none'
  }
}

export function handleMapMouseMove (app, event) {
  event.preventDefault()

  if (app.interactionType === 'marker_drag' && app.draggedMarkerId) {
    const deltaX = event.clientX - app.initialDownX
    const deltaY = event.clientY - app.initialDownY

    const { mapDeltaX, mapDeltaY } = app.mapRenderer.screenVectorToMapVector(deltaX, deltaY)

    const currentMarkerMapX = app.dragStartMapX + mapDeltaX
    const currentMarkerMapY = app.dragStartMapY + mapDeltaY

    const markerIndex = app.markers.findIndex(m => m.id === app.draggedMarkerId)
    if (markerIndex !== -1) {
      app.markers[markerIndex].x = currentMarkerMapX
      app.markers[markerIndex].y = currentMarkerMapY
      app.mapRenderer.setMarkers(app.markers)
      app.mapRenderer.render()
    }
  } else if (app.interactionType === 'map_pan') {
    const deltaX = event.clientX - app.lastX
    const deltaY = event.clientY - app.lastY
    app.mapRenderer.pan(deltaX, deltaY)
    app.lastX = event.clientX
    app.lastY = event.clientY
  }
}

export async function handleMapMouseUp (app, event) {
  const mapContainer = document.getElementById('map-container')
  if (mapContainer) {
    mapContainer.style.cursor = 'grab'
    mapContainer.style.userSelect = 'auto'
  }

  const mouseUpX = event.clientX
  const mouseUpY = event.clientY

  const CLICK_THRESHOLD = 5
  const distanceMoved = Math.sqrt(
    Math.pow(mouseUpX - app.initialDownX, 2) +
    Math.pow(mouseUpY - app.initialDownY, 2)
  )

  if (app.interactionType === 'marker_drag' && app.draggedMarkerId) {
    const markerToSave = app.markers.find(m => m.id === app.draggedMarkerId)
    if (markerToSave) {
      if (distanceMoved < CLICK_THRESHOLD) {
        console.log('Marker clicked (via short drag):', markerToSave.id)
        MarkerPhotoManager.showMarkerDetails(app, markerToSave.id)
      } else {
        try {
          await app.storage.updateMarker(markerToSave.id, {
            x: markerToSave.x,
            y: markerToSave.y,
            lastModified: new Date()
          })
          console.log(`Marker ${markerToSave.id} position saved after drag.`)
          app.showNotification('Marker moved and saved.', 'success')
        } catch (error) {
          console.error('Failed to save dragged marker position:', error)
          app.showErrorMessage('Save Error', 'Failed to save marker position.')
        }
      }
    }
  } else if (app.interactionType === 'map_pan') {
    if (distanceMoved < CLICK_THRESHOLD) {
      const clickedMarker = getMarkerAtPoint(app, mouseUpX, mouseUpY)
      if (clickedMarker) {
        console.log('Marker clicked (via short map pan interaction):', clickedMarker.id)
        MarkerPhotoManager.showMarkerDetails(app, clickedMarker.id)
      } else {
        console.log('Map or empty space clicked (via short map pan interaction).')
      }
    } else {
      console.log('Map pan ended.')
    }
  }

  app.interactionType = 'none'
  app.isDragging = false
  app.isDraggingMarker = false
  app.draggedMarkerId = null
  app.initialPinchDistance = 0
  app.lastScale = 1
  console.log('Interaction state reset.')
}

export function handleMapWheel (app, event) {
  if (!app.currentMap) return

  event.preventDefault()

  const mapRect = app.mapRenderer.canvas.getBoundingClientRect()
  const mouseX = event.clientX - mapRect.left
  const mouseY = event.clientY - mapRect.top

  let zoomFactor = 1.1
  if (event.deltaY > 0) {
    zoomFactor = 1 / zoomFactor
  }

  app.mapRenderer.zoom(zoomFactor, mouseX, mouseY)
  console.log('Map wheel - zoomed')
}

export function handleMapTouchStart (app, event) {
  if (!app.currentMap) return

  event.preventDefault()

  app.initialDownX = event.touches[0] ? event.touches[0].clientX : 0
  app.initialDownY = event.touches[0] ? event.touches[0].clientY : 0

  for (let i = 0; i < event.changedTouches.length; i++) {
    const touch = event.changedTouches[i]
    app.activeTouches.set(touch.identifier, {
      x: touch.clientX,
      y: touch.clientY,
      initialX: touch.clientX,
      initialY: touch.clientY
    })
  }

  if (app.activeTouches.size === 1) {
    const touch = event.changedTouches[0]
    const touchedMarker = getMarkerAtPoint(app, touch.clientX, touch.clientY)

    if (touchedMarker && !app.markersLocked) {
      app.interactionType = 'marker_drag'
      app.isDraggingMarker = true
      app.draggedMarkerId = touchedMarker.id
      app.dragStartMapX = touchedMarker.x
      app.dragStartMapY = touchedMarker.y
      console.log('Interaction start: Touch marker drag detected for:', touchedMarker.id)
    } else {
      app.interactionType = 'map_pan'
      app.isDragging = true
      app.lastX = touch.clientX
      app.lastY = touch.clientY
      console.log('Interaction start: Touch map pan detected.')
    }
  } else if (app.activeTouches.size === 2) {
    app.interactionType = 'pinch_zoom'
    const touches = Array.from(app.activeTouches.values())
    const dist = getDistance(touches[0], touches[1])
    app.initialPinchDistance = dist
    app.lastScale = app.mapRenderer.scale
    console.log('Interaction start: Pinch zoom detected.')
  }
}

export async function handleMapTouchMove (app, event) {
  if (!app.currentMap) return

  event.preventDefault()

  for (let i = 0; i < event.changedTouches.length; i++) {
    const touch = event.changedTouches[i]
    if (app.activeTouches.has(touch.identifier)) {
      const storedTouch = app.activeTouches.get(touch.identifier)
      storedTouch.x = touch.clientX
      storedTouch.y = touch.clientY
    }
  }

  if (app.activeTouches.size === 2 && app.interactionType !== 'pinch_zoom') {
    app.interactionType = 'pinch_zoom'
    const touches = Array.from(app.activeTouches.values())
    app.initialPinchDistance = getDistance(touches[0], touches[1])
    app.lastScale = app.mapRenderer.scale
    app.isDragging = false
    app.isDraggingMarker = false
    console.log('Interaction type changed to: Pinch zoom.')
    return
  }

  if (app.interactionType === 'pinch_zoom' && app.activeTouches.size === 2) {
    const touches = Array.from(app.activeTouches.values())
    const currentDistance = getDistance(touches[0], touches[1])

    if (app.initialPinchDistance === 0) {
      app.initialPinchDistance = currentDistance
      app.lastScale = app.mapRenderer.scale
      return
    }

    const scaleFactor = currentDistance / app.initialPinchDistance
    const newScale = app.lastScale * scaleFactor

    const centerX = (touches[0].x + touches[1].x) / 2
    const centerY = (touches[0].y + touches[1].y) / 2

    app.mapRenderer.zoom(null, centerX, centerY, newScale)
    console.log('Touch move - pinch-zoom')
  } else if (app.interactionType === 'marker_drag' && app.draggedMarkerId && app.activeTouches.size === 1) {
    const touch = Array.from(app.activeTouches.values())[0]

    const deltaX = touch.x - app.initialDownX
    const deltaY = touch.y - app.initialDownY

    const { mapDeltaX, mapDeltaY } = app.mapRenderer.screenVectorToMapVector(deltaX, deltaY)

    const currentMarkerMapX = app.dragStartMapX + mapDeltaX
    const currentMarkerMapY = app.dragStartMapY + mapDeltaY

    const markerIndex = app.markers.findIndex(m => m.id === app.draggedMarkerId)
    if (markerIndex !== -1) {
      app.markers[markerIndex].x = currentMarkerMapX
      app.markers[markerIndex].y = currentMarkerMapY
      app.mapRenderer.setMarkers(app.markers)
      app.mapRenderer.render()
    }
    console.log('Touch move - marker dragging')
  } else if (app.interactionType === 'map_pan' && app.activeTouches.size === 1) {
    const touch = Array.from(app.activeTouches.values())[0]

    const deltaX = touch.x - app.lastX
    const deltaY = touch.y - app.lastY
    app.mapRenderer.pan(deltaX, deltaY)
    app.lastX = touch.x
    app.lastY = touch.y
    console.log('Touch move - map panning')
  }
}

export async function handleMapTouchEnd (app, event) {
  if (!app.currentMap) return

  const currentInteractionType = app.interactionType
  const currentDraggedMarkerId = app.draggedMarkerId

  const endedTouch = event.changedTouches[0]
  const touchEndX = endedTouch ? endedTouch.clientX : 0
  const touchEndY = endedTouch ? endedTouch.clientY : 0

  const CLICK_THRESHOLD = 10

  let distanceMoved = Infinity
  if (endedTouch) {
    const initialTouchDataForEndedTouch = Array.from(app.activeTouches.values()).find(t => t.identifier === endedTouch.identifier) || { initialX: app.initialDownX, initialY: app.initialDownY }
    distanceMoved = Math.sqrt(
      Math.pow(endedTouch.clientX - initialTouchDataForEndedTouch.initialX, 2) +
      Math.pow(endedTouch.clientY - initialTouchDataForEndedTouch.initialY, 2)
    )
  }

  for (let i = 0; i < event.changedTouches.length; i++) {
    app.activeTouches.delete(event.changedTouches[i].identifier)
  }

  if (currentInteractionType === 'marker_drag' && currentDraggedMarkerId) {
    const markerToSave = app.markers.find(m => m.id === currentDraggedMarkerId)
    if (markerToSave) {
      if (distanceMoved < CLICK_THRESHOLD) {
        console.log('Marker tapped (via short touch drag):', markerToSave.id)
        MarkerPhotoManager.showMarkerDetails(app, markerToSave.id)
      } else {
        try {
          await app.storage.updateMarker(markerToSave.id, {
            x: markerToSave.x,
            y: markerToSave.y,
            lastModified: new Date()
          })
          console.log(`Marker ${markerToSave.id} position saved after touch drag.`)
          app.showNotification('Marker moved and saved.', 'success')
        } catch (error) {
          console.error('Failed to save dragged marker position:', error)
          app.showErrorMessage('Save Error', 'Failed to save marker position.')
        }
      }
    }
  } else if (currentInteractionType === 'map_pan') {
    if (distanceMoved < CLICK_THRESHOLD) {
      const clickedMarker = getMarkerAtPoint(app, touchEndX, touchEndY)
      if (clickedMarker) {
        console.log('Marker tapped (via short map pan interaction):', clickedMarker.id)
        MarkerPhotoManager.showMarkerDetails(app, clickedMarker.id)
      } else {
        console.log('Map or empty space tapped (via short map pan interaction).')
      }
    } else {
      console.log('Map pan ended.')
    }
  }

  if (app.activeTouches.size === 0) {
    app.interactionType = 'none'
    app.isDragging = false
    app.isDraggingMarker = false
    app.draggedMarkerId = null
    app.initialPinchDistance = 0
    app.lastScale = 1
    console.log('Interaction state reset.')
  } else if (app.activeTouches.size === 1 && currentInteractionType === 'pinch_zoom') {
    app.interactionType = 'map_pan'
    app.isDragging = true
    app.isDraggingMarker = false
    const remainingTouch = Array.from(app.activeTouches.values())[0]
    app.lastX = remainingTouch.x
    app.lastY = remainingTouch.y
    app.initialPinchDistance = 0
    app.lastScale = 1
    console.log('Switched from pinch_zoom to map_pan with remaining touch.')
  } else {
    app.isDragging = false
    app.isDraggingMarker = false
    app.draggedMarkerId = null
    app.initialPinchDistance = 0
    app.lastScale = 1
    console.log('Multi-touch interaction ongoing or unexpected state after a touch ended.')
  }
}

export function zoomIn (app) {
  if (app.mapRenderer && app.currentMap) {
    const centerX = app.mapRenderer.canvas.width / 2
    const centerY = app.mapRenderer.canvas.height / 2
    app.mapRenderer.zoom(1.2, centerX, centerY)
    console.log('Zoomed in')
    app.updateAppStatus('Zoomed in')
  } else {
    console.log('No map loaded for zoom')
    app.updateAppStatus('No map to zoom')
  }
}

export function zoomOut (app) {
  if (app.mapRenderer && app.currentMap) {
    const centerX = app.mapRenderer.canvas.width / 2
    const centerY = app.mapRenderer.canvas.height / 2
    app.mapRenderer.zoom(0.8, centerX, centerY)
    console.log('Zoomed out')
    app.updateAppStatus('Zoomed out')
  } else {
    console.log('No map loaded for zoom')
    app.updateAppStatus('No map to zoom')
  }
}

export function getDistance (touch1, touch2) {
  const dx = touch1.x - touch2.x
  const dy = touch1.y - touch2.y
  return Math.sqrt(dx * dx + dy * dy)
}

export function getMarkerAtPoint (app, clientX, clientY) {
  if (!app.mapRenderer || !app.markers || app.markers.length === 0) {
    return null
  }

  const canvasRect = app.mapRenderer.canvas.getBoundingClientRect()
  const screenX = clientX - canvasRect.left
  const screenY = clientY - canvasRect.top

  const currentMarkerSize = app.mapRenderer.getCurrentMarkerDisplaySize()
  const hitRadius = currentMarkerSize.radius + 5

  for (let i = app.markers.length - 1; i >= 0; i--) {
    const marker = app.markers[i]
    const markerScreenCoords = app.mapRenderer.mapToScreen(marker.x, marker.y)

    if (markerScreenCoords) {
      const dx = screenX - markerScreenCoords.x
      const dy = screenY - markerScreenCoords.y
      const distance = Math.sqrt(dx * dx + dy * dy)

      if (distance <= hitRadius) {
        return marker
      }
    }
  }
  return null
}
