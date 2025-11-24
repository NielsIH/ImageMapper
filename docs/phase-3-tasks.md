# SnapSpot PWA - Phase 3 Tasks: Move Upload Modal

## Objective
Move complete upload modal implementation (~600-800 lines) from `js/ui/modals.js` to `js/ui/upload-modal.js`, preserving functionality.

## Tasks

### 1. Analyze Current Upload Modal Code
- [ ] Identify all upload modal methods in modals.js: `createUploadModal`, `setupUploadModal`, helpers (`updateFilePreview`, `showDetailsStep`, `showSelectionStep`, `showError`, `showLoading`, `hideLoading`, `addManualStrategyButtons`)
- [ ] List dependencies: `FileManager`, `UIRenderer`, DOM elements, callbacks (`onUpload`, `onCancel`)
- [ ] Document shared state/vars: `selectedFile`, `processedData`

### 2. Move Functions to New Module
- [ ] Move `createUploadModal` (~lines 50-200)
- [ ] Move `setupUploadModal` (~200-500, file handling/validation)
- [ ] Move helpers: `updateFilePreview`, `showDetailsStep`/`showSelectionStep`, `showError`/`showLoading`/`hideLoading`, `addManualStrategyButtons`
- [ ] Document inline HTML/logic for upload steps

### 3. Update New Module Implementation
- [ ] Modify: `createUploadModal(modalManager, onUpload, onCancel)` etc.; use passed `modalManager`/`fileManager`
- [ ] Ensure access: `modalManager.showError(modal, msg)`, `new FileManager()`
- [ ] Preserve debug/mobile handling, drag-drop, form validation
- [ ] Verify error handling, object URLs

### 4. Update modals.js to Use New Module
- [ ] Add `import { createUploadModal, setupUploadModal } from './upload-modal.js';`
- [ ] Replace: `ModalManager.createUploadModal(...)` → delegate to imported funcs
- [ ] Verify signatures/callbacks match

### 5. Update Callers
- [ ] `app.js showUploadModal()`: unchanged (calls `this.modalManager.createUploadModal`)
- [ ] Verify `FileManager.processFileUpload` integration

### 6. Verification and Testing
- [ ] No errors; ~600-800 line reduction modals.js
- [ ] Upload flow: file select/drop → preview/details → create (active/non-active)
- [ ] Mobile/debug: picker strategies, validation, errors
- [ ] No regressions: other modals (`settings`, `marker-details`)
- [ ] Offline: file handling works
- [ ] Console: no errors; exact behavior

## Expected Outcome
- Upload functionality in `js/ui/upload-modal.js`
- modals.js reduced ~600-800 lines
- All upload features preserved