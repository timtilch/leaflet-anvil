import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Anvil, anvilControl } from '../src';

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
});

// Add Controls
const control = anvilControl(anvil);
control.addTo(map);

console.log('Leaflet Anvil Example started!');
