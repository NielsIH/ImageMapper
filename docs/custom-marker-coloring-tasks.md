# Implementation Tasks: Custom Marker Coloring

This document outlines the step-by-step tasks required to implement the Custom Marker Coloring feature as specified in `custom-marker-coloring-spec.md`.

## 1. Preparation & Setup

- [ ] **Increment IndexedDB Version (Storage.js)**
  - Update `this.version` from `3` to `4` in `js/storage.js`. (Note: While this feature uses `localStorage`, general IndexedDB schema evolution often warrants a version bump. No specific migration logic for `customMarkerColorRules` is needed in `onupgradeneeded` for this feature, as it's stored in `localStorage`.)

## 2. Global Settings Management (app.js)

- [ ] **Define Predefined Colors & Operators**
  - In `app.js`, define an array of color objects (e.g., `{ name: 'Cyan', hex: '#06B6D4' }`).
  - Define the available operators (e.g., `['isEmpty', 'isNotEmpty', 'contains']`).

- [ ] **Implement `localStorage` Load/Save Functions**
  - Add `getCustomMarkerColorRules()` to `app.js` to load rules from `localStorage`.
  - Add `setCustomMarkerColorRules(rules)` to `app.js` to save rules to `localStorage`.
  - Implement default rules (empty array) if no rules are found in `localStorage`.

- [ ] **Integrate with `app.js` Initialization**
  - In `app.init()`, load the `customMarkerColorRules`.
  - Ensure `app.js` passes the loaded `customMarkerColorRules` to `mapRenderer` (e.g., via a new method `setCustomColorRules` or an updated `setMarkers` call).

## 3. Settings Modal UI (ui/modals.js)

- [ ] **Update `createSettingsModal` HTML**
  - In `ui/modals.js`, locate the `map-display-settings` tab pane.
  - Add a new section for "Custom Marker Coloring" rules.
  - Generate HTML for 5 fixed rows, each containing:
    - A `<select>` for the condition operator (options: "None", "Description is empty", "Description is not empty", "Description contains...").
    - An `<input type="text">` for the `value` (initially disabled, enabled when "Description contains..." is selected).
    - A `<select>` for the color (dynamically populated with predefined colors).

- [ ] **Implement UI Logic for Rules**
  - In `setupSettingsModal`, retrieve the `customMarkerColorRules` from `app.js` (via callbacks).
  - Populate the UI rows with existing rules.
  - Add event listeners to the operator dropdowns, value input fields, and color dropdowns in each row.
  - When a rule is modified, update the `customMarkerColorRules` array and save it to `localStorage` via an `app.js` callback.
  - Implement logic to enable/disable the `value` input field based on the selected operator.
  - Generate unique `id`s for rules when they are newly created or modified implicitly by the UI.

- [ ] **Styling (css/modals.css)**
  - Add necessary CSS rules in `css/modals.css` or `css/modals/settings.css` to style the new settings elements (e.g., rule rows, color swatches in dropdowns).
- [ ] **Implement Responsive UI for Rule Rows**
  - Apply CSS media queries to `css/modals.css` or `css/modals/settings.css` to ensure the rule rows adapt to different screen sizes. On smaller viewports, stack the operator dropdown, value input, and color dropdown vertically within each rule row.

## 4. Marker Rendering Logic (mapRenderer.js)

- [ ] **Update `MapRenderer` Class**
  - Add a new property `this.customColorRules = []` to the `MapRenderer` constructor.
  - Add a new method `setCustomColorRules(rules)` to `MapRenderer` to update this property.

- [ ] **Modify `drawMarker` Function**
  - Update `drawMarker` to accept the marker object directly (or at least its `description`).
  - Integrate the logic to iterate through `this.customColorRules` in reverse order.
  - For each rule, evaluate if the marker's `description` matches the condition (`isEmpty`, `isNotEmpty`, `contains`).
  - If a match is found, apply the rule's `color` to `borderColor`, `fillColor`, and `textColor` for the marker, and break out of the loop (as the last rule matching takes precedence).
  - If no custom rule matches, retain the existing coloring logic based on `isEditable` and `hasPhotos`.

## 5. App Integration & Data Flow (app.js)

- [ ] **Adapt `displayMap` and `refreshMarkersDisplay`**
  - Ensure these methods (and any others that trigger marker rendering) pass the `customColorRules` down to `mapRenderer`.

- [ ] **Update Settings Callbacks**
  - `app.js`'s `showSettings` method should pass callbacks to `ModalManager.createSettingsModal` for getting and setting `customMarkerColorRules`.

## 6. Testing

- [ ] **Manual Testing**
  - Verify that custom rules can be added, modified, and deleted via the settings UI.
  - Test with different operators and values.
  - Confirm that markers on the map correctly reflect the custom colors based on their description.
  - Verify rule precedence (last rule wins).
  - Test that markers unmatched by custom rules fall back to existing coloring.
  - Verify that existing markers/maps do not lose data or break due to this feature.
  - Test saving/loading rules across app sessions (due to `localStorage`).
  - Test importing older JSON exports to ensure `customMarkerColorRules` is handled gracefully.

