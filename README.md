# SnapSpot PWA

## 🚨 Safari Blob Storage Compatibility Fix (2025-12)

**SnapSpot now supports all versions of Safari, including iOS/iPadOS, by migrating all map and photo image data in IndexedDB from Blob format to Base64 strings.**

- **Why?** Older Safari browsers do not support storing Blob objects in IndexedDB, causing failures when saving or loading maps/photos.
- **How?**
  - All image data is now stored as Base64 strings in IndexedDB.
  - On first launch after update, any legacy Blob data is automatically migrated to Base64 (one-time migration).
  - A full-screen overlay blocks UI and shows "Updating maps, please stand by" during migration.
  - Import/export, gallery, and thumbnails are fully compatible with both formats.
  - Migration is robust and error-tolerant; errors are logged but do not block app startup.
- **Result:** SnapSpot works seamlessly on Chrome, Firefox, Edge, and all Safari versions (desktop and mobile).

See [docs/SafariBlobFix.md](docs/SafariBlobFix.md) and [docs/SafariBlobFix_Tasks.md](docs/SafariBlobFix_Tasks.md) for technical details and implementation notes.

---

# SnapSpot PWA

A Progressive Web App for mapping photos and images to specific locations on any map or floor plan. Perfect for construction sites, archaeological surveys, property inspections, event planning, and more. Designed to work offline for use in any environment.

## Phase 1A: PWA Foundation ✅

This phase establishes the basic PWA infrastructure and offline capabilities.

### Features Implemented
- ✅ Progressive Web App setup with manifest.json
- ✅ Service Worker for offline functionality
- ✅ Responsive design optimized for mobile/tablet use
- ✅ Touch-friendly interface
- ✅ Connection status monitoring
- ✅ Basic app structure and navigation

### Files Structure
```
image-mapper/
├── DEPLOYMENT.md             # Instructions for deployment
├── index.html                # Main app HTML
├── manifest.json             # PWA configuration
├── README.md                 # This file
├── service-worker.js         # Offline functionality
│
├── css/
│   ├── base.css              # Base styles
│   ├── components.css        # UI component styles
│   ├── layout.css            # Layout-specific styles
│   ├── main.css              # Main application styles
│   ├── map-display.css       # Map display specific styles
│   ├── modals/               # Modal-specific styles (reorganized for clarity)
│   │   ├── marker-details.css# Marker details modal styles
│   │   ├── responsive.css    # Responsive adjustments for modals
│   │   ├── import-decision.css # Styling for the import decision modal
│   │   └── export-decision.css # Styling for the export decision modal (NEW)
│   ├── notifications.css     # Notification styles
│   ├── responsive.css        # General responsive adjustments
│   └── utilities.css         # Utility classes
│
├── icons/
│   ├── apple-touch-icon.png
│   ├── favicon-96x96.png
│   ├── favicon.ico
│   ├── favicon.svg
│   ├── README.md             # Icon usage documentation
│   ├── screenshot-narrow.png
│   ├── screenshot-wide.png
│   └── web-app-manifest-192x192.png
│   └── web-app-manifest-512x512.png
│
└── js/
    ├── app.js                # Main application logic (refactored)
    ├── app-map-interactions.js # Map interaction handlers (pan, zoom, rotate)
    ├── app-marker-photo-manager.js # Marker and photo management
    ├── app-search.js         # Search functionality
    ├── app-settings.js       # Settings orchestration
    ├── app-storage-manager.js # Storage and display management
    ├── fileManager.js        # Utility for file selection and processing
    ├── HtmlReportGenerator.js# Generates HTML reports for map data
    ├── imageProcessor.js     # Utility for image manipulation and thumbnail generation
    ├── MapDataExporterImporter.js # Handles importing/exporting map data
    ├── mapRenderer.js        # Manages canvas rendering, pan, zoom, markers
    ├── searchManager.js      # Manages the search modal and its logic
    ├── storage.js            # Handles IndexedDB interactions (MapStorage class)
    │
    └── ui/                   # UI-specific components
        ├── marker-details-modal.js # Marker details modal
        ├── modals.js         # Manages UI for various modals (ModalManager class)
        ├── photo-gallery-modal.js # Photo gallery modal
        ├── search-modal.js   # Search modal
        ├── settings-modal.js # Settings modal
        ├── uiRenderer.js     # Renders common UI components like card elements
        └── upload-modal.js   # Upload modal
```

