# SnapSpot instructions

## Getting started

### Adding a map

To start using SnapSpot you start with adding a map. This can be done by uploading an image of a map or floor plan. The map can be any image file (JPEG, PNG, etc.).
The first map is added using the homescreen. After the first map is added, you can add more maps using "Settings -> Map Management -> Add New Map"

### Setting the active map

When adding a map it is automatically set as the active map. You can change the active map by selecting "Settings -> Map Management" and clicking on a map from the list.

### Adding a marker to the map

Put the crosshair on the position where you want to add a marker and click the round blue button with the pin. This will add a marker to the map at the current position of the crosshair. To change the position of a placed marker click the button with the lock. This will allow you to drag the marker to a new position. When you're done press the button again to lock the markers in place.

### Adding photo(s) to a marker

Click on a marker on the map. The marker details window opens. Use the "Add Photos" button to add photos to the marker. You can add multiple photos to a marker. Pick photos you have taken previously with your device. You can also take a new photo using the camera but this will add the photo directly in reduced quality to SnapSpot. The high quality photo will not be stored seperately on your device. The photos will be displayed in the marker details window. Click on a photo to view it in a larger window. Press the button with the red cross in the corner to delete a photo. Add a description to the marker using the "Edit marker" button.
Using the "Delete Marker" button will delete the marker and the associated photo(s). The original photos will remain on the device.

### Tips for navigation

Rotate the map according to your orientation using the blue "Rotation" button. Use an appropriate zoom level by using the zoom buttons, the mouse scroll wheel or your fingers on mobile. When moving to a new position put the crosshair on the position you are going to move to first and then walk to the new position. Place a marker, take photo(s) and add the photo(s) to the marker.

### Using the search function

You can search for specific photo(s) and maps by clicking the "Search button". Use the "Chose file" button to select a photo on your device and the search will find the exact marker on the map where the photo was added. This is useful when you recognize a certain feature that you have taken a photo of and want to find your exact location on the map.
You can also search for a specific map by typing the name of the map in the search field.

## Maps and markers management

### Exporting a map with markers and photo(s)

Go to "Settings -> Maps management". Select the map you want to export. Click on the "Export" button. This is the button with the Disk icon. The map will be exported as a JSON file. The file will be saved in the "Downloads" folder of your device. The file will contain the map, the markers and the photos. The photos will be included as Base64 strings in the JSON file.
When the map has markers placed on different dates you will have the option to export:

- The complete map with all the markers
- Only the map with the markers that were placed on a specific date

### HTML Report

Go to "Settings -> Maps management". Select the map you want to export. Click on the "Report" button. This is the button with the document icon. This will create a HTML report with the filename(s) of the photo(s) with thumbnails and a clickable image of the map with the marker position where the specific photo was taken.This can be used as a reference when entering the data in another system manually.


### Importing a map with markers and photo(s)

Go to "Settings -> Data management". Click on the "Import map data" button. Select the JSON file you want to import. The map will be imported, set as active and will be available in the "Maps management" section. When importing a map that you already have in SnapSpot you will have the option to merge the markers and photos with the existing ones or import them as a new map. Choose the merge option when for example you just want to add another team member's markers and photos to your own map.

### Sharing export files offline

You can share SnapSpot export files with team members without internet access by sharing via bluetooth. For underground work this can be very usefull.