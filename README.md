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
│   ├── modals.css            # Modal-specific styles
│   ├── notifications.css     # Notification styles
│   ├── responsive.css        # Responsive adjustments
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
    ├── app.js                # Main application logic (modified)
    ├── debug.js              # Debugging utilities
    ├── fileManager.js        # Utility for file selection and processing
    ├── HtmlReportGenerator.js# Generates HTML reports for map data
    ├── imageProcessor.js     # Utility for image manipulation and thumbnail generation
    ├── MapDataExporterImporter.js # Handles importing/exporting map data
    ├── mapRenderer.js        # Manages canvas rendering, pan, zoom, markers (modified)
    ├── searchManager.js      # Manages the search modal and its logic (modified)
    ├── storage.js            # Handles IndexedDB interactions (MapStorage class) (modified)
    │
    └── ui/                   # UI-specific components
        ├── modals.js         # Manages UI for various modals (ModalManager class)
        └── uiRenderer.js     # Renders common UI components like card elements (modified)
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
- ✅ Marker dragging (mouse and touch, now preserves position across map rotations)
- ✅ Marker details modal (showing description, coordinates, associated photos)
- ✅ Marker description editing
- ✅ Marker deletion
- ✅ Image association with markers (uploading photos to markers)
- ✅ Direct image deletion from the full-size image viewer modal
- ✅ Implemented comprehensive map-wide duplicate photo detection.
- ✅ Note-taking functionality (marker description)
- ✅ Coordinate tracking (display in marker details)

### Phase 2: Export and Sync
- ✅ Data export in multiple formats (HTML report implemented)
- ✅ Import and export of maps with markers and images

### Phase 3: App Settings & Customization ✅
- ✅ Comprehensive, tabbed settings modal for centralized configuration.
- ✅ Image Processing settings: Configurable quality for photos added to markers.
- ✅ App Behavior settings: Toggle for auto-closing marker details after adding photos.
- ✅ App Behavior settings: Toggle for allowing/preventing duplicate photos on a map.
- ✅ Map Management features migrated into settings modal with full CRUD operations for maps (select, import, export, delete).
- ✅ Data Management features (Import/Export data) integrated into settings modal.
- ✅ Clear All App Data moved to "Danger Zone" tab within settings.
- ✅ Crosshair visibility toggle and persistence integrated into Map Display settings.
- ✅ Dedicated search modal for maps, markers, and photos.
- ✅ Unified search across map names, descriptions, and file names.
- ✅ Search by Image File (via selection) for map lookup.
- ✅ "Clear Search" functionality (X button) within the search input.
- ✅ Map thumbnail/image click in search results and settings list opens image viewer.
- ✅ Photo search by filename and display in search results with thumbnails.
- ✅ "Show on Map" action for photo search results, switching to map, panning to and highlighting the associated marker.

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