## Getting Started

### 🚀 Live Demo
Visit the deployed app: `https://nielsih.github.io/SnapSpot`

### 📱 Install as PWA
1. Visit the app URL on any device
2. Look for "Install" or "Add to Home Screen" option or just bookmark the url
3. The app works offline after installation

### 🛠️ Local Development
1. Clone this repository
2. Serve files using a local web server:
   ```bash
   # Using Python 3
   python -m http.server 8000
   
   # Using Node.js
   npx http-server
   
   # Using PHP
   php -S localhost:8000
   ```
3. Open `http://localhost:8000` in your browser

### 📋 Deployment
See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed GitHub Pages setup instructions.

### Testing Offline Functionality
1. Load the app while online
2. Go to Developer Tools → Application → Service Workers
3. Check "Offline" to simulate offline mode
4. Refresh the page - the app should still work

## Implemented Phases ✨

### Phase 1B: File Management ✅
- ✅ Map file upload and storage
- ✅ Map naming and descriptions (including editing in map management modal)
- ✅ Map list management (CRUD operations, including active map selection, deletion, export)
- ✅ Local storage of map metadata (using IndexedDB)
- ✅ "Clear All App Data" function for complete data reset

### Phase 1C: Map Display Engine ✅
- ✅ Canvas-based map rendering
- ✅ Pan and zoom functionality (mouse and touch gestures)
- ✅ Touch and mouse interaction (panning, pinch-zoom)
- ✅ Map switching interface (via map management modal)
- ✅ Resizable map canvas that adapts to screen size
- ✅ Toggleable zoom controls and action buttons (minimize/maximize to icons)
- ✅ Crosshair visibility toggle and persistence
- ✅ Marker lock/unlock toggle and persistence
- ✅ Marker display size toggle and persistence
- ✅ Map rotation (90-degree increments) and persistence
- ✅ Consolidated and enhanced image viewer modal for maps and photos.

### Phase 1D: Marker System ✅
- ✅ Click/tap to place markers at canvas center
- ✅ Markers are numbered chronologically by creation date.
- ✅ Marker dragging (mouse and touch, now preserves position across map rotations)
- ✅ Marker details modal (showing description, coordinates, associated photos)
- ✅ Enhanced: Marker details modal now displays full-size photos for readability, especially for text.
- ✅ Marker description editing
- ✅ Marker deletion
- ✅ Image association with markers (uploading photos to markers)
- ✅ Direct image deletion from the full-size image viewer modal
- ✅ Implemented comprehensive map-wide duplicate photo detection.
- ✅ Note-taking functionality (marker description)
- ✅ Coordinate tracking (display in marker details)

### Phase 2: Export and Sync ✅
- ✅ **Safari Blob Storage Fix (Base64 Migration):**
  - All map and photo image data now stored as Base64 in IndexedDB for full Safari compatibility.
  - Import/export logic updated to convert Base64 to Blob and vice versa as needed.
  - Gallery and thumbnail handling robust for all imported/exported maps and photos.
  - Data migration logic ensures legacy Blob data is converted automatically.
  - Thorough cross-browser testing (Chrome, Firefox, Safari desktop/iOS).
  - Service Worker cache version bumped for deployment.
- ✅ Data export in multiple formats (HTML report implemented)
- ✅ Import and export of maps with markers and images
- ✅ **New: Merge Map Data functionality**:
  -   Allows merging imported map data (markers and photos) into an existing map based on image content (hash).
  -   Option to replace an existing map with imported data (maintaining map ID).
  -   Handles legacy import files (without content hashes) as new maps.
  -   Detects and skips duplicate markers during merge, while adding new photos to existing markers.
- ✅ **Enhanced: Advanced Export Options**:
  -   Introduced a dedicated modal for map export options.
  -   Allows users to select specific days for marker and photo export.
  -   Option to export selected day(s) into a single combined JSON file.
  -   Option to export each selected day into separate JSON files.

### Safari Blob Storage Fix: Implementation Tasks ✅

See `docs/SafariBlobFix_Tasks.md` for full checklist. Key tasks now completed:

