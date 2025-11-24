# SnapSpot PWA - Refactoring Plan

## Objective
Reduce the size of the large `app.js` (2,941 lines) and `modals.js` (2,434 lines) files by moving the largest, most complex functionality to separate modules while preserving all existing functionality. Focus only on the biggest chunks that will make the most impact.

## Approach
We will move functionality in distinct phases, with each phase focusing on one major area of functionality. After each phase, we will test to ensure functionality remains intact before proceeding to the next phase.

## Phase 1: Infrastructure Setup
- Create necessary module files with proper import/export syntax
- No functionality moved yet
- Verify all files exist and app still works as before

## Phase 2: Move Map Interaction System
**Files to modify:** app.js
**Functionality to move:** All mouse, touch, zoom, pan, rotation functionality (largest single chunk)
- `handleMapMouseDown`, `handleMapMouseMove`, `handleMapMouseUp`, `handleMapWheel`
- `handleMapTouchStart`, `handleMapTouchMove`, `handleMapTouchEnd`
- `zoomIn`, `zoomOut`, `getDistance`, pan and rotation logic
**Expected reduction:** ~400-500 lines from app.js
**Test:** All map interactions (pan, zoom, rotate) continue to work exactly as before

## Phase 3: Move Upload Modal
**Files to modify:** modals.js
**Functionality to move:** Complete upload modal implementation (large complex modal)
- `createUploadModal`, `setupUploadModal`, file handling logic, validation, UI rendering
**Expected reduction:** ~600-800 lines from modals.js
**Test:** Upload modal functions exactly as before

## Phase 4: Move Settings Modal
**Files to modify:** modals.js and app.js
**Functionality to move:** Complete settings modal implementation (very large complex modal)
- `createSettingsModal`, tab navigation, map management in settings, UI rendering
**Expected reduction:** ~600-800 lines from modals.js + ~100-150 lines from app.js
**Test:** Settings modal works exactly as before

## Phase 5: Move Marker Details Modal
**Files to modify:** modals.js
**Functionality to move:** Complete marker details modal implementation (large complex modal)
- `updateMarkerDetailsDescription`, edit functionality, photo management in modal, UI rendering
**Expected reduction:** ~500-700 lines from modals.js
**Test:** Marker details modal works exactly as before

## Phase 6: Move Marker and Photo Management
**Files to modify:** app.js
**Functionality to move:** Combined marker and photo management functionality (substantial code)
- `placeMarker`, `getMarkerAtPoint`, marker dragging logic, photo operations
- All photo handling functionality: upload, gallery, deletion
**Expected reduction:** ~700-900 lines from app.js
**Test:** All marker and photo operations work exactly as before

## Phase 7: Move Search Functionality
**Files to modify:** app.js and modals.js
**Functionality to move:** Search operations and search modal (significant functionality)
- `searchMaps`, `searchPhotos`, `handleSearchFileSelection`, `onShowPhotoOnMap`, `createSearchModal`
**Expected reduction:** ~300-400 lines from app.js + ~200-300 lines from modals.js
**Test:** All search operations work exactly as before

## Phase 8: Move Settings Orchestration ✅
**Files to modify:** app.js
**Functionality to move:** Settings orchestration (`showSettings`), data prep (`_getPreparedMapsForDisplay`), settings callbacks (`get/setPhotoQuality`, `get/setAutoCloseMarkerDetails`, etc.)
- Extract to `js/app-settings.js`: `showSettings(app, initialTab)`, shared thumbnail prep util.
- Inline thumbs logic or move to `imageProcessor.js`.
- Update `app.js`: Delegate `showSettings` call.
**Expected reduction:** ~400-500 lines from app.js
**Test:** Settings modal opens, all tabs/callbacks (maps mgmt, prefs, import/export) work identically; no regressions in exports/imports.

## Phase 9: Move Image Gallery Modal
**Files to modify:** modals.js
**Functionality to move:** Complete photo gallery modal (`createPhotoGalleryModal`, `setupPhotoGalleryModal`, photo grid/lightbox/delete/share).
**New file:** js/ui/photo-gallery-modal.js → `createPhotoGalleryModal(modalManager, photos, callbacks)`
**Expected reduction:** ~400-600 lines from modals.js
**Test:** Gallery opens from markers/search/settings, photo view/delete/show-on-map works identically.

## Modules to Create:
- js/app-map-interactions.js - Map interactions
- js/app-marker-photo-manager.js - Marker and photo management
- js/app-search.js - Search functionality
- js/app-settings.js - Settings orchestration ✅
- js/ui/photo-gallery-modal.js - Photo gallery modal
- js/ui/upload-modal.js - Upload modal
- js/ui/settings-modal.js - Settings modal
- js/ui/marker-details-modal.js - Marker details modal

## Total Expected Reduction (Phases 1-9):
- app.js: From ~2,941 lines → ~1,000-1,300 lines (~55-65% reduction)
- modals.js: From ~2,434 lines → ~300-600 lines (~75-85% reduction)

## Testing Approach
After each phase:
1. Verify the moved functionality works exactly as before
2. Verify no regressions in other areas
3. Test in both online and offline modes
4. Check console for any errors
5. Perform basic operations to ensure nothing is broken