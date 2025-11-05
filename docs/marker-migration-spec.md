# SnapSpot Marker Migration Feature Specification

## Overview

This document specifies the marker migration feature for SnapSpot PWA, which allows users to migrate markers with photos from one map to another with geometric transformation based on 3 reference points. This feature enables users to update maps while preserving their existing marker data.

## Design Goals

- **Minimal UI Changes**: Reuse existing UI components where possible
- **Backwards Compatibility**: No breaking changes to existing database schema
- **User-Friendly Workflow**: Intuitive migration process using familiar marker placement
- **Robust Geometry**: Support translation, rotation, scaling, and skewing between maps

## Database Changes

### New Object Store
A temporary object store will be added for migration data:

```javascript
const MIGRATION_STORE = 'temp_migrations';
```

### Data Structure
```
{
  id: string,           // Unique identifier for this migration session
  sourceData: object,   // The parsed migration file content
  timestamp: number,    // When it was stored
  expires: number       // Expiration time (e.g., 24 hours from creation)
}
```

### Automatic Cleanup
- Run on database initialization
- Remove entries past their expiration time (24 hour retention)
- Manual cleanup after successful migration

## Workflow

### Phase 1: Export for Migration (Source Map)

1. User selects the source map they want to migrate from the map list
2. User initiates export via the existing export decision modal
3. In the export decision modal, a new "Export for Migration" option appears alongside existing options
4. After selecting "Export for Migration", user sees the source map view without existing markers
5. A temporary overlay/instruction appears: "Place 3 reference markers on easily recognizable features of the map"
6. User places 3 reference markers using the "Place Marker" button in the action bar
   - Reference markers are placed at the map center (crosshair location) like regular markers
   - Each reference marker is visually distinct from regular markers with numbered crosshair design
   - After placing each marker, the system captures a zoomed-in image of that area
7. System temporarily stores the map data with:
   - All original markers (excluding the 3 reference markers)
   - 3 reference markers with coordinates on source map
   - Source map dimensions
   - Zoomed-in images for each reference point (200x200px area)
   - Migration metadata flag
8. System exports the data to a migration-specific JSON file with .migration extension

### Phase 2: Prepare Destination Map

1. User selects the migration file for import
2. System detects the migration file by checking for migration metadata
3. System opens the import decision modal with a special migration import interface
4. The modal displays available destination maps in a card list format (similar to merge functionality)
5. Source map (the map that was exported for migration) is excluded from the list
6. User selects the destination map by checking the radio button associated with it
7. When a destination map is selected, the system performs the existing map similarity check (imageHash, file size, dimensions, etc.) against the source map
8. If the similarity check indicates the maps are likely the same:
   - A confirmation dialog appears: "The destination map appears to be the same as the source map. Would you like to perform a marker merge instead of migration?"
   - If user chooses "Yes", system switches to merge functionality (existing flow)
   - If user chooses "No", migration process continues
9. If the maps are not similar, the "Start Migration" button is enabled
10. User clicks the "Start Migration" button
11. Import decision modal closes and system opens the existing image gallery modal showing the 3 reference images
12. Each reference image displays an overlay instruction: "Place marker 1 at this exact location", "Place marker 2 at this exact location", etc.
13. User can swipe through images to familiarize themselves with reference points
14. User closes gallery to begin placement mode
15. System enters migration reference placement mode
16. During placement mode:
    - Map displays with only the 3 reference markers allowed (no deletion permitted)
    - Markers are numbered 1, 2, 3 as they're placed
    - A migration status overlay shows progress (e.g., "1/3 reference markers placed")
    - Most UI buttons are disabled (settings, search, map management, etc.)
    - All map action buttons remain enabled (place marker, zoom, rotate, lock/unlock, etc.)
17. User places 3 reference markers sequentially on the destination map at equivalent locations
    - Each placement is guided by memory of the reference images seen in gallery
    - System provides visual feedback: numbered markers (1, 2, 3) on map
    - User can reposition markers using existing marker movement functionality (unlock markers first)
    - User cannot delete already placed reference markers during this phase
18. After the third reference marker is placed, migration action buttons appear in the overlay
    - "Cancel" button: Ends migration mode and cancels the export (returns to active map with regular markers)
    - "Export" button: Enables when third reference marker has been placed, starts the actual export (returns to active map with regular markers)

### Phase 3: Import and Transform

1. User clicks the "Complete Migration" button
2. System validates that the reference markers form a valid geometric transformation
   - Checks that the 3 points are not collinear
   - Validates that the spatial relationships are reasonable
3. System calculates the geometric transformation matrix from the 6 reference points (3 from source, 3 from destination)
4. System applies the transformation matrix to all source markers
5. System calculates new coordinates for each original marker using the transformation
6. System validates that transformed markers are within the bounds of the destination map
7. System imports all transformed markers with their associated photos to the destination map
8. System displays a progress indicator during the import process
9. A confirmation message appears: "Migration complete: X markers with photos imported"
10. The destination map becomes the active map and is displayed with the newly imported markers
11. Migration mode ends, normal functionality resumes
12. The temporary migration data is cleaned up immediately after successful import

## UI Components Involved

### Existing Components to Reuse
- Map display and rendering (mapRenderer.js)
- Marker placement functionality (mapRenderer.js)
- Export decision modal (ui/modals.js)
- Import functionality (MapDataExporterImporter.js)
- Image display and viewer (ui/modals.js)
- Modal management system (ui/modals.js)
- Map selection interface (settings/modal management)

### UI Modifications to Existing Components

#### Export Decision Modal (`ui/modals.js` - ModalManager)
- Add "Export for Migration" option to the export decision modal
- Trigger reference marker placement workflow after selection
- Add visual distinction for the migration export option

