# SnapSpot Marker Migration - Phase 1 Implementation Tasks

## Overview
Phase 1 focuses on implementing the export functionality for migration, allowing users to prepare their source map with reference points that will be used for geometric transformation.

## Tasks

### 1.1: Modify Export Decision Modal
- [x] Add 'Export for Migration' option to the existing export decision modal in `js/ui/modals.js`
- [x] Create visual distinction for the migration export option
- [x] Implement event handler for the new migration export option

### 1.2: Add Reference Marker Placement Mode
- [x] Implement temporary marker hiding functionality in `js/mapRenderer.js`
- [x] Add overlay instruction display during reference placement: "Place 3 reference markers on easily recognizable features of the map"
- [x] Modify marker placement logic to handle reference markers differently (using the existing "Place Marker" button functionality rather than direct clicks)
- [x] Create visual distinction for reference markers (crosshair-style with clear center point that aligns with map crosshair)
- [x] Add number (1, 2, or 3) displayed above each reference marker, clearly visible and not obscuring the center

### 1.3: Implement Reference Marker Capture
- [x] Modify marker placement to capture zoomed-in images of each reference point location (200x200px area)
- [x] Store reference marker coordinates with their descriptions and zoomed images
- [x] Implement sequential numbering of reference markers (1, 2, 3)
- [x] Add temporary state tracking for reference marker count
- [x] Ensure reference markers can be repositioned using the same unlock/drag mechanism as regular markers
- [x] Add "Cancel" and "Export" buttons to migration overlay that appear after third marker is placed

### 1.4: Create Migration Data Structure
- [x] Update the export data structure to include migration metadata in `js/MapDataExporterImporter.js`
- [x] Add source map dimensions to the migration data
- [x] Store the 3 reference markers with both coordinates and image data
- [x] Include all original markers (excluding the 3 reference markers) in the migration data
- [x] Add migration metadata flag to identify migration files

### 1.5: Implement Temporary Migration Storage
- [x] Add a temporary migration object store in `js/storage.js`
- [x] Create functions to store and retrieve migration data temporarily
- [x] Implement automatic cleanup of expired migration entries (24 hour retention)
- [x] Add migration data schema definition

### 1.6: Export Migration File
- [x] Generate migration-specific JSON file with standard .json extension and "SnapSpot_Migration_" prefix
- [x] Implement the export process that packages all migration data
- [x] Ensure migration files contain all necessary information for the import phase

### 1.7: Testing Phase 1
- [x] Test export functionality for migration
- [x] Verify reference marker placement works correctly
- [x] Validate that zoomed-in images are captured properly
- [x] Confirm migration data structure is complete
- [x] Test temporary storage and cleanup mechanisms