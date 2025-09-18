# Image Mapper PWA

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
├── index.html              # Main app HTML
├── manifest.json           # PWA configuration
├── service-worker.js       # Offline functionality
├── DEPLOYMENT.md           # Instructions for deployment
├── css/
│   └── app.css             # Main stylesheet
├── js/
│   ├── app.js              # Main application logic
│   ├── storage.js          # Handles IndexedDB interactions (MapStorage class)
│   ├── fileManager.js      # Utility for file selection and processing
│   ├── mapRenderer.js      # Manages canvas rendering, pan, zoom, markers
│   ├── modals.js           # Manages UI for various modals (ModalManager class)
│   ├── imageProcessor.js   # Utility for image manipulation and thumbnail generation
│   └── HtmlReportGenerator.js # Generates HTML reports for map data
├── icons/                  # PWA icons (to be added)
└── README.md               # This file
```

## Getting Started

### 🚀 Live Demo
Visit the deployed app: `https://nielsih.github.io/ImageMapper`

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

### Phase 1C: Map Display Engine ✅
- ✅ Canvas-based map rendering
- ✅ Pan and zoom functionality (mouse and touch gestures)
- ✅ Touch and mouse interaction (panning, pinch-zoom)
- ✅ Map switching interface (via map management modal)
- ✅ Resizable map canvas that adapts to screen size
- ✅ **Toggleable zoom controls and action buttons (minimize/maximize to icons)**

### Phase 1D: Marker System ✅
- ✅ Click/tap to place markers at canvas center
- ✅ Marker dragging (mouse and touch)
- ✅ Marker details modal (showing description, coordinates, associated photos)
- ✅ Marker description editing
- ✅ Marker deletion
- ✅ Image association with markers (uploading photos to markers)
- ✅ Note-taking functionality (marker description)
- ✅ Coordinate tracking (display in marker details)

### Phase 2: Export and Sync (Next)
- Data export in multiple formats (HTML report implemented)


## Technical Stack

- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3
- **Storage**: IndexedDB for offline data, Cache API for files
- **PWA**: Service Worker, Web App Manifest

## Browser Support

- Chrome/Edge 88+
- Firefox 85+
- Safari 14+
- Mobile browsers with PWA support

## Development Notes

### Current Limitations (Phase 1D)
- Settings modal is not implemented
- Server synchronization is not implemented (Phase 2)
- Advanced metadata management is not implemented (Phase 2)

_**Removed previous limitations as they are now implemented.**_

### Key Design Decisions
- **Offline-first approach**: Everything must work without internet
- **Touch-optimized**: 44px minimum touch targets
- **Lightweight**: No external frameworks for core functionality
- **Modular**: Clean separation between phases for iterative development

## Use Cases

**Image Mapper is perfect for:**
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
