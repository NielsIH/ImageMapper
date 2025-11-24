# SnapSpot PWA - Phase 7 Tasks: Move Search Functionality (Altered Design)

## Objective
Move search data operations (`searchMaps`, `searchPhotos`, `handleSearchFileSelection`, `onShowPhotoOnMap`) to `js/app-search.js` and search modal UI (`createSearchModal`) to new `js/ui/search-modal.js` (~300-400 lines from `js/app.js` + ~200-300 lines from `js/ui/modals.js`), preserving all functionality.

## Tasks

### 1. Analyze Current Search Code
- [x] Identify all search methods in app.js: `searchMaps`, `searchPhotos`, `handleSearchFileSelection`, `onShowPhotoOnMap`
- [x] Identify search modal in modals.js: `createSearchModal`
- [x] List dependencies: `this.storage`, `this.modalManager`, `this.imageProcessor`, `this.thumbnailCache`, `app.fileManager`, `app.searchManager`, `app.mapRenderer`, etc.
- [x] Document shared vars/callbacks: search callbacks in `SearchManager`

### 2. Create/Prepare New Module
- [x] Ensure `js/app-search.js` exists (stub data functions: `searchMaps(app, query)`, `searchPhotos(app, query)`, `handleSearchFileSelection(app)`, `onShowPhotoOnMap(app, photoData)`)
- [x] Create `js/ui/search-modal.js` (stub `createSearchModal(modalManager, callbacks, onClose, initialQuery)`)
- [x] Design API: `app-search.js` for data ops (pass `app`); `search-modal.js` for UI (pass `modalManager`, `callbacks`, etc.)

### 3. Move Functions to New Module
- [x] Move `searchMaps`, `searchPhotos`, `handleSearchFileSelection`, `onShowPhotoOnMap` from `app.js` to `app-search.js`
- [x] Move `createSearchModal` from `modals.js` to `ui/search-modal.js`

### 4. Update New Module Implementation
- [x] Adapt: Pass `app`/`modalManager`; inline thumbnail prep; async preserved
- [x] Preserve: Async IndexedDB queries, thumbnail gen/caching, result rendering
- [x] Ensure: Offline search (no pagination in impl)

### 5. Update app.js to Use New Module
- [ ] Add import: `import { searchMaps, searchPhotos, handleSearchFileSelection, onShowPhotoOnMap } from './app-search.js';`
- [ ] Replace calls: e.g. `this.searchMaps(query)` → `searchMaps(this, query)`
- [ ] Update `SearchManager` callbacks to delegate to new functions
- [ ] Remove moved methods; lint/test

### 6. Update Callers/Integrations (modals.js, searchManager.js)
- [ ] `modals.js`: Remove `createSearchModal`; update `ModalManager` to import/delegate to `ui/search-modal.js`
- [ ] `searchManager.js`: No change (uses `modalManager.createSearchModal`)
- [ ] Verify no direct storage access remains in moved code

### 7. Verification and Testing
- [ ] No errors; ~500-700 line reduction (app.js + modals.js)
- [ ] Search: Maps/photos by text/file, results display, show-on-map
- [ ] Mobile/offline: Search works
- [ ] No regressions: Markers/photos/export/import/other modals
- [ ] Console: No errors; exact behavior

## Expected Outcome
- Search data ops in `js/app-search.js`; search modal UI in `js/ui/search-modal.js`
- app.js/modals.js reduced ~500-700 lines total
- All search features preserved