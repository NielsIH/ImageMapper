/* global document, Blob, URL, Image */

// Utility class to generate a standalone HTML report for a given map, its markers, and associated photos.
// The report includes embedded images and interactive features using only vanilla JS and CSS.

export class HtmlReportGenerator {
  static HTML_REPORT_BASE_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>SnapSpot Report - _MAP_NAME_</title>
<style>
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f8f8f8; }
.container { max-width: 1200px; margin: 0 auto; background: #fff; padding: 30px; border-radius: 8px; box-shadow: 0 0 15px rgba(0,0,0,0.1); }
h1, h2, h3 { color: #222; margin-top: 0; }
header { text-align: center; margin-bottom: 40px; border-bottom: 1px solid #ddd; padding-bottom: 20px; }
.map-section { margin-bottom: 40px; text-align: center; }
.main-map-image { max-width: 100%; height: auto; border: 1px solid #ddd; border-radius: 4px; }
.photo-list-item { display: flex; align-items: flex-start; margin-bottom: 25px; padding: 15px; border: 1px solid #eee; border-radius: 6px; background-color: #fafafa; position: relative; }
.photo-list-item:nth-child(even) { background-color: #f0f0f0; }
.photo-thumbnail-sm { width: 80px; height: 80px; object-fit: cover; margin-right: 15px; border-radius: 4px; border: 1px solid #ddd; flex-shrink: 0; }
.photo-details { flex-grow: 1; }
.photo-details h3 { margin: 0 0 5px 0; font-size: 1.1em; color: #0056b3; }
.photo-details p { margin: 0 0 3px 0; font-size: 0.9em; }
.photo-context-map { width: 100px; height: 100px; object-fit: cover; border: 1px solid #ccc; border-radius: 4px; cursor: pointer; margin-left: 20px; flex-shrink: 0; }
.map-coords { font-family: monospace; background-color: #e6f7ff; padding: 2px 6px; border-radius: 3px; font-size: 0.85em; color: #0056b3; }
.photo-marker-description { font-style: italic; color: #555; }
.footer { text-align: center; margin-top: 50px; font-size: 0.8em; color: #777; }
/* NEW/MODIFIED for contextual map thumbnails */
.photo-context-map-container { /* Added container for label */
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-left: 20px;
    flex-shrink: 0;
}
.context-map-name { /* Label style */
    font-size: 0.8em;
    font-weight: bold;
    color: #555;
    margin-bottom: 5px;
    max-width: 100px; /* Limit width */
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.photo-context-map {
    width: 100px;
    height: 100px;
    object-fit: contain; /* Changed to contain to show full map if aspect ratios differ */
    background-color: #f4f4f4; /* Background for contain */
    border: 1px solid #ccc;
    border-radius: 4px;
    cursor: pointer;
}
.full-map-title { /* NEW: Style for modal title */
    font-size: 1.2em;
    font-weight: bold;
    color: #333;
    margin-bottom: 10px;
    text-align: center;
    max-width: 90%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
/* End NEW/MODIFIED */
/* Modal for larger map view */
.modal-overlay { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 1000; justify-content: center; align-items: center; }
.modal-content-map { background: #fff; padding: 15px; border-radius: 8px; max-width: 95vw; max-height: 95vh; overflow: hidden; position: relative; }
.modal-content-map button.close-btn { position: absolute; top: 10px; right: 10px; background: none; border: none; font-size: 2em; cursor: pointer; color: #555; }
.full-map-canvas-container { border: 1px solid #ddd; background-color: #eee; width: 1000px; height: 750px; max-width: calc(95vw - 30px); max-height: calc(95vh - 30px); position: relative; overflow: hidden; }
.full-map-canvas { display: block; }
.full-map-caption { text-align: center; color: #444; font-size: 1.1em; margin-top: 10px; }
@media (max-width: 768px) {
.full-map-canvas-container { width: 90vw; height: 70vh; }
.photo-list-item { flex-direction: column; align-items: center; }
.photo-thumbnail-sm { margin-right: 0; margin-bottom: 10px; }
.photo-context-map { margin-left: 0; margin-top: 15px; }
.photo-details { text-align: center; }
}
</style>
</head>
<body>
<div class="container">
<header>
<h1>SnapSpot Report</h1>
<p><strong>Map:</strong> _MAP_NAME_ (_MAP_WIDTH_ &times; _MAP_HEIGHT_ px)</p>
<p>Generated on: _GENERATED_DATE_</p>
</header>
<h2>Photos & Locations</h2>
<div id="photo-marker-list">
_PHOTO_MARKER_LIST_HTML_
</div>
<div class="modal-overlay" id="full-map-modal">
<div class="modal-content-map">
                    <button class="close-btn" id="close-full-map-modal">&times;</button>
                    <div class="full-map-title" id="full-map-title"></div> <!-- NEW TITLE ELEMENT -->
                    <div class="full-map-canvas-container">
                        <canvas id="full-map-canvas" class="full-map-canvas"></canvas>
                    </div>
                    <div class="full-map-caption" id="full-map-caption"></div>
                </div>
</div>
<footer>
<div class="container">
<p>&copy; _CURRENT_YEAR_. Report generated from SnapSpot.</p>
</footer>
</div>
<script type="text/javascript">
// Data injected here
const EXPORT_DATA = _EXPORT_DATA_JSON_;
const mapImageBase64 = "_MAP_IMAGE_BASE_64_"; // Base64 map image itself
// ----- Core Logic for Interactive Map (will not break due to variable interpolation) -----
_PHOTO_MAP_SCRIPT_JS_
</script>
</body>
</html>`

  static _PHOTO_MAP_SCRIPT_JS_ = `
    (function() {
        // These variables are already defined in the HTML body script
        // const EXPORT_DATA = _EXPORT_DATA_JSON_;
        // const mapImageBase64 = "_MAP_IMAGE_BASE_64_";

        const fullMapCanvas = document.getElementById('full-map-canvas');
        const fullMapCtx = fullMapCanvas ? fullMapCanvas.getContext('2d') : null; // Check if canvas exists
        const fullMapModal = document.getElementById('full-map-modal');
        const closeFullMapModalBtn = document.getElementById('close-full-map-modal');
        const fullMapCaption = document.getElementById('full-map-caption');
        const fullMapTitle = document.getElementById('full-map-title'); // NEW: Get the title element
        const photoContextMaps = document.querySelectorAll('.photo-context-map');

        const mapBaseImg = new Image();
        mapBaseImg.src = mapImageBase64; // Use the mapImageBase64 defined globally in the template

        let currentMarkerIdInModal = null; // Track which marker is currently displayed in the full map modal

        // Function to draw a marker (re-defined here for clarity, but could be shared)
        const drawMarker = (ctx, marker, scale, offsetX, offsetY, markerNum, isHighlighted = false) => {
            const r = isHighlighted ? 15 : 12; // Increased visual size for highlighted
            const fontSize = isHighlighted ? 18 : 10; // Increased font size for highlighted

            const x = (marker.x * scale) + offsetX;
            const y = (marker.y * scale) + offsetY;

            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2, false);
            ctx.fillStyle = isHighlighted ? 'rgba(255, 0, 0, 0.8)' : 'rgba(0, 0, 255, 0.6)'; // Highlighted: red, Normal: blue
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#FFFFFF';
            ctx.stroke();

            ctx.fillStyle = '#FFFFFF';
            ctx.font = \`bold \${fontSize}px Arial\`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(markerNum), x, y);
        };


        // Map rendering utility
        const renderFullMap = (markerToHighlight = null) => {
            const canvasContainer = fullMapCanvas.parentElement;
            if (!canvasContainer || !fullMapCtx) { return; } // Ensure context is valid

            // Set canvas dimensions to match the displayed image dimensions for better clarity
            fullMapCanvas.width = canvasContainer.clientWidth;
            fullMapCanvas.height = canvasContainer.clientHeight;

            if (!mapBaseImg.complete || mapBaseImg.naturalWidth === 0) {
                mapBaseImg.onload = () => renderFullMap(markerToHighlight);
                return;
            }

            // Fit mapBaseImg to canvas
            const mapAspectRatio = mapBaseImg.naturalWidth / mapBaseImg.naturalHeight;
            const canvasAspectRatio = fullMapCanvas.width / fullMapCanvas.height;

            let drawWidth = fullMapCanvas.width;
            let drawHeight = fullMapCanvas.height;
            let offsetX = 0;
            let offsetY = 0;

            if (mapAspectRatio > canvasAspectRatio) {
                drawHeight = fullMapCanvas.width / mapAspectRatio;
                offsetY = (fullMapCanvas.height - drawHeight) / 2;
            } else {
                drawWidth = fullMapCanvas.height * mapAspectRatio;
                offsetX = (fullMapCanvas.width - drawWidth) / 2;
            }

            fullMapCtx.clearRect(0, 0, fullMapCanvas.width, fullMapCanvas.height);
            fullMapCtx.drawImage(mapBaseImg, offsetX, offsetY, drawWidth, drawHeight);

            // Calculate scale and offsets for drawing markers relative to the fitted image
            const scale = drawWidth / mapBaseImg.naturalWidth;
            const baseOffsetX = offsetX;
            const baseOffsetY = offsetY;

            // Draw the specified marker
            fullMapTitle.textContent = \`Map: \${EXPORT_DATA.map.name}\`; // Always set map name in title

            if (markerToHighlight) {
                const markerNum = EXPORT_DATA.markers.find(m => m.id === markerToHighlight.id).number;
                drawMarker(fullMapCtx, markerToHighlight, scale, baseOffsetX, baseOffsetY, markerNum, true);

                fullMapCaption.textContent = \`Marker #\${markerNum} - \${markerToHighlight.description || ''} (\${markerToHighlight.x.toFixed(0)}, \${markerToHighlight.y.toFixed(0)})\`;
            } else {
                fullMapCaption.textContent = 'Click a context map thumbnail to highlight a marker.'; // Instruction when no marker is highlighted
            }
        };

        // Event listeners for opening full map modal
        photoContextMaps.forEach(mapImg => {
            mapImg.addEventListener('click', () => {
                const markerId = mapImg.dataset.markerId;
                const marker = EXPORT_DATA.markers.find(m => m.id === markerId);
                if (marker) {
                    currentMarkerIdInModal = markerId; // Store reference
                    fullMapModal.style.display = 'flex';
                    renderFullMap(marker);
                } else {
                    console.error('Marker not found for:', markerId);
                }
            });
        });

        // Event listeners for closing full map modal
        if (closeFullMapModalBtn) {
            closeFullMapModalBtn.addEventListener('click', () => {
                fullMapModal.style.display = 'none';
                currentMarkerIdInModal = null; // Clear reference
            });
        }
        if (fullMapModal) {
            fullMapModal.addEventListener('click', (e) => {
                if (e.target === fullMapModal) { // Close if backdrop is clicked
                    fullMapModal.style.display = 'none';
                    currentMarkerIdInModal = null;
                }
            });
        }

        window.addEventListener('resize', () => {
            if (fullMapModal && fullMapModal.style.display === 'flex') {
                const marker = EXPORT_DATA.markers.find(m => m.id === currentMarkerIdInModal);
                renderFullMap(marker);
            }
        });

        // Initial render if modal is somehow open on load
        if (fullMapModal && fullMapModal.style.display === 'flex') {
            const marker = EXPORT_DATA.markers.find(m => m.id === currentMarkerIdInModal);
            renderFullMap(marker);
        }
    })();
    `

  // Static method to generate and download the HTML report
  static async generateReport (map, markers, allPhotos, imageProcessor) {
    console.log(`Generating HTML report for map ID: ${map.id}`)

    // Generate base64 for the main map image
    // You can add these logs for YOUR internal confirmation AFTER the fix
    console.log('DEBUG: In HtmlReportGenerator.generateReport, map object:', map) // Log the WHOLE map object
    console.log('DEBUG: In HtmlReportGenerator.generateReport, map.imageData type:', typeof map.imageData)
    console.log('DEBUG: In HtmlReportGenerator.generateReport, map.imageData instanceOf Blob:', map.imageData instanceof Blob)

    // Generate base64 for the main map image
    const mainMapImageBase64 = await imageProcessor.blobToBase64(map.imageData)

    // --- Generate contextual map thumbnails for each photo ---
    const tempImage = new Image()
    tempImage.src = mainMapImageBase64
    await new Promise(resolve => { tempImage.onload = resolve }) // Ensure image is loaded

    const tempCanvas = document.createElement('canvas') // Offscreen canvas for thumbnails
    const tempCtx = tempCanvas.getContext('2d')
    const THUMBNAIL_SIZE = 100 // Size for the contextual map thumbnail

    async function generateContextMapThumbnail (marker, mapImage, mapWidth, mapHeight) {
      tempCanvas.width = THUMBNAIL_SIZE
      tempCanvas.height = THUMBNAIL_SIZE

      const imageAspectRatio = mapWidth / mapHeight
      const canvasAspectRatio = tempCanvas.width / tempCanvas.height

      let drawWidth, drawHeight, offsetX, offsetY // <-- Original declaration here
      if (imageAspectRatio > canvasAspectRatio) {
        drawWidth = tempCanvas.width
        drawHeight = tempCanvas.width / imageAspectRatio
        offsetX = 0
        offsetY = (tempCanvas.height - drawHeight) / 2
      } else {
        drawHeight = tempCanvas.height
        drawWidth = tempCanvas.height * imageAspectRatio
        offsetX = (tempCanvas.width - drawWidth) / 2
        offsetY = (tempCanvas.height - drawHeight) / 2 // Assumed original had this too based on pattern
        // If your ORIGINAL ORIGINAL code had `offsetY = 0;` here, use that instead.
      }

      tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height)
      tempCtx.drawImage(mapImage, offsetX, offsetY, drawWidth, drawHeight)

      // Draw the marker
      const scale = drawWidth / mapWidth
      const markerX = marker.x * scale + offsetX
      const markerY = marker.y * scale + offsetY
      const radius = 8 // Smaller radius for thumbnail marker

      tempCtx.beginPath()
      tempCtx.arc(markerX, markerY, radius, 0, Math.PI * 2, false)
      tempCtx.fillStyle = 'rgba(255, 0, 0, 0.7)' // Red marker for context map
      tempCtx.fill()
      tempCtx.lineWidth = 1
      tempCtx.strokeStyle = '#FFFFFF'
      tempCtx.stroke()

      const markerNumber = markers.findIndex(m => m.id === marker.id) + 1 // Get marker number
      tempCtx.fillStyle = '#FFFFFF'
      tempCtx.font = 'bold 10px Arial'
      tempCtx.textAlign = 'center'
      tempCtx.textBaseline = 'middle'
      tempCtx.fillText(String(markerNumber), markerX, markerY)

      return tempCanvas.toDataURL('image/png')
    }

    // Add contextMapThumbnail to each photo object
    for (const photo of allPhotos) {
      const parentMarker = markers.find(m => m.id === photo.markerId)
      if (parentMarker) {
        photo.contextMapThumbnail = await generateContextMapThumbnail(
          parentMarker, tempImage, map.width, map.height
        )
      }
    }

    // --- Build _PHOTO_MARKER_LIST_HTML_ ---
    let photoMarkerListHtml = ''
    if (allPhotos.length === 0) {
      photoMarkerListHtml = '<p>No photos or markers available for this map.</p>'
    } else {
      allPhotos.forEach(photo => {
        const marker = markers.find(m => m.id === photo.markerId)
        const markerNumber = marker ? (markers.findIndex(m => m.id === marker.id) + 1) : 'N/A'
        const markerDescription = marker ? marker.description : 'No description'

        photoMarkerListHtml += `
                    <div class="photo-list-item">
                        <img src="${photo.imageDataUrl}" alt="Photo from Marker ${markerNumber}" class="photo-thumbnail-sm">
                        <div class="photo-details">
                            <h3>${photo.fileName}</h3>
                            <p><strong>Marker #<span class="marker-number">${markerNumber}</span></strong>: <span class="photo-marker-description">${markerDescription}</span></p>
                            <p>Map Coordinates: <span class="map-coords">X: ${marker ? marker.x.toFixed(0) : 'N/A'}, Y: ${marker ? marker.y.toFixed(0) : 'N/A'}</span></p>
                            <p>Added: ${new Date(photo.createdDate).toLocaleString()}</p>
                        </div>
                        ${marker && photo.contextMapThumbnail
? `
                            <div class="photo-context-map-container">
                                <div class="context-map-name">${map.name}</div>
                                <img src="${photo.contextMapThumbnail}"
                                     alt="Map: ${map.name} - Context for Photo ${photo.fileName}"
                                     title="Map: ${map.name} - Click to view on full map"
                                     class="photo-context-map"
                                     data-marker-id="${marker.id}"
                                 data-photo-id="${photo.id}"
                                 data-marker-x="${marker.x}"
                                 data-marker-y="${marker.y}">
                            </div>
                        `
: ''}
                    </div>
                `
      })
    }

    // --- Prepare EXPORT_DATA_JSON_ for JS embedding ---
    // Include simplified marker and photo data. Markers need their number for display.
    const exportMarkers = markers.map((m, index) => ({
      id: m.id,
      x: m.x,
      y: m.y,
      description: m.description,
      number: index + 1 // Add the display number
    }))

    const exportPhotos = allPhotos.map(p => ({
      id: p.id,
      fileName: p.fileName,
      markerId: p.markerId,
      imageDataUrl: p.imageDataUrl,
      originalWidth: p.originalWidth,
      originalHeight: p.originalHeight
    }))

    const exportData = {
      map: {
        id: map.id,
        name: map.name,
        width: map.width,
        height: map.height,
        imageDataUrl: mainMapImageBase64 // The full map image
      },
      markers: exportMarkers,
      photos: exportPhotos
    }

    // --- Populate the HTML template ---
    let htmlContent = HtmlReportGenerator.HTML_REPORT_BASE_TEMPLATE

    htmlContent = htmlContent.replace(/_MAP_NAME_/g, map.name || 'Untitled Map')
    htmlContent = htmlContent.replace(/_MAP_WIDTH_/g, map.width)
    htmlContent = htmlContent.replace(/_MAP_HEIGHT_/g, map.height)
    htmlContent = htmlContent.replace(/_GENERATED_DATE_/g, new Date().toLocaleString())
    htmlContent = htmlContent.replace(/_PHOTO_MARKER_LIST_HTML_/g, photoMarkerListHtml)
    htmlContent = htmlContent.replace(/_EXPORT_DATA_JSON_/g, JSON.stringify(exportData))
    htmlContent = htmlContent.replace(/_MAP_IMAGE_BASE_64_/g, mainMapImageBase64) // Main map image
    htmlContent = htmlContent.replace(/_PHOTO_MAP_SCRIPT_JS_/g, HtmlReportGenerator._PHOTO_MAP_SCRIPT_JS_) // Embedded JS
    htmlContent = htmlContent.replace(/_CURRENT_YEAR_/g, new Date().getFullYear()) // Current year for footer

    // Create a Blob and trigger download
    const blob = new Blob([htmlContent], { type: 'text/html' })
    const url = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = url
    a.download = `SnapSpot_Report_${map.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.html`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    console.log('HTML report generated and download initiated.')
  }
}
