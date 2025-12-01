# Phase 10: Export/Import Extraction

## Objective
Extract the export and import functionality (~350 lines) from `app.js` into static methods in the existing `js/MapDataExporterImporter.js` module. Update calls in `app.js` to delegate to these new static methods. Preserve all existing upload, export (JSON/HTML report), and import behaviors exactly.

**Expected reduction:** ~350 lines from `app.js`  
**Files to modify:** `js/app.js`, `js/MapDataExporterImporter.js`  
**New dependencies:** None (leverages existing `MapDataExporterImporter.js`)

## Prerequisites
- ✅ Phases 1-9 completed
- `js/MapDataExporterImporter.js` exists and has basic export/import logic
- All modals (upload, settings, etc.) refactored and functional
- `ImageProcessor`, `storage.js`, `ModalManager` accessible

## Functions to Extract from `app.js`
```
handleMapUpload(file)          // New map upload: process image → save → display
exportHtmlReport(mapId)        // Generate/download HTML report
exportJsonMap(mapId)           // Generate/download JSON map data
handleImportFile(file)         // Parse JSON → decision modal → save/replace
_saveImportedData(data)        // Helper: save imported maps/markers/photos
_deleteMapAndImportNew(...)    // Helper: delete existing → import new
_showImportDecisionModal(...)  // Helper: show replace/add modal
```

## Target Static Methods in `MapDataExporterImporter.js`
```
static async handleMapUpload(app, file)
static exportHtmlReport(app, mapId)
static exportJsonMap(app, mapId)
static async handleImportFile(app, file)
```
- Methods receive `app` instance for access to `storage`, `renderer`, `modalManager`, etc.
- Helpers become private static methods.
- `_showImportDecisionModal` → use existing `ModalManager` or extract to dedicated import modal.

## Step-by-Step Tasks

### 1. Analyze & Document Current Code (~30 min)
- [✅] Open `js/app.js` and search for: `handleMapUpload`, `exportHtmlReport`, `exportJsonMap`, `handleImportFile`, `_saveImportedData OR _deleteMapAndImportNew OR _showImportDecisionModal`
- [✅] Note line ranges, dependencies (e.g., `this.storage`, `ImageProcessor.processImage`)
- [✅] Open `js/MapDataExporterImporter.js` - review existing exports/imports
- [✅] List exact call sites in `app.js` (e.g., from upload modal callback)

### 2. Add Static Methods to `MapDataExporterImporter.js` (~60 min)
- [✅] Import necessary modules if needed (e.g., `ImageProcessor`, `storage.js`)
- [✅] Implement `static async handleMapUpload(app, file)`:
  - Copy logic from `app.handleMapUpload`
  - Replace `this.storage` → `app.storage`, `this.renderer` → `app.renderer`
  - Use `ImageProcessor.processImage(file)`
  - End with `app.switchToMap(newMapId)`
- [✅] Implement `static exportHtmlReport(app, mapId)` & `exportJsonMap(app, mapId)`
- [✅] Implement `static async handleImportFile(app, file)` + helpers
  - Decision modal: `app.modalManager.showImportDecision(...)` or new static modal creator

### 3. Refactor Calls in `app.js` (~45 min)
- [✅] Replace each function body with delegation:
  ```js
  // Old:
  async handleMapUpload(file) { ... 100+ lines ... }
  // New:
  async handleMapUpload(file) {
    await MapDataExporterImporter.handleMapUpload(this, file);
  }
  ```
- [✅] Remove helper functions (`_saveImportedData`, etc.)
- [✅] Add import: `import { MapDataExporterImporter } from './MapDataExporterImporter.js';`
- [✅] Verify no other references remain (grep search)

### 4. Handle Dependencies & Edge Cases (~30 min)
- [✅] Ensure access to `app.modalManager` for import decision modal
- [✅] If `_showImportDecisionModal` creates raw HTML → refactor to use `ModalManager.createImportDecisionModal`
- [✅] Blob handling: Reuse existing `ImageProcessor` for thumbs/full images
- [✅] Error handling: Preserve try/catch and user notifications

### 5. Testing Checklist (~45 min)
- [✅] **New Map Upload:** Upload image → compresses → saves → auto-switches/displays
- [✅] **Export JSON:** From settings/search → downloads valid JSON with Blobs as base64
- [✅] **Export HTML Report:** Generates self-contained HTML with images/markers
- [✅] **Import New Data:** Import JSON → adds new map(s) → shows in list
- [✅] **Import Replace:** Import matching mapId → shows decision → replaces markers/photos
- [✅] **Offline:** All operations work without network
- [✅] **Console:** No errors/warnings
- [✅] **Line count:** `app.js` reduced by ~350 lines (verify with editor)
- [✅] **No regressions:** Pan/zoom, markers, other modals, search unchanged

### 6. Validation & Cleanup
- [✅] Run full app smoke test (upload → marker → photo → export → import → report)
- [✅] Update `REFACTORING_PLAN.md`: Mark Phase 10 ✅
- [✅] Commit: "refactor(phase-10): extract export/import to MapDataExporterImporter.js"

## Potential Issues & Mitigations
| Issue | Mitigation |
|-------|------------|
| Modal creation in import | Extract to `ui/import-decision-modal.js` or `ModalManager` method |
| Private app methods | Pass `app` and use `app.method()` |
| Circular imports | None expected (static methods) |
| Blob size limits | Reuse existing compression |
| Existing MapDataExporterImporter logic duplication | Merge/override with new comprehensive methods |

## Estimated Time: 3-4 hours
## Next: Phase 11 after validation
