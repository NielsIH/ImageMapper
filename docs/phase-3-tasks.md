# SnapSpot PWA - Phase 3 Tasks: Move Upload Modal

## Objective
Move complete upload modal implementation (~600-800 lines) from `js/ui/modals.js` to `js/ui/upload-modal.js`, preserving functionality.

## Tasks

### 1. Analyze Current Upload Modal Code
- [x] Identify all upload modal methods in modals.js: `createUploadModal`, `setupUploadModal`, helpers (`updateFilePreview`, `showDetailsStep`, `showSelectionStep`, `showError`, `showLoading`, `hideLoading`, `addManualStrategyButtons`)
- [x] List dependencies: `FileManager`, `UIRenderer`, DOM elements, callbacks (`onUpload`, `onCancel`)
- [x] Document shared state/vars: `selectedFile`, `processedData`

### 2. Move Functions to New Module
- [x] Move `createUploadModal` (~lines 50-200)
- [x] Move `setupUploadModal` (~200-500, file handling/validation)
- [x] Move helpers: `updateFilePreview`, `showDetailsStep`/`showSelectionStep`, `showError`/`showLoading`/`hideLoading`, `addManualStrategyButtons`
- [x] Document inline HTML/logic for upload steps

### 3. Update New Module Implementation
- [x] Modify: `createUploadModal(modalManager, onUpload, onCancel)` etc.; use passed `modalManager`/`fileManager`
- [x] Ensure access: `modalManager.showError(modal, msg)`, `new FileManager()`
- [x] Preserve debug/mobile handling, drag-drop, form validation
- [x] Verify error handling, object URLs

### 4. Update modals.js to Use New Module
- [x] Add `import { createUploadModal, setupUploadModal } from './upload-modal.js';`
- [x] Replace: `ModalManager.createUploadModal(...)` → delegate to imported funcs
- [x] Verify signatures/callbacks match

### 4b. Remove Deprecated Code from modals.js
- [x] Delete `createUploadModal`, `setupUploadModal`, and all moved helpers (`updateFilePreview`, `showDetailsStep`/`showSelectionStep`, `showError`/`showLoading`/`hideLoading`, `addManualStrategyButtons`)
- [x] Verify no references remain; lint/test modals.js

### 5. Update Callers
- [x] `app.js showUploadModal()`: unchanged (calls `this.modalManager.createUploadModal`)
- [x] Verify `FileManager.processFileUpload` integration

### 6. Verification and Testing
- [x] No errors; ~600-800 line reduction modals.js
- [x] Upload flow: file select/drop → preview/details → create (active/non-active)
- [x] Mobile/debug: picker strategies, validation, errors
- [x] No regressions: other modals (`settings`, `marker-details`)
- [x] Offline: file handling works
- [x] Console: no errors; exact behavior

## Expected Outcome
- Upload functionality in `js/ui/upload-modal.js`
- modals.js reduced ~600-800 lines
- All upload features preserved