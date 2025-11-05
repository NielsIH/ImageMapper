# SnapSpot Marker Migration - Phase 2 Implementation Tasks

## Overview
Phase 2 focuses on enhancing the import decision modal to detect and handle migration files, including destination map selection and reference image gallery preparation.

## Tasks

### 2.1: Migration File Detection
- [ ] Enhance import detection logic in `js/MapDataExporterImporter.js` to identify migration files by checking for migration metadata
- [ ] Add migration file format validation
- [ ] Create import flow branching based on file type (regular import vs migration import)

### 2.2: Extend Import Decision Modal
- [ ] Modify the import decision modal in `js/ui/modals.js` to handle migration files differently
- [ ] Display available destination maps in a card list format
- [ ] Exclude the source map (from the migration file) from destination map selection
- [ ] Add radio button selection for destination map
- [ ] Implement visual indicators for maps that are ready to receive migrated markers

### 2.3: Map Similarity Check
- [ ] Implement map similarity check functionality that compares the source map from migration file with selected destination map
- [ ] Add checks for imageHash, file size, dimensions, etc.
- [ ] Create confirmation dialog logic: "The destination map appears to be the same as the source map. Would you like to perform a marker merge instead of migration?"
- [ ] Implement the option to switch to existing merge functionality if user chooses

### 2.4: Migration Reference Gallery
- [ ] Enhance the image gallery modal to show the 3 reference images from the migration file
- [ ] Add overlay instructions to each reference image: "Place marker 1 at this exact location", etc.
- [ ] Implement swipe functionality to navigate between reference images
- [ ] Add numbered display (1/3, 2/3, 3/3) for reference images
- [ ] Ensure reference images clearly show the numbered crosshair-style markers for accurate placement

### 2.5: Migration Mode Activation
- [ ] Implement logic to activate migration mode when "Start Migration" button is clicked
- [ ] Transition from import decision modal to reference image gallery
- [ ] Prepare the system for reference marker placement on destination map
- [ ] Add visual feedback that migration process has started

### 2.6: "Start Migration" Button Implementation
- [ ] Add "Start Migration" button that becomes enabled after destination map is selected (if maps are not similar)
- [ ] Implement button click handler to initiate the reference placement workflow
- [ ] Add appropriate styling and state management for the button

### 2.7: Testing Phase 2
- [ ] Test migration file detection functionality
- [ ] Verify destination map selection works correctly
- [ ] Validate map similarity check and merge vs. migration decision
- [ ] Test reference image gallery display and navigation
- [ ] Confirm migration mode activation flows correctly