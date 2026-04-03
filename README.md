# Leaflet Anvil 🛠️

A minimalist, powerful toolkit for drawing and editing geometries in [Leaflet](https://leafletjs.com/). Focused on a clean API, modern
TypeScript features, and support for complex geometric operations like Union and Subtract.

> Leaflet Anvil is currently a work in progress. Feedback, ideas, and bug reports are very welcome.
> The API and overall behavior are planned to be considered stable starting with `v1.0.0`.

## Features

- **Drawing Modes**: Marker, Polylines, Polygons, Rectangles, Squares, Triangles, Circles, and Freehand Drawing.
- **Editing Tools**: Drag, Scale, Rotate, vertex editing, and full-layer topology editing.
- **Geometric Operations**:
    - `Union`: Merge two polygons into one.
    - `Subtract`: Subtract one polygon from another.
    - `Cut` & `Split`: Cut lines or split areas.
- **Smart Helpers**: Snapping to existing points, topology-aware splitting, and linked vertices across touching layers while editing.
- **Event-driven**: Easy integration through a consistent event system.

## Installation

```bash
npm install leaflet-anvil
```

*Note: Leaflet is a peer dependency and must be installed separately.*

## Quick Start

```typescript
import L from 'leaflet';
import { Anvil, AnvilMode } from 'leaflet-anvil';

const map = L.map('map').setView([51.505, -0.09], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

// Initialize Anvil
const anvil = new Anvil(map, {
    snapping: true,
    snapDistance: 15,
    preventSelfIntersection: true,
    controlPosition: 'topleft',
    modes: [
        [AnvilMode.Polygon, AnvilMode.Marker],
        [AnvilMode.Edit, AnvilMode.Delete]
    ]
});

// Enable a mode
anvil.enable(AnvilMode.Polygon);

// React to events
map.on('anvil:created', (e) => {
    console.log('New layer created:', e.layer);
});
```

## Available Modes

Activation via `anvil.enable(AnvilMode.Name)` or through the UI toolbar:

|   Category    | Mode (AnvilMode) | Description                                              |
|:-------------:|:-----------------|:---------------------------------------------------------|
|  **Drawing**  | `Marker`         | Places a marker on the map.                              |
|               | `Polyline`       | Creates line strings by clicking.                        |
|               | `Polygon`        | Creates closed surfaces.                                 |
|               | `Freehand`       | Draws lines/surfaces by holding the mouse button.        |
|  **Shapes**   | `Rectangle`      | Creates a rectangle (2-point).                           |
|               | `Square`         | Creates a square with a fixed aspect ratio.              |
|               | `Triangle`       | Creates a triangle.                                      |
|               | `Circle`         | Creates a circle with radius determination.              |
| **Transform** | `Edit`           | Edit selected geometries vertex-by-vertex.               |
|               | `Topology`       | Edit the whole layer group with linked vertices across touching layers. |
|               | `Drag`           | Move entire geometries on the map.                       |
|               | `Scale`          | Proportional resizing (scaling).                         |
|               | `Rotate`         | Rotate geometries around their center.                   |
| **Geometry**  | `Cut`            | Cut lines or surfaces at a point.                        |
|               | `Split`          | Split a geometry by a drawn line.                        |
|               | `Union`          | Merge the next two clicked polygons.                     |
|               | `Subtract`       | The second clicked polygon is subtracted from the first. |
|  **Actions**  | `Delete`         | Deletes the clicked layer immediately.                   |

## Configuration (AnvilOptions)

| Option                    | Type      | Default     | Description                                                                                                          |
|:--------------------------|:----------|:------------|:---------------------------------------------------------------------------------------------------------------------|
| `snapping`                | `boolean` | `false`     | **Snapping:** If `true`, new points automatically snap to existing vertices of other geometries.                     |
| `snapDistance`            | `number`  | `10`        | **Snap Distance:** Determines the distance in pixels at which a point "jumps" to the nearest existing vertex.        |
| `preventSelfIntersection` | `boolean` | `false`     | **Validation:** Prevents edges from self-intersecting in polygons and lines. Blocks invalid segments during drawing. |
| `pathOptions`             | `object`  | `Leaflet`   | Global fallback styles for path-based layers such as polygons, lines, rectangles and circles.                        |
| `ghostPathOptions`        | `object`  | `Inherited` | Global fallback styles for temporary preview geometry while drawing.                                                  |
| `vertexOptions`           | `object`  | `Leaflet`   | Global fallback marker options for marker-based drawing.                                                              |
| `modeStyles`              | `object`  | `{}`        | Per-mode style overrides for drawing, handles and active selection/highlight states.                                  |
| `controlPosition`         | `string`  | `'topleft'` | Determines the position of the toolbar on the map (e.g., `'topright'`).                                              |
| `modes`                   | `Array`   | `All`       | Defines which buttons appear in the toolbar. Supports nested arrays for button groups (blocks).                      |
| `modeTooltips`            | `object \\| function` | `Defaults` | Overrides toolbar button tooltips. Missing values keep the built-in defaults. Use a function if translations can change after initialization. |

### Mode-Specific Styles

Global `pathOptions`, `ghostPathOptions` and `vertexOptions` still work as shared defaults.
With `modeStyles`, you can override them per mode.

Supported per-mode keys:

- `pathOptions`: Final style of created path layers for that mode.
- `ghostPathOptions`: Temporary preview style while drawing.
- `vertexOptions`: Marker options for marker-based modes.
- `handleOptions`: Options for helper handles such as polygon close handles or edit handles.
- `selectionPathOptions`: Highlight style for selected/active geometry in modes like `Edit`, `Topology`, `Drag`, `Scale`, `Rotate`, `Union` and `Subtract`.

```typescript
const anvil = new Anvil(map, {
    pathOptions: {
        color: '#334155',
        weight: 3,
    },
    ghostPathOptions: {
        dashArray: '6 4',
        opacity: 0.7,
    },
    modeStyles: {
        [AnvilMode.Polyline]: {
            pathOptions: {
                color: '#0f766e',
                weight: 5,
            },
        },
        [AnvilMode.Polygon]: {
            pathOptions: {
                color: '#ea580c',
                fillColor: '#fdba74',
                fillOpacity: 0.35,
            },
            handleOptions: {
                radius: 6,
                color: '#ea580c',
            },
        },
        [AnvilMode.Edit]: {
            selectionPathOptions: {
                color: '#db2777',
                weight: 4,
            },
            handleOptions: {
                color: '#db2777',
                fillColor: '#fff7fb',
                radius: 6,
            },
        },
        [AnvilMode.Topology]: {
            selectionPathOptions: {
                color: '#0891b2',
                weight: 3,
            },
            handleOptions: {
                color: '#0891b2',
                fillColor: '#ecfeff',
                radius: 5,
            },
        },
        [AnvilMode.Rotate]: {
            selectionPathOptions: {
                color: '#8b5cf6',
                weight: 5,
            },
        },
        [AnvilMode.Marker]: {
            vertexOptions: {
                icon: L.divIcon({
                    className: 'custom-marker',
                    html: '<div class="marker-dot"></div>',
                    iconSize: [16, 16],
                    iconAnchor: [8, 8],
                }),
            },
        },
    },
});
```

If you want to style the active highlight of interaction modes, use `selectionPathOptions`.
That is what controls the temporary emphasis color when a geometry is selected in modes such as `Edit` or while actively transforming it in `Topology`, `Drag`, `Scale`, `Rotate`, `Union` or `Subtract`.

### Custom Toolbar Tooltips

For simple overrides, pass a static map:

```typescript
const anvil = new Anvil(map, {
    modeTooltips: {
        [AnvilMode.Edit]: 'Edit geometry',
        [AnvilMode.Delete]: 'Remove geometry',
        [AnvilMode.Off]: 'Disable tools',
    },
});
```

If your app language can change after `Anvil` has been created, pass a resolver instead.
The toolbar re-reads the tooltip when a button is focused or hovered, so the next interaction uses the current language without recreating the control.
The second argument is the built-in default tooltip, so you can preserve defaults without duplicating them.

```typescript
const anvil = new Anvil(map, {
    modeTooltips: (mode, fallback) => i18n.t(`mapTools.${mode}`, fallback),
});
```

### Events (`ANVIL_EVENTS`)

All events are fired on the Leaflet map:

- `anvil:created`: When a new layer has been finalized.
- `anvil:edited`: When a layer has been modified (drag/rotate/edit/scale).
- `anvil:deleted`: When a layer has been removed.
- `anvil:modechange`: When the active mode changes.

## Development

```bash
# Install dependencies
npm install

# Development server (Vite)
npm run dev

# Run tests
npm test

# Create build
npm run build
```

## License

MIT
