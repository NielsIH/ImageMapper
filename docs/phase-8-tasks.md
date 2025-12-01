# SnapSpot PWA - Phase 8 Tasks: Move Settings Orchestration

## Objective
Move settings orchestration (`showSettings`), data prep (`_getPreparedMapsForDisplay`), and settings callbacks (`get/setPhotoQuality`, `get/setAutoCloseMarkerDetails`, etc.) from `js/app.js` to new `js/app-settings.js` (~400-500 lines reduction), preserving all functionality.

## Tasks

### 1. Analyze Current Settings Code
- [x] Identify methods in app.js: `showSettings`, `_getPreparedMapsForDisplay`, all `get/set*` callbacks (photo quality, auto-close, duplicates, max markers, notifications, custom rules)
- [x] Identify callers: Button listeners (`setupButtonListeners`), import/export integrations
- [x] List dependencies: `app.storage`, `app.mapsList`, `app.imageProcessor`, `app.thumbnailCache`, `app.modalManager`, `app.currentMap`
- [x] Document shared: Thumbs prep (used in search/settings), callbacks passed to `createSettingsModal`

### 2. Create/Prepare New Module
- [x] Create `js/app-settings.js` (stub functions: `showSettings(app, initialTab)`, `getPreparedMapsForDisplay(app, rawMaps)`, exported getters/setters)
- [x] Design API: Pass `app`; return promises/callbacks; extract shared thumbs to util if needed

### 3. Move Functions to New Module
- [x] Move `showSettings`: Maps prep, callbacks object, modal delegation
- [x] Move `_getPreparedMapsForDisplay`: Thumbnail prep util (make public/exported)
- [x] Move callbacks: `getPhotoQuality`, `setPhotoQuality`, `getAutoCloseMarkerDetails`, `setAutoCloseMarkerDetails`, `getAllowDuplicatePhotos`, `setAllowDuplicatePhotos`, `getMaxMarkersToShow`, `setMaxMarkersToShow`, `getNotificationsEnabled`, `setNotificationsEnabled`, custom rules (`getCustomMarkerColorRules`, `setCustomMarkerColorRules`, etc.)

### 4. Update New Module Implementation
- [x] Adapt: Pass `app`; preserve async thumbs/IndexedDB, callback structure
- [x] Extract shared: Move thumbs logic to `imageProcessor.prepareMapsForDisplay(rawMaps, app.thumbnailCache, app.imageCompressionSettings)`
- [x] Ensure: Settings tabs (maps mgmt, prefs, custom colors) work; offline thumbs/caching

### 5. Update app.js to Use New Module
- [x] Add import: `import { showSettings, getPreparedMapsForDisplay, ...getters/setters... } from './app-settings.js';`
- [x] Replace: `this.showSettings()` → `showSettings(this)`
- [x] Update button: `btn-settings` → `showSettings(this)`
- [x] Remove moved methods; lint/test

### 6. Update Callers/Integrations (searchManager.js, modals.js, etc.)
- [x] If thumbs used elsewhere: Delegate to new util or `imageProcessor`
- [x] Verify: No direct storage/imageProcessor access remains in app.js settings paths
- [x] settings-modal.js: Unchanged (uses callbacks)

### 7. Verification and Testing
- [x] No errors; ~400-500 line reduction in app.js
- [x] Settings: All tabs (general/maps/data/custom), prefs save/load, maps mgmt (delete/export/import), custom rules apply to map
- [x] Mobile/offline: Settings work, thumbs generate
- [x] No regressions: Search thumbs (if shared), exports/imports, other modals
- [x] Console: No errors; exact behavior

## Expected Outcome
- Settings orchestration in `js/app-settings.js`
- app.js reduced ~400-500 lines
- All settings features preserved; thumbs util shared if applicable