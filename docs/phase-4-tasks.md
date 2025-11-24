# SnapSpot PWA - Phase 4 Tasks: Move Settings Modal

## Objective
Move complete settings modal implementation (~600-800 lines from `js/ui/modals.js` + ~100-150 lines from `js/app.js`) to `js/ui/settings-modal.js`, preserving all functionality.

## Tasks

### 1. Analyze Current Settings Modal Code
- [x] Identify all settings modal methods in modals.js: `createSettingsModal`, tab switching logic, event listeners (sliders, checkboxes, buttons), helpers (`_generateRuleRowHtml`, etc.)
- [x] List dependencies: `UIRenderer`, app callbacks (`onMapSelected`, `onClearAllAppData`, `setPhotoQuality`, etc.), DOM elements, localStorage
- [x] Document shared state/vars: `mapsListDOMElement`, tab states, sliders (`imageQualitySlider`, `maxMarkersSlider`)

### 2. Move Functions to New Module
- [x] Move `createSettingsModal` (large HTML template + dynamic maps list generation ~lines 1800-2500)
- [x] Move inline logic: tab activation (`activateTab`), mobile dropdown, event listeners (sliders, checkboxes, import file, clear data, add new map)
- [x] Move helpers: `_generateRuleRowHtml`, custom marker rules rendering/listeners
- [ ] Document inline HTML/tabs (General, Behavior, Display, Processing, Data Mgmt, Maps Mgmt, Danger Zone)

### 3. Update New Module Implementation
- [x] Modify: `createSettingsModal(modalManager, callbacks, maps, activeMapId, onClose, initialTab)`; use passed `modalManager`, `UIRenderer`
- [x] Ensure access: callbacks for all actions (e.g., `callbacks.setPhotoQuality`), dynamic maps list via `UIRenderer.createCardElement`
- [x] Preserve: all tabs/sliders (quality, max markers, crosshair), custom rules, maps management, import, danger zone
- [x] Verify event handling, localStorage persistence, mobile tab selector

### 4. Update modals.js to Use New Module
- [x] Add `import { createSettingsModal } from './settings-modal.js';`
- [x] Replace: `ModalManager.createSettingsModal(...)` → delegate to imported func
- [x] Verify signatures/callbacks match; remove any moved helpers (`_generateRuleRowHtml`)

### 4b. Remove Deprecated Code from modals.js
- [x] Delete `createSettingsModal`, moved helpers/logic
- [x] Verify no references remain; lint/test modals.js

### 5. Update Callers
- [x] `app.js showSettings()`: unchanged (calls `this.modalManager.createSettingsModal`)
- [x] Verify callback integrations (e.g., `onMapSelected`, `setPhotoQuality`)

### 6. Verification and Testing
- [x] No errors; ~600-800 line reduction modals.js + ~100-150 app.js
- [x] All tabs work: General (notifications), Behavior (auto-close, duplicates), Display (crosshair, max markers, custom rules), Processing (quality slider), Data Mgmt (import), Maps Mgmt (list/delete/export/add), Danger Zone (clear all)
- [x] Mobile: tab dropdown, touch interactions
- [x] Custom rules: rendering, persistence, application
- [x] No regressions: other modals (marker-details, gallery, etc.)
- [x] Offline: settings load/save works
- [x] Console: no errors; exact behavior

## Expected Outcome
- Settings functionality in `js/ui/settings-modal.js`
- modals.js reduced ~600-800 lines
- app.js reduced ~100-150 lines
- All settings features preserved