# Quarry Inventory PWA

A Progressive Web App for underground limestone quarry inventarisation, designed to work offline and capture location-based data with photos and annotations.

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
quarry-inventory/
├── index.html              # Main app HTML
├── manifest.json           # PWA configuration
├── service-worker.js       # Offline functionality
├── css/
│   └── app.css            # Main stylesheet
├── js/
│   └── app.js             # Main application logic
├── icons/                 # PWA icons (to be added)
└── README.md              # This file
```

## Getting Started

### 🚀 Live Demo
Visit the deployed app: `https://YOURUSERNAME.github.io/quarry-inventory`
*(Replace YOURUSERNAME with your GitHub username after deployment)*

### 📱 Install as PWA
1. Visit the app URL on any device
2. Look for "Install" or "Add to Home Screen" option
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

## Upcoming Phases

### Phase 1B: File Management (Next)
- Map file upload and storage
- Map naming and descriptions
- Map list management (CRUD operations)
- Local storage of map metadata

### Phase 1C: Map Display Engine
- Canvas-based map rendering
- Pan and zoom functionality
- Touch and mouse interaction
- Map switching interface

### Phase 1D: Marker System
- Click/tap to place markers on maps
- Image association with markers
- Note-taking functionality
- Coordinate tracking

### Phase 2: Export and Sync
- Data export in multiple formats
- Server synchronization
- Advanced metadata management

## Technical Stack

- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3
- **Storage**: IndexedDB for offline data, Cache API for files
- **PWA**: Service Worker, Web App Manifest
- **Future Backend**: ASP.NET Core Web API

## Browser Support

- Chrome/Edge 88+
- Firefox 85+
- Safari 14+
- Mobile browsers with PWA support

## Development Notes

### Current Limitations (Phase 1A)
- Map upload is not yet implemented (placeholder buttons)
- Map display is not yet functional (placeholder canvas)
- Zoom controls are not yet connected to actual functionality
- Settings modal is not implemented

### Key Design Decisions
- **Offline-first approach**: Everything must work without internet
- **Touch-optimized**: 44px minimum touch targets
- **Lightweight**: No external frameworks for core functionality
- **Modular**: Clean separation between phases for iterative development

## Contributing

This is a focused project for underground quarry inventarisation. Future phases will build incrementally on this foundation.

### Code Standards
- Use ES6+ JavaScript features
- Follow BEM methodology for CSS classes where applicable
- Maintain touch-friendly interface standards
- Ensure all features work offline

## License

This project is developed for specific quarry inventarisation use cases.