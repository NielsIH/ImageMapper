# SnapSpot PWA - Phase 5 Tasks: Move Marker Details Modal

## Objective
Move complete marker details modal implementation (~500-700 lines from `js/ui/modals.js`) to `js/ui/marker-details-modal.js`, preserving all functionality.

## Tasks

### 1. Analyze Current Marker Details Modal Code
- [x] Identify all marker details methods in modals.js: `createMarkerDetailsModal`, `updateMarkerDetailsDescription`
- [x] List dependencies: app callbacks (`onAddPhotos`, `onEditMarker`, `onSaveDescription`, `onDeleteMarker`, `onDeletePhoto`, `onViewPhoto`), DOM elements
- [x] Document shared state/vars: photo thumbnails, edit mode toggles, description display/edit

### 2. Move Functions to New Module
- [x] Move `createMarkerDetailsModal` (HTML template + photo thumbnails ~lines 500-1000)
- [x] Move `updateMarkerDetailsDescription` (description update helper)
- [x] Move inline logic: edit mode toggle, photo delete/view listeners, button handlers

### 3. Update New Module Implementation
- [x] Modify: `createMarkerDetailsModal(markerDetails, onAddPhotos, onEditMarker, onSaveDescription, onDeleteMarker, onDeletePhoto, onViewPhoto, onClose)`; use passed `modalManager`
- [x] Ensure access: callbacks for all actions, photo thumbnail loading with fallback (full→thumb)
- [x] Preserve: description edit, photo list/delete/view, add photos button, mobile support
- [x] Verify object URL tracking for thumbnails, edit mode UI toggle

### 4. Update modals.js to Use New Module
- [x] Add `import { createMarkerDetailsModal, updateMarkerDetailsDescription } from './marker-details-modal.js';`
- [x] Replace: `ModalManager.createMarkerDetailsModal(...)` → delegate to imported func
- [x] Replace: `ModalManager.updateMarkerDetailsDescription(...)` → delegate
- [x] Verify signatures/callbacks match

### 4b. Remove Deprecated Code from modals.js
- [x] Delete `createMarkerDetailsModal`, `updateMarkerDetailsDescription`, moved logic
- [x] Verify no references remain; lint/test modals.js

### 5. Update Callers
- [x] `app.js showMarkerDetails()`: unchanged (calls `this.modalManager.createMarkerDetailsModal`)
- [x] Verify callback integrations (e.g., `onSaveDescription`, `onViewPhoto`)

### 6. Verification and Testing
- [x] No errors; ~500-700 line reduction modals.js
- [x] Marker details modal works: description edit/save, photo thumbnails/delete/view/add, edit mode toggle
- [x] Photo viewer/gallery integration from thumbnails
- [x] Mobile: touch interactions, thumbnail loading
- [x] No regressions: other modals (settings, upload, etc.)
- [x] Offline: modal load/display works
- [x] Console: no errors; exact behavior

## Expected Outcome
- [x] Marker details functionality in `js/ui/marker-details-modal.js`
- [x] modals.js reduced ~500-700 lines
- [x] All marker details features preserved