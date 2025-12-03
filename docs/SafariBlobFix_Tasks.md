# Safari Blob Storage Fix - Implementation Tasks

## Overview
Implement Base64 storage for image data in IndexedDB to fix Safari compatibility issues with Blob objects. This change stores maps and photos as Base64 strings instead of Blobs, with transparent conversion at the storage layer.

## Prerequisites
- [ ] Review `docs/SafariBlobFix.md` for complete understanding
- [ ] Ensure `ImageProcessor.blobToBase64()` and `ImageProcessor.base64ToBlob()` methods exist
- [ ] Test current functionality on Safari to confirm the issue

## Phase 1: Storage Layer Modifications (`js/storage.js`) ✅ COMPLETED

### Task 1.1: Update `addMap()` method ✅
- [x] Modify `addMap()` to convert `imageData` Blob to Base64 before storing
- [x] Add conversion logic: `if (mapData.imageData instanceof Blob) { mapData.imageData = await imageProcessor.blobToBase64(mapData.imageData) }`
- [x] Update JSDoc comments to reflect Base64 storage

### Task 1.2: Update `saveMap()` method ✅
- [x] Modify `saveMap()` to convert `imageData` Blob to Base64 before storing
- [x] Ensure conversion happens in the `mapToSave` object creation
- [x] Update validation logic if needed

### Task 1.3: Update `getMap()` method ✅
- [x] Convert Base64 strings back to Blobs for application use
- [x] Add error handling for conversion failures

### Task 1.4: Update `getAllMaps()` method ✅
- [x] Apply Base64 to Blob conversion to each map in the results
- [x] Ensure marker count enrichment still works

### Task 1.5: Update `addPhoto()` method ✅
- [x] Modify `addPhoto()` to convert `imageData` Blob to Base64 before storing
- [x] Handle thumbnail data conversion as well

### Task 1.6: Update `savePhoto()` method ✅
- [x] Modify `savePhoto()` to convert `imageData` Blob to Base64 before storing
- [x] Ensure thumbnail data handling remains compatible

### Task 1.7: Update `getPhoto()` method ✅
- [x] Convert Base64 strings back to Blobs for application use
- [x] Handle thumbnail data conversion

### Task 1.8: Update `getPhotosForMarker()` method ✅
- [x] Apply Base64 to Blob conversion to each photo in results
- [x] Ensure transaction handling works correctly

### Additional Tasks Completed ✅
- [x] Updated `getAllPhotos()` method for Base64 conversion
- [x] Updated `getAllPhotosWithContext()` method for Base64 conversion
- [x] Updated `getPhotosForMap()` method for Base64 conversion
- [x] Updated `getMapsByImageHash()` method for Base64 conversion
- [x] Updated `updateMap()` method for Base64 conversion
- [x] Modified MapStorage constructor to accept ImageProcessor instance
- [x] Updated app.js to pass imageProcessor to MapStorage constructor

## Phase 2: Import/Export Compatibility (`js/MapDataExporterImporter.js`)

### Task 2.1: Verify Export Functionality
- [ ] Confirm `exportData()` already converts Blobs to Base64 (should work unchanged)
- [ ] Test export with Base64 storage to ensure no double-conversion

### Task 2.2: Verify Import Functionality
- [ ] Confirm `_processImportedDataForNewMap()` converts Base64 to Blobs (should work unchanged)
- [ ] Confirm `mergeData()` converts Base64 to Blobs (should work unchanged)
- [ ] Test import of existing export files

### Task 2.3: Update Import Processing
- [ ] Ensure imported data flows correctly through storage layer
- [ ] Verify that imported Blobs get converted to Base64 during save operations

## Phase 3: Application Integration Testing

### Task 3.1: Map Upload Testing
- [ ] Test uploading new maps - should store as Base64
- [ ] Verify maps display correctly after upload
- [ ] Check thumbnail generation works

### Task 3.2: Photo Upload Testing
- [ ] Test adding photos to markers - should store as Base64
- [ ] Verify photos display in galleries and modals
- [ ] Check thumbnail generation works

### Task 3.3: Data Migration Testing
- [ ] Test with existing data containing Blobs
- [ ] Verify automatic conversion to Base64 on first access
- [ ] Ensure no data loss during migration

### Task 3.4: Import/Export Round-trip Testing
- [ ] Export map with photos
- [ ] Import the exported file
- [ ] Verify all data integrity
- [ ] Test merge functionality

### Task 3.5: Cross-Browser Testing
- [ ] Test on Chrome/Firefox (should work unchanged)
- [ ] Test on Safari (should now work)
- [ ] Test on mobile Safari if possible

## Phase 4: Edge Cases and Error Handling

### Task 4.1: Error Handling
- [ ] Add try-catch blocks around Base64 conversions
- [ ] Implement fallback behavior for conversion failures
- [ ] Add logging for debugging conversion issues

### Task 4.2: Performance Optimization
- [ ] Monitor memory usage during conversions
- [ ] Consider chunking for very large images if needed
- [ ] Ensure conversions don't block UI

### Task 4.3: Backward Compatibility
- [ ] Test with very old export files
- [ ] Verify legacy data without imageHash works
- [ ] Ensure all existing functionality preserved

## Phase 5: Documentation and Deployment

### Task 5.1: Update Documentation
- [ ] Update `docs/SafariBlobFix.md` with implementation details
- [ ] Add troubleshooting section for common issues
- [ ] Document the migration process for users

### Task 5.2: Code Comments
- [ ] Add detailed comments explaining Base64 conversion logic
- [ ] Document migration behavior in method comments
- [ ] Update class-level documentation

### Task 5.3: Version Control
- [ ] Commit changes in logical chunks
- [ ] Test each phase before proceeding
- [ ] Keep backup of working version

## Implementation Order

1. Start with storage.js modifications (Phase 1)
2. Test basic functionality before proceeding
3. Verify import/export compatibility (Phase 2)
4. Comprehensive testing (Phase 3)
5. Edge cases and error handling (Phase 4)
6. Documentation updates (Phase 5)

## Testing Checklist

### Functional Tests
- [ ] Map upload and display
- [ ] Photo upload and display
- [ ] Thumbnail generation
- [ ] Search functionality
- [ ] Export/import operations
- [ ] Data migration from Blobs to Base64

### Compatibility Tests
- [ ] Chrome/Edge/Firefox (existing functionality)
- [ ] Safari desktop (new functionality)
- [ ] Safari iOS (new functionality)
- [ ] Different image formats (JPEG, PNG, WebP)

### Performance Tests
- [ ] Large image handling
- [ ] Memory usage during conversions
- [ ] UI responsiveness during operations

## Rollback Plan

If issues arise:
1. Revert storage.js changes
2. Clear IndexedDB to remove Base64 data
3. Restore Blob storage
4. Users can re-import from export files

## Success Criteria

- [ ] Safari users can upload and view maps/photos
- [ ] Existing Chrome/Firefox functionality unchanged
- [ ] Import/export works with old and new formats
- [ ] No data loss during migration
- [ ] Performance acceptable on all platforms