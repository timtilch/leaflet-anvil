import * as L from 'leaflet';
import { Anvil, ANVIL_EVENTS, AnvilMode } from '../src';
import 'leaflet/dist/leaflet.css';

const map = L.map('map').setView([51.505, -0.09], 13);
const demoLayers = L.featureGroup();

const MODE_HINTS: Record<AnvilMode, { title: string; description: string; tip: string }> = {
    [AnvilMode.Marker]: {
        title: 'Marker',
        description: 'Places a single marker at the clicked location.',
        tip: 'Good for points of interest or anchor locations.',
    },
    [AnvilMode.Polyline]: {
        title: 'Line',
        description: 'Builds a line step by step with each click.',
        tip: 'Press Enter to finish or Escape to cancel.',
    },
    [AnvilMode.Polygon]: {
        title: 'Polygon',
        description: 'Creates a closed area from multiple clicked vertices.',
        tip: 'Click the first point again to close the shape.',
    },
    [AnvilMode.Rectangle]: {
        title: 'Rectangle',
        description: 'Draws a rectangle by dragging from one corner to the opposite one.',
        tip: 'Useful for quick box selections or extents.',
    },
    [AnvilMode.Square]: {
        title: 'Square',
        description: 'Draws a square with a fixed aspect ratio.',
        tip: 'Drag outward from the starting corner.',
    },
    [AnvilMode.Triangle]: {
        title: 'Triangle',
        description: 'Creates a triangle from a drag gesture.',
        tip: 'The base stays on the start edge while the tip follows the cursor.',
    },
    [AnvilMode.Circle]: {
        title: 'Circle',
        description: 'Creates a circle from center point and radius.',
        tip: 'Click-drag-release to define the final radius.',
    },
    [AnvilMode.Freehand]: {
        title: 'Freehand',
        description: 'Lets you sketch an area with a continuous hand-drawn motion.',
        tip: 'Hold the mouse button and draw in one gesture.',
    },
    [AnvilMode.Cut]: {
        title: 'Cut',
        description: 'Draws a cut shape that removes overlapping polygon parts.',
        tip: 'Close the cut geometry to apply the operation.',
    },
    [AnvilMode.Split]: {
        title: 'Split',
        description: 'Draws a line that splits intersected polygons into parts.',
        tip: 'Finish near the last point or click the split handle.',
    },
    [AnvilMode.Drag]: {
        title: 'Drag',
        description: 'Moves existing geometries directly on the map.',
        tip: 'Try it on the seeded demo layers to see the highlight color.',
    },
    [AnvilMode.Scale]: {
        title: 'Scale',
        description: 'Scales a selected geometry relative to its center.',
        tip: 'Drag away from the center to enlarge, toward it to shrink.',
    },
    [AnvilMode.Rotate]: {
        title: 'Rotate',
        description: 'Rotates a selected geometry around its center point.',
        tip: 'Best tested with polygons or polylines.',
    },
    [AnvilMode.Union]: {
        title: 'Union',
        description: 'Merges the next two selected polygons into one result.',
        tip: 'Click one polygon, then another overlapping polygon.',
    },
    [AnvilMode.Subtract]: {
        title: 'Subtract',
        description: 'Subtracts the second selected polygon from the first one.',
        tip: 'The first click defines the base geometry.',
    },
    [AnvilMode.Edit]: {
        title: 'Edit',
        description: 'Selects geometries and exposes draggable edit handles.',
        tip: 'Shift-click keeps multiple geometries selected.',
    },
    [AnvilMode.Delete]: {
        title: 'Delete',
        description: 'Removes a clicked layer immediately.',
        tip: 'Use with care on the demo layers.',
    },
    [AnvilMode.Off]: {
        title: 'Off',
        description: 'Disables the current tool and returns to neutral state.',
        tip: 'Pick any tool on the left to continue.',
    },
};

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
}).addTo(map);

L.polygon([
    [51.509, -0.11],
    [51.513, -0.1],
    [51.507, -0.082],
    [51.501, -0.097],
], {
    color: '#f97316',
    fillColor: '#fdba74',
    fillOpacity: 0.35,
    weight: 3,
}).addTo(demoLayers);

L.polyline([
    [51.5, -0.13],
    [51.502, -0.116],
    [51.497, -0.102],
    [51.499, -0.085],
], {
    color: '#0f766e',
    weight: 5,
}).addTo(demoLayers);

L.circle([51.514, -0.075], {
    radius: 220,
    color: '#2563eb',
    fillColor: '#93c5fd',
    fillOpacity: 0.25,
    weight: 3,
}).addTo(demoLayers);

