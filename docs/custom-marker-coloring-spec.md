# Feature Specification: Custom Marker Coloring

## 1. Introduction
This document outlines the specification for the Custom Marker Coloring feature in the SnapSpot PWA. This feature allows users to define rules based on marker description content to assign custom colors to markers, enhancing visual organization and identification on the map.

## 2. Goals
- Provide users with the ability to customize marker colors based on specific conditions.
- Improve map readability and marker differentiation.
- Ensure a user-friendly configuration interface within the application settings.
- Maintain backward compatibility and prevent data loss for existing users.

## 3. Scope
- **Global Setting:** Custom marker coloring rules will apply globally across all maps.
- **Configuration:** Rules will be configurable via the "Map Display" tab in the main application settings modal.
- **Rule Limit:** A maximum of 5 custom coloring rules will be supported.
- **Conditions:** Rules will be based solely on the marker's `description` field.
- **Color Palette:** A predefined set of distinct colors will be available for selection.

## 4. Detailed Specification

### 4.1. Rule Structure
Each custom marker coloring rule will be represented as a JavaScript object with the following properties:

```javascript
{
  id: string, // Unique identifier for the rule (e.g., 'rule_1', 'rule_2')
  field: 'description', // The marker field to evaluate (fixed to 'description' for now)
  operator: 'isEmpty' | 'isNotEmpty' | 'contains', // The comparison operator
  value: string | null, // The string to match for 'contains', or null for 'isEmpty'/'isNotEmpty'
  color: string // Hex code of the custom color (e.g., '#FF0000')
}
```

### 4.2. Operators
- `isEmpty`: The rule applies if the marker's `description` field is an empty string or `null`.
- `isNotEmpty`: The rule applies if the marker's `description` field is not an empty string and not `null`.
- `contains`: The rule applies if the marker's `description` field (case-insensitive) contains the specified `value` string.

### 4.3. Predefined Color Palette
The following distinct colors will be available for users to choose from. These colors have been selected to avoid conflict with existing marker states (locked/unlocked, with/without photos, and highlight color).

- Cyan/Aqua: `#06B6D4`
- Lime Green: `#84CC16`
- Pink: `#EC4899`
- Indigo: `#6366F1`
- Emerald Green: `#10B981`
- Rose: `#F43F5E`
- Violet: `#8B5CF6`

### 4.4. Rule Precedence
- Rules will be evaluated in the order they are displayed/stored (from top to bottom in the UI).
- If multiple rules match a single marker, the color from the **last matching rule** in the list will be applied.
- If no custom rules match a marker, the marker will revert to its default coloring logic based on its `isEditable` and `hasPhotos` properties.

### 4.5. Storage
- The array of custom marker coloring rules will be stored as a JSON string in `localStorage` under a dedicated key (e.g., `customMarkerColorRules`).
- This approach avoids any schema changes to IndexedDB, ensuring backward compatibility and preventing data loss for existing user data.

### 4.6. User Interface (UI)
- A new section will be added to the "Map Display" tab within the main settings modal.
- This section will display 5 fixed rows, each representing a potential custom coloring rule.
- Each row will contain:
    - A dropdown (`<select>`) for the `operator` (options: "None", "Description is empty", "Description is not empty", "Description contains..."). Selecting "None" will disable the rule.
    - A text input (`<input type="text">`) for the `value` (enabled only when "Description contains..." is selected).
    - A dropdown (`<select>`) for the `color` (displaying the predefined color names and their corresponding visual swatches).
- Changes to these form elements will automatically update the `localStorage` setting.
- The UI will be responsive, adapting to different screen sizes. On smaller viewports, the elements within each rule row will stack vertically to ensure usability.

### 4.7. Application Logic
- `app.js` will be responsible for loading and saving the `customMarkerColorRules` from/to `localStorage`.
- `app.js` will pass these rules to `mapRenderer.js` when updating the map and markers.
- `mapRenderer.js`'s `drawMarker` function will be modified to:
    1. Receive the `customMarkerColorRules`.
    2. Iterate through the rules in reverse order.
    3. For each rule, evaluate if the marker's `description` meets the specified condition.
    4. If a rule matches, apply its `color` to the marker (for `borderColor`, `fillColor`, and `textColor`) and stop further rule evaluation for that marker.
    5. If no custom rule matches, proceed with the existing coloring logic based on `isEditable` and `hasPhotos`.

## 5. Backward Compatibility & Migration
- Storing rules in `localStorage` means no IndexedDB schema migration is necessary for this feature.
- Existing users will simply have an empty `customMarkerColorRules` entry in `localStorage` (or no entry at all), which will default to no custom coloring, thus preserving their current experience.
- Importing older map exports will not be affected as the rules are global and not embedded in map data.

## 6. Future Considerations
- Expanding conditions to other marker fields (e.g., name, photo count).
- Allowing users to define custom hex codes instead of a predefined palette.
- Implementing dynamic rule addition/deletion and reordering in the UI.
- Adding a preview of the custom colored marker in the settings UI.
