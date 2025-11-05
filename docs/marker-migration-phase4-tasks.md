# SnapSpot Marker Migration - Phase 4 Implementation Tasks

## Overview
Phase 4 focuses on completing the UI and user flow integration, implementing the reference marker placement on the destination map and connecting all components for end-to-end functionality.

## Tasks

### 4.1: Migration Reference Placement Mode
- [ ] Implement migration reference placement mode in `js/mapRenderer.js`
- [ ] Ensure map displays with only the 3 reference markers allowed during placement
- [ ] Prevent deletion of reference markers during this phase
- [ ] Add crosshair-style visual display for reference markers with clear center points that align with map crosshair
- [ ] Add number (1, 2, or 3) displayed above each reference marker, clearly visible and not obscuring the center point
- [ ] Add visual feedback for numbered markers (1, 2, 3) on map

### 4.2: UI State Management During Migration
- [ ] Disable most UI buttons during reference placement (settings, search, map management, etc.)
- [ ] Keep map action buttons enabled (place marker, zoom, rotate, lock/unlock, etc.)
- [ ] Implement migration mode state tracking in `js/app.js`
- [ ] Add button availability management during migration

### 4.3: Migration Status Overlay
- [ ] Create migration status overlay showing progress (e.g., "1/3 reference markers placed")
- [ ] Implement dynamic updates to the progress indicator
- [ ] Add clear instructions during the reference placement process

### 4.4: Marker Positioning and Repositioning
- [ ] Allow users to reposition reference markers using existing marker movement functionality
- [ ] Implement validation during repositioning to ensure proper reference point placement
- [ ] Prevent users from deleting already placed reference markers during this phase

### 4.5: Complete Migration Button
- [ ] Add "Complete Migration" button that appears after the third reference marker is placed
- [ ] Implement validation that the reference markers form a valid geometric transformation before enabling the button
- [ ] Add appropriate styling and state management for the button

### 4.6: Migration Process Execution
- [ ] Implement the logic when "Complete Migration" button is clicked
- [ ] Validate the reference markers using the logic from Phase 3
- [ ] Calculate the geometric transformation matrix from the 6 reference points
- [ ] Apply the transformation matrix to all source markers
- [ ] Validate that transformed markers are within bounds of destination map
- [ ] Import all transformed markers with their associated photos to the destination map

### 4.7: Progress and Completion Indicators
- [ ] Add progress indicator during the import process of transformed markers
- [ ] Implement confirmation message: "Migration complete: X markers with photos imported"
- [ ] Transition the destination map to become the active map and display with newly imported markers
- [ ] End migration mode and resume normal functionality

### 4.8: Temporary Data Cleanup
- [ ] Implement immediate cleanup of temporary migration data after successful import
- [ ] Ensure temporary migration object store is properly cleared
- [ ] Add cleanup confirmation to prevent data accumulation

### 4.9: End-to-End Flow Integration
- [ ] Connect all components from Phases 1-3 to create a complete migration workflow
- [ ] Test the entire migration process from export to import to transformation
- [ ] Ensure smooth transitions between different phases of the migration process

### 4.10: Testing Phase 4
- [ ] Test complete migration workflow from start to finish
- [ ] Verify reference marker placement works correctly on destination map
- [ ] Validate UI state management during migration
- [ ] Test progress indicators and completion messages
- [ ] Confirm temporary data cleanup works properly
- [ ] Ensure destination map becomes active and shows imported markers