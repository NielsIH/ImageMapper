# Phase 11: Storage/Display Extraction

## Objective
Move storage and display related functionality from `app.js` to a new module `js/app-storage-manager.js` to further reduce the size of `app.js` by approximately 250 lines (~15% reduction).

## Tasks

### - [ ] 1. Create `js/app-storage-manager.js`
Create a new module file `js/app-storage-manager.js` that exports a `StorageManager` class or object with the following static methods:
- `initialize(app)`: Handle storage initialization logic (equivalent to `initializeStorage` in app.js).
- `loadMaps(app)`: Load all maps from storage (equivalent to `loadMaps` in app.js).
- `displayMap(app, mapData)`: Display a specific map (equivalent to `displayMap` in app.js).
- `switchToMap(app, mapId)`: Switch to a different map (equivalent to `switchToMap` in app.js).
- `checkWelcomeScreen(app)`: Check and show welcome screen if no maps exist (equivalent to `checkWelcomeScreen` in app.js).
- `getCurrentMapInfo(app)`: Get information about the current map (equivalent to `getCurrentMapInfo` in app.js).

### - [ ] 2. Move Functionality from `app.js`
Move the implementation of the following methods from `SnapSpotApp` class in `app.js` to the corresponding methods in `app-storage-manager.js`:
- `initializeStorage` → `StorageManager.initialize`
- `loadMaps` → `StorageManager.loadMaps`
- `displayMap` → `StorageManager.displayMap`
- `switchToMap` → `StorageManager.switchToMap`
- `checkWelcomeScreen` → `StorageManager.checkWelcomeScreen`
- `getCurrentMapInfo` → `StorageManager.getCurrentMapInfo`

Ensure all dependencies (e.g., `MapStorage`, `MapRenderer`, `ModalManager`) are properly imported in the new module.

### - [ ] 3. Update `app.js`
- Import `StorageManager` from `./app-storage-manager.js`.
- Replace direct method calls with delegations to `StorageManager` methods, passing `this` (the app instance) as the first parameter.
- Remove the moved method implementations from `SnapSpotApp` class.
- Update any references to these methods within `app.js` to use the new delegated calls.

### - [ ] 4. Testing
After implementation:
- [ ] 1. Verify the app initializes correctly and connects to IndexedDB.
- [ ] 2. Test loading maps: Ensure all maps are loaded and displayed in the UI.
- [ ] 3. Test displaying a map: Select a map and confirm it renders with markers.
- [ ] 4. Test switching maps: Switch between different maps and verify state updates.
- [ ] 5. Test welcome screen: Clear all maps and confirm the "Upload First Map" screen appears.
- [ ] 6. Test current map info: Ensure `getCurrentMapInfo` returns correct data.
- [ ] 7. Check console for any errors.
- [ ] 8. Perform basic operations (place marker, upload photo) to ensure no regressions.
- [ ] 9. Test in both online and offline modes.

### Expected Outcome
- `app.js` reduced by ~250 lines.
- All storage and display functionality preserved exactly as before.
- No regressions in map management or UI behavior.