- ✅ Storage layer now converts Blobs to Base64 and vice versa for all map/photo data
- ✅ Import/export logic robust for Base64 and Blob formats
- ✅ Gallery and thumbnail handling fixed for imported maps/photos
- ✅ Data migration for legacy Blob data
- ✅ Cross-browser testing (Chrome, Firefox, Safari desktop/iOS)
- ✅ Service Worker cache version bump
- ✅ Documentation and code comments updated

All tasks for the Safari Blob Storage Fix are now complete.

### Phase 3: App Settings & Customization ✅
- ✅ Comprehensive, tabbed settings modal for centralized configuration.
- ✅ Image Processing settings: Configurable quality for photos added to markers.
- ✅ App Behavior settings: Toggle for auto-closing marker details after adding photos.
- ✅ App Behavior settings: Toggle for allowing/preventing duplicate photos on a map.
- ✅ Map Management features migrated into settings modal with full CRUD operations for maps (select, import, export, delete).
- ✅ Data Management features (Import/Export data) integrated into settings modal.
- ✅ Clear All App Data moved to "Danger Zone" tab within settings.
- ✅ Crosshair visibility toggle and persistence integrated into Map Display settings.
- ✅ **New:** Setting to limit the maximum number of markers displayed on the map, showing only the most recent ones.
- ✅ Dedicated search modal for maps, markers, and photos.
- ✅ Unified search across map names, descriptions, and file names.
- ✅ Search by Image File (via selection) for map lookup.
- ✅ "Clear Search" functionality (X button) within the search input.
- ✅ Map thumbnail/image click in search results and settings list opens image viewer.
- ✅ Photo search by filename and display in search results with thumbnails.
- ✅ "Show on Map" action for photo search results, switching to map, panning to and highlighting the associated marker.
- ✅ Image Galery to browse and display all photos added to markers on the active map with "Show on Map" function.
- ✅ Custom coloring for markers based on the content of their "description" field.

### Phase 4: Enhanced Responsive UI & UX (Action Buttons) ✅
- ✅ Dynamically positioned action button bar:
  -   **Portrait Orientation (Mobile/Tablets)**: Buttons are fixed at the bottom with icons and labels, prominently featuring an enlarged "Place Marker" button in the center.
  -   **Landscape Orientation (All Devices)**: Buttons are fixed on the right side with icons and labels for easy access.
- ✅ Unified and redesigned action buttons with consistent sizing and clear labels across orientations.
- ✅ Touch-optimized zoom controls: Explicit zoom buttons are automatically hidden on touch-first devices, relying on pinch-to-zoom gestures.

## Technical Stack

- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3
- **Storage**: IndexedDB for offline data, Cache API for files
- **PWA**: Service Worker, Web App Manifest
- **Bundler**: ES Modules (seamless modularity without complex build steps)

## Browser Support

- Chrome/Edge 88+
- Firefox 85+
- Safari 14+
- Mobile browsers with PWA support

## Development Notes

### Current Limitations
- PWA screen orientation locking needs implementation (e.g., `screen.orientation.lock()` in JS).
- User-defined marker sizes are still to be implemented.
- Marker drag boundaries (preventing dragging outside map limits) need implementation.
- Photo Search (search photos directly by metadata/filename) is pending.

### Key Design Decisions
- **Offline-first approach**: Everything must work without internet
- **Touch-optimized**: 44px minimum touch targets
- **Lightweight**: No external frameworks for core functionality
- **Modular**: Clean separation between phases for iterative development
- **ES Modules**: Modern JavaScript modularity for better maintainability and performance.

## Use Cases

**SnapSpot is perfect for:**
- **Construction projects** - Map progress photos to floor plans and site layouts  
- **Archaeological surveys** - Document findings with precise location mapping
- **Property inspections** - Link inspection photos to property maps and floor plans
- **Event planning** - Map photos and notes to venue layouts
- **Facility management** - Track maintenance and asset photos by location
- **Research projects** - Geolocate field photos and documentation
- **Underground work** - Map photos in areas without GPS signal

## Contributing

This project focuses on versatile photo-to-location mapping. Future phases will build incrementally on this foundation.

### Code Standards
- Use ES6+ JavaScript features
- Follow BEM methodology for CSS classes where applicable
- Maintain touch-friendly interface standards
- Ensure all features work offline

## License

This project is developed for versatile photo mapping and location documentation use cases.