#### Map Display (`js/mapRenderer.js`)
- Option to temporarily hide existing markers during reference placement
- Overlay instructions during reference marker placement
- Visual indicators for migration reference markers (crosshair-style with clear center point that aligns with map crosshair)
- Number (1, 2, or 3) displayed above each reference marker, clearly visible and not obscuring the center
- Temporary overlay showing instructions to the user
- Visual feedback during reference marker placement
- Migration mode state management (buttons disabled/enabled)
- Integration with existing "Place Marker" button for reference marker placement

#### Map Management/Settings Modal (`js/ui/modals.js` - ModalManager)
- Possibly add an indicator that a map is prepared for migration import
- Visual cues for maps that are ready to receive migrated markers

#### Import Process (`js/MapDataExporterImporter.js`)
- Detect migration files by checking for migration metadata
- Provide visual feedback during migration import process
- Display confirmation messages after successful migration

#### Image Gallery Modal (`js/ui/modals.js` - ModalManager)
- Enhancement to display instructions overlay on reference images
- Support for showing numbered reference markers (1/3, 2/3, 3/3)
- Possibly include migration-specific controls

#### App State Management (`js/app.js`)
- Migration mode state tracking
- Button availability management during migration (disable settings, search, etc.)
- Migration status overlay management

### New UI Elements (Minimal)

#### Reference Marker Visual Style
- Distinct appearance for reference markers during placement
- Crosshair-style marker with clear center point that aligns with the map crosshair
- Number (1, 2, or 3) displayed above the marker, clearly visible and not obscuring the center
- Different color/icon from regular markers
- Temporary visual indicators during the reference placement process

#### Overlay Instructions
- Temporary overlay during reference marker placement
- Clear instructions: "Place 3 reference markers on easily recognizable features of the map"
- Visual guides showing where to place markers

#### Migration Progress Feedback
- Progress indicator during marker transformation and import
- Confirmation message after successful migration
- Error messages for invalid reference points or other issues

## Modules and Components

### Existing Modules to Modify

#### `js/storage.js` (MapStorage class)
- Add temporary migration object store initialization during database setup
- Add cleanup function for expired migration data (run on DB initialization)
- Add functions to store and retrieve migration data temporarily
- Add migration data schema definition
- Add automatic cleanup of expired migration entries

#### `js/MapDataExporterImporter.js`
- Enhance export functionality to support migration export mode
- Add method to capture zoomed-in images of reference marker locations
- Add detection for migration files during import (check for migration metadata)
- Add geometric transformation logic for marker coordinates
- Add temporary storage management for migration data during import process
- Extend export options in export decision modal
- Add migration-specific export functionality

#### `js/mapRenderer.js`
- Add functionality to temporarily hide markers during reference placement
- Enhance marker placement logic to distinguish migration reference markers
- Add special visual rendering for migration reference markers
- Add zoomed-in image capture functionality for reference points
- Add visual overlay/instruction system for migration workflow
- Modify marker interaction during migration reference placement

#### `js/ui/modals.js` (ModalManager class)
- Extend export decision modal with "Export for Migration" option
- Add modal/instruction system for reference marker placement
- Add visual feedback during migration import process
- Enhance import modal to detect and handle migration files

#### `js/app.js`
- Integrate migration export flow with export decision modal
- Add import handling logic specifically for migration files
- Coordinate between storage, renderer, and export/import modules during migration
- Add state management for migration workflow
- Handle the flow from export to temporary storage to import and transformation

#### `js/debug.js` (if used for migration debugging)
- Add debugging utilities for migration transformation calculations
- Add logging for migration process steps

### New Modules/Components to Add

#### None required
All functionality will be integrated into existing modules with minimal new code.

The migration feature leverages existing components:
- Uses existing map rendering capabilities from mapRenderer.js
- Uses existing modal system from ui/modals.js
- Uses existing storage mechanisms from storage.js
- Uses existing import/export functionality from MapDataExporterImporter.js

The feature extends these existing modules rather than creating new ones, maintaining consistency with the existing codebase architecture and minimizing the learning curve for future maintenance.

## Data Format

### Migration Export File Structure
```json
{
  "maps": [...],
  "markers": [...],  // Includes all original markers + 3 reference markers
  "photos": [...],
  "migrationData": {
    "isMigration": true,
    "sourceMapDimensions": {
      "width": number,
      "height": number
    },
    "referencePoints": [
      {
        "original": {"x": number, "y": number},
        "description": "string",
        "zoomedImageData": "base64 image string",
        "zoomFactor": number
      }
      // ... 2 more reference points
    ],
    "exportTimestamp": number
  }
}
```

## Geometric Transformation

The system will calculate an affine transformation matrix using the 3 reference point pairs from source to destination map. This will handle:

- Translation (x, y offset)
- Rotation
- Scaling (uniform or non-uniform)
- Shearing (skewing)

The transformation will be applied to all original markers' coordinates to calculate their new positions on the destination map.

## Error Handling

- If reference points are invalid or collinear, show error message
- If transformation results in invalid coordinates, warn user
- Validate that transformed markers are within bounds of destination map
- Handle large file size gracefully (temporary IndexedDB storage)

## Performance Considerations

- Store large migration files in temporary IndexedDB store instead of memory
- Limit size of zoomed-in reference images for performance
- Use canvas operations efficiently for image capture
- Apply transformations efficiently using matrix calculations

## Security Considerations

- No additional security risks beyond existing import/export
- Temporary migration data has automatic expiration
- No sensitive data stored in migration files

## Upgrade Path

- Schema changes are backwards compatible
- Existing data will not be affected
- New functionality is optional - won't break existing workflows