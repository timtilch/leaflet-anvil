import * as L from 'leaflet';
import { Anvil, AnvilMode } from '../src';
import 'leaflet/dist/leaflet.css';

const map = L.map('map').setView([51.505, -0.09], 13);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
}).addTo(map);

// Initialize Anvil
const anvil = new Anvil(map, {
    snapping: true,
    snapDistance: 15,
    magnetic: true,
    preventSelfIntersection: true,
    controlPosition: 'topleft',
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

console.log('Leaflet Anvil Example started!');