L.marker([51.504, -0.065], {
    icon: L.divIcon({
        className: 'custom-marker-shell',
        html: '<div class="custom-marker-dot"></div>',
        iconSize: [18, 18],
        iconAnchor: [9, 9],
    }),
}).addTo(demoLayers);

// Initialize Anvil
const anvil = new Anvil(map, {
    layerGroup: demoLayers,
    snapping: true,
    snapDistance: 15,
    preventSelfIntersection: true,
    controlPosition: 'topleft',
    pathOptions: {
        color: '#334155',
        weight: 3,
        fillColor: '#94a3b8',
        fillOpacity: 0.18,
    },
    ghostPathOptions: {
        dashArray: '6 4',
        opacity: 0.75,
    },
    modeStyles: {
        [AnvilMode.Marker]: {
            vertexOptions: {
                icon: L.divIcon({
                    className: 'custom-marker-shell',
                    html: '<div class="custom-marker-dot custom-marker-dot--draw"></div>',
                    iconSize: [18, 18],
                    iconAnchor: [9, 9],
                }),
            },
        },
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
        [AnvilMode.Rectangle]: {
            pathOptions: {
                color: '#7c3aed',
                fillColor: '#c4b5fd',
                fillOpacity: 0.24,
            },
        },
        [AnvilMode.Circle]: {
            pathOptions: {
                color: '#2563eb',
                fillColor: '#93c5fd',
                fillOpacity: 0.25,
            },
        },
        [AnvilMode.Freehand]: {
            pathOptions: {
                color: '#16a34a',
                fillColor: '#86efac',
                fillOpacity: 0.25,
            },
            ghostPathOptions: {
                color: '#16a34a',
                dashArray: '10 6',
            },
        },
        [AnvilMode.Cut]: {
            pathOptions: {
                color: '#dc2626',
                weight: 4,
            },
            ghostPathOptions: {
                color: '#dc2626',
            },
            handleOptions: {
                color: '#dc2626',
            },
        },
        [AnvilMode.Split]: {
            pathOptions: {
                color: '#9333ea',
                weight: 4,
            },
            ghostPathOptions: {
                color: '#9333ea',
            },
            handleOptions: {
                color: '#9333ea',
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
        [AnvilMode.Drag]: {
            selectionPathOptions: {
                color: '#f59e0b',
                weight: 5,
            },
        },
        [AnvilMode.Scale]: {
            selectionPathOptions: {
                color: '#14b8a6',
                weight: 5,
            },
        },
        [AnvilMode.Rotate]: {
            selectionPathOptions: {
                color: '#8b5cf6',
                weight: 5,
            },
        },
        [AnvilMode.Union]: {
            selectionPathOptions: {
                color: '#c026d3',
                weight: 5,
            },
        },
        [AnvilMode.Subtract]: {
            selectionPathOptions: {
                color: '#dc2626',
                weight: 5,
            },
        },
    },
    modes: [
        [
            AnvilMode.Marker,
            AnvilMode.Polyline,
            AnvilMode.Polygon,
            AnvilMode.Freehand,
        ],
        [
            AnvilMode.Rectangle,
            AnvilMode.Square,
            AnvilMode.Triangle,
            AnvilMode.Circle,
        ],
        [
            AnvilMode.Edit,
            AnvilMode.Drag,
            AnvilMode.Scale,
            AnvilMode.Rotate,
        ],
        [
            AnvilMode.Cut,
            AnvilMode.Split,
            AnvilMode.Union,
            AnvilMode.Subtract,
        ],
        [
            AnvilMode.Delete,
        ],
    ],
});

const hint = document.getElementById('hint');

function renderHint(mode: AnvilMode | null): void {
    if (!hint) return;

    const content = mode ? MODE_HINTS[mode] : {
        title: 'Choose a Mode',
        description: 'This demo seeds a few geometries and shows per-mode drawing plus selection styling.',
        tip: 'Use the toolbar on the left to explore how each mode behaves.',
    };

    hint.innerHTML = `
        <div class="example-hint__eyebrow">Leaflet Anvil Demo</div>
        <div class="example-hint__title">${content.title}</div>
        <div class="example-hint__body">${content.description}</div>
        <div class="example-hint__tip">${content.tip}</div>
    `;
}

renderHint(null);
map.on(ANVIL_EVENTS.MODE_CHANGE, (event: { mode: AnvilMode | null }) => {
    renderHint(event.mode);
});

console.log('Leaflet Anvil Example started!');
