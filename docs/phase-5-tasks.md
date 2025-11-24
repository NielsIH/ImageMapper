# SnapSpot PWA - Phase 5 Tasks: Move Marker Details Modal

## Objective
Move complete marker details modal implementation (~500-700 lines from `js/ui/modals.js`) to `js/ui/marker-details-modal.js`, preserving all functionality.

## Tasks

### 1. Analyze Current Marker Details Modal Code
- [ ] Identify all marker details methods in modals.js: `createMarkerDetailsModal`, `updateMarkerDetailsDescription`
- [ ] List dependencies: app callbacks (`onAddPhotos`, `onEditMarker`, `onSaveDescription`, `onDeleteMarker`, `onDeletePhoto`, `onViewPhoto`), DOM elements
- [ ] Document shared state/vars: photo thumbnails, edit mode toggles, description display/edit

### 2. Move Functions to New Module
- [ ] Move `createMarkerDetailsModal` (HTML template + photo thumbnails ~lines 500-1000)
- [ ] Move `updateMarkerDetailsDescription` (description update helper)
- [ ] Move inline logic: edit mode toggle, photo delete/view listeners, button handlers

### 3. Update New Module Implementation
- [ ] Modify: `createMarkerDetailsModal(markerDetails, onAddPhotos, onEditMarker, onSaveDescription, onDeleteMarker, onDeletePhoto, onViewPhoto, onClose)`; use passed `modalManager`
- [ ] Ensure access: callbacks for all actions, photo thumbnail loading with fallback (full→thumb)
- [ ] Preserve: description edit, photo list/delete/view, add photos button, mobile support
- [ ] Verify object URL tracking for thumbnails, edit mode UI toggle

### 4. Update modals.js to Use New Module
- [ ] Add `import { createMarkerDetailsModal, updateMarkerDetailsDescription } from './marker-details-modal.js';`
- [ ] Replace: `ModalManager.createMarkerDetailsModal(...)` → delegate to imported func
- [ ] Replace: `ModalManager.updateMarkerDetailsDescription(...)` → delegate
- [ ] Verify signatures/callbacks match

### 4b. Remove Deprecated Code from modals.js
- [ ] Delete `createMarkerDetailsModal`, `updateMarkerDetailsDescription`, moved logic
- [ ] Verify no references remain; lint/test modals.js

### 5. Update Callers
- [ ] `app.js showMarkerDetails()`: unchanged (calls `this.modalManager.createMarkerDetailsModal`)
- [ ] Verify callback integrations (e.g., `onSaveDescription`, `onViewPhoto`)

### 6. Verification and Testing
- [ ] No errors; ~500-700 line reduction modals.js
- [ ] Marker details modal works: description edit/save, photo thumbnails/delete/view/add, edit mode toggle
- [ ] Photo viewer/gallery integration from thumbnails
- [ ] Mobile: touch interactions, thumbnail loading
- [ ] No regressions: other modals (settings, upload, etc.)
- [ ] Offline: modal load/display works
- [ ] Console: no errors; exact behavior

## Expected Outcome
- Marker details functionality in `js/ui/marker-details-modal.js`
- modals.js reduced ~500-700 lines
- All marker details features preserved