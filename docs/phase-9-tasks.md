# SnapSpot PWA - Phase 9 Tasks: Move Image Gallery Modal

## Objective
Move photo gallery modal implementation (`createPhotoGalleryModal`, `setupPhotoGalleryModal`) from `js/ui/modals.js` to new `js/ui/photo-gallery-modal.js` (~400-600 lines reduction), preserving all functionality.

## Tasks

### 1. Analyze Current Gallery Code
- [✅] Identify methods in modals.js: `createPhotoGalleryModal`, `setupPhotoGalleryModal`, helpers (`setupGalleryPhotoClickHandlers`, `updateGalleryDisplay`)
- [✅] Identify callers: From marker details (`app-marker-photo-manager.js`), search results (`app-search.js`), settings/UI lists
- [✅] List dependencies: `modalManager`, `UIRenderer`, photo ObjectURLs, callbacks (`onShowOnMap`, `onDeletePhoto`, `onClose`)
- [✅] Document: List/single view toggle, pagination, lightbox, delete/share actions

### 2. Create/Prepare New Module
- [✅] Create `js/ui/photo-gallery-modal.js` (export `createPhotoGalleryModal(modalManager, photos, callbacks)`)
- [✅] Design API: Pass `modalManager`, `photos[]`, `callbacks` (onShowOnMap, onDeletePhoto, onClose); generate ObjectURLs internally

### 3. Move Functions to New Module
- [✅] Move `createPhotoGalleryModal`: HTML template (list/single views, pagination)
- [✅] Move `setupPhotoGalleryModal`: Event handlers, view toggle, lightbox, pagination logic
- [✅] Move helpers: `setupGalleryPhotoClickHandlers`, `updateGalleryDisplay`

### 4. Update New Module Implementation
- [✅] Adapt: Standalone func; preserve ObjectURL cleanup, async photo loading, mobile pagination
- [✅] Ensure: List/single view switch, photo delete (confirm+storage), show-on-map callback

### 5. Update modals.js to Use New Module
- [✅] Add import: `import { createPhotoGalleryModal } from './photo-gallery-modal.js';`
- [✅] Replace: `this.createPhotoGalleryModal(...)` → `createPhotoGalleryModal(this.modalManager, ...)`
- [✅] Remove moved methods/helpers; lint/test

### 6. Update Callers/Integrations
- [✅] `app-marker-photo-manager.js`, `app-search.js`: Update calls to new standalone func (pass `app.modalManager`)
- [✅] Verify: No direct DOM/event access remains in modals.js gallery paths

### 7. Verification and Testing
- [✅] No errors; ~400-600 line reduction in modals.js
- [✅] Gallery: Opens from markers/search, list/single/pagination works, delete/show-on-map, lightbox zoom
- [✅] Mobile/offline: Photo loading, ObjectURL cleanup
- [✅] No regressions: Other modals, photo ops
- [✅] Console: No errors; exact behavior

## Expected Outcome
- Photo gallery in `js/ui/photo-gallery-modal.js`
- modals.js reduced ~400-600 lines
- All gallery features preserved