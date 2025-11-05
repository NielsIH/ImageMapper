# SnapSpot Marker Migration - Phase 1 Implementation Tasks

## Overview
Phase 1 focuses on implementing the export functionality for migration, allowing users to prepare their source map with reference points that will be used for geometric transformation.

## Tasks

### 1.1: Modify Export Decision Modal
- [ ] Add 'Export for Migration' option to the existing export decision modal in `js/ui/modals.js`
- [ ] Create visual distinction for the migration export option
- [ ] Implement event handler for the new migration export option

### 1.2: Add Reference Marker Placement Mode
- [ ] Implement temporary marker hiding functionality in `js/mapRenderer.js`
- [ ] Add overlay instruction display during reference placement: "Place 3 reference markers on easily recognizable features of the map"
- [ ] Modify marker placement logic to handle reference markers differently
- [ ] Create visual distinction for reference markers (crosshair-style with clear center point that aligns with map crosshair)
- [ ] Add number (1, 2, or 3) displayed above each reference marker, clearly visible and not obscuring the center

### 1.3: Implement Reference Marker Capture
- [ ] Modify marker placement to capture zoomed-in images of each reference point location (200x200px area)
- [ ] Store reference marker coordinates with their descriptions and zoomed images
- [ ] Implement sequential numbering of reference markers (1, 2, 3)
- [ ] Add temporary state tracking for reference marker count

### 1.4: Create Migration Data Structure
- [ ] Update the export data structure to include migration metadata in `js/MapDataExporterImporter.js`
- [ ] Add source map dimensions to the migration data
- [ ] Store the 3 reference markers with both coordinates and image data
- [ ] Include all original markers (excluding the 3 reference markers) in the migration data
- [ ] Add migration metadata flag to identify migration files

### 1.5: Implement Temporary Migration Storage
- [ ] Add a temporary migration object store in `js/storage.js`
- [ ] Create functions to store and retrieve migration data temporarily
- [ ] Implement automatic cleanup of expired migration entries (24 hour retention)
- [ ] Add migration data schema definition

### 1.6: Export Migration File
- [ ] Generate migration-specific JSON file with standard .json extension and "SnapSpot_Migration_" prefix
- [ ] Implement the export process that packages all migration data
- [ ] Ensure migration files contain all necessary information for the import phase

### 1.7: Testing Phase 1
- [ ] Test export functionality for migration
- [ ] Verify reference marker placement works correctly
- [ ] Validate that zoomed-in images are captured properly
- [ ] Confirm migration data structure is complete
- [ ] Test temporary storage and cleanup mechanisms