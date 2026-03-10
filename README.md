# Leaflet Anvil 🛠️

A minimalist, powerful toolkit for drawing and editing geometries in [Leaflet](https://leafletjs.com/). Focused on a clean API, modern
TypeScript features, and support for complex geometric operations like Union and Subtract.

## Features

- **Drawing Modes**: Marker, Polylines, Polygons, Rectangles, Squares, Triangles, Circles, and Freehand Drawing.
- **Editing Tools**: Drag, Scale, Rotate, and Vertex editing.
- **Geometric Operations**:
    - `Union`: Merge two polygons into one.
    - `Subtract`: Subtract one polygon from another.
    - `Cut` & `Split`: Cut lines or split areas.
- **Smart Helpers**: Snapping to existing points and Magnetic mode.
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
    magnetic: true,
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
| **Transform** | `Edit`           | Edit individual vertices.                                |
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
| `magnetic`                | `boolean` | `false`     | **Magnetism:** Enhances snapping behavior. Points are actively attracted once they enter the radius.                 |
| `preventSelfIntersection` | `boolean` | `false`     | **Validation:** Prevents edges from self-intersecting in polygons and lines. Blocks invalid segments during drawing. |
| `controlPosition`         | `string`  | `'topleft'` | Determines the position of the toolbar on the map (e.g., `'topright'`).                                              |
| `modes`                   | `Array`   | `All`       | Defines which buttons appear in the toolbar. Supports nested arrays for button groups (blocks).                      |

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
