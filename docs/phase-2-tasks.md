# SnapSpot PWA - Phase 2 Tasks: Move Map Interaction System

## Objective
Move all map interaction functionality (mouse, touch, zoom, pan, rotation) from app.js to app-map-interactions.js, while preserving all existing functionality.

## Tasks

### 1. Analyze Current Map Interaction Code
- [x] Identify all map interaction methods in app.js
- [x] List dependencies and app context these functions use
- [x] Document any shared state or variables these functions access

### 2. Move Functions to New Module (~lines 1075-1800 app.js)
- [x] Move `handleMapMouseDown` (~1480)
- [x] Move `handleMapMouseMove` (~1530)
- [x] Move `handleMapMouseUp` (~1550, async save)
- [x] Move `handleMapWheel` (~1350)
- [x] Move `handleMapTouchStart` (~1400)
- [x] Move `handleMapTouchMove` (~1450)
- [x] Move `handleMapTouchEnd` (~1550, async save)
- [x] Move `zoomIn` (~1075)
- [x] Move `zoomOut` (~1092)
- [x] Move `getDistance` (~1650, pinch helper)
- [x] Move `getMarkerAtPoint` (~1150, hit detect/dynamic size)
- [x] Document drag state vars (~80-120,1500s: `isDragging*`, `interactionType`, `draggedMarkerId`, `lastX/Y`, `initialPinchDistance` etc.) - hoist to module or pass `app` (mutated via app param)
- [x] Move any pan/rotation helpers

### 3. Update New Module Implementation
- [x] Modify stubs: `handleXXX(app, e)` etc.; replace `this.*` → `app.*` (e.g. `app.mapRenderer.pan()`, `await app.storage.updateMarker`)
- [x] Handle drag state: mutate `app.markers`/`app.isDragging*` in-place via `app`; preserve async `app.saveMarker`
- [x] Support pinch transitions/dynamic `interactionType`
- [x] Verify error handling, `getMarkerAtPoint` uses `app.mapRenderer.getCurrentMarkerDisplaySize()`

### 4. Update app.js to Use New Module
- [x] Add `import * as MapInteractions from './app-map-interactions.js';` (~top imports)
- [x] Replace methods: e.g. `handleMapMouseDown(event) { MapInteractions.handleMapMouseDown(this, event); }`
- [x] Remove moved state init vars if hoisted to module; verify signatures (state mutated via app)

### 5. Update Event Listeners (~line 313+)
- [x] `setupMapInteractionListeners`: retain `this.handleXXX.bind(this)` on `#map-container`
- [x] `setupButtonListeners` (~242): zoomIn/Out → wrappers
- [x] `setupKeyboardShortcuts` (~296): +/- → `this.zoomIn/Out()`
- [x] Verify `app` context via wrappers

### 6. Verification and Testing
- [x] No compile/errors; ~343 line reduction app.js (net -328)
- [x] Pan/drag (mouse/touch), zoom (wheel/pinch/button/keyboard), rotate
- [x] Marker tap→details, drag→save (locked/unlocked), `getMarkerAtPoint` dynamic size
- [x] Pinch→pan transitions, async saves, offline
- [x] No regressions: placeMarker, showMarkerDetails etc.
- [x] Console: no errors; exact pre-move behavior

## Expected Outcome
- Map interaction functionality moved to app-map-interactions.js module
- app.js reduced by ~400-500 lines
- All map interaction functionality preserved and working exactly as before
- Event handling continues to work properly