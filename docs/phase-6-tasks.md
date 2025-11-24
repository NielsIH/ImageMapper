# SnapSpot PWA - Phase 6 Tasks: Move Marker and Photo Management

## Objective
Move combined marker and photo management functionality (~700-900 lines from `js/app.js`) to `js/app-marker-photo-manager.js`, preserving all functionality.

## Tasks

### 1. Analyze Current Marker/Photo Management Code
- [x] Identify all marker/photo methods in app.js: `placeMarker`, `getMarkerAtPoint`, marker dragging (`handleMapMouseDown` etc. if not moved), photo upload/add/delete/view/gallery ops
- [ ] List dependencies: `this.mapRenderer`, `this.storage`, `this.modalManager`, `this.imageProcessor`, state (`this.markers`, `this.currentMap`, `this.selectedMarker`)
- [ ] Document shared state/vars: `draggingMarker`, `photoUploadInProgress`, thumbnail caches, marker lists

### 2. Create/Prepare New Module
- [x] Ensure `js/app-marker-photo-manager.js` exists (stub if needed)
- [x] Design API: Class `MarkerPhotoManager` or exported functions taking `app` (or specific deps: renderer, storage, modalManager, imageProcessor)

### 3. Move Functions to New Module
- [x] Move `placeMarker`: Create marker, add to storage, refresh renderer
- [x] Move `getMarkerAtPoint`: Hit detection on canvas
- [x] Move marker dragging logic (if separate from interactions)
- [x] Move all photo ops: `addPhotosToMarker`, photo upload/validation/compress/save, deletePhotoFromMarker, showPhotoGallery etc.

### 4. Update New Module Implementation
- [x] Adapt: Pass `app` or deps; use callbacks/promises for state updates (e.g. `onMarkersChanged`)
- [x] Preserve: Async ops, error handling, confirm dialogs, thumbnail gen/caching, gallery integration
- [x] Ensure: Mobile/touch photo handling, offline storage

### 5. Update app.js to Use New Module
- [ ] Add `import { MarkerPhotoManager } from './app-marker-photo-manager.js';` (or funcs)
- [ ] Instantiate: `this.markerPhotoManager = new MarkerPhotoManager(this.mapRenderer, this.storage, ...)`
- [ ] Replace calls: Delegate to manager (e.g. `this.markerPhotoManager.placeMarker()`)
- [ ] Remove moved methods; lint/test app.js

### 6. Update Callers/Integrations
- [ ] Map interactions: Update to use manager for place/getMarker
- [ ] Modals: Ensure callbacks route through app to manager
- [ ] Verify no direct storage/renderer access remains

### 7. Verification and Testing
- [ ] No errors; ~700-900 line reduction app.js
- [ ] Marker ops: place/drag/select/edit/delete work
- [ ] Photo ops: upload/add/delete/view/gallery/fullscreen, thumbnails/fallbacks
- [ ] Mobile: touch place/add photos
- [ ] No regressions: search/export/import, other modals
- [ ] Offline: all ops persist/retrieve correctly
- [ ] Console: no errors; exact behavior

## Expected Outcome
- Marker/photo functionality in `js/app-marker-photo-manager.js`
- app.js reduced ~700-900 lines
- All marker/photo features preserved