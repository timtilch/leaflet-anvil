/**
 * Minimal Leaflet mock for unit tests (jsdom-Umgebung hat kein Canvas/SVG-Rendering).
 * Wir mocken die relevanten Teile so, dass alle Klassen instanziierbar und testbar sind.
 */

import * as L from 'leaflet';
import { vi } from 'vitest';

// ─── Container ────────────────────────────────────────────────────────────────
export function createContainer(): HTMLElement {
    const el = document.createElement('div');
    el.style.width = '800px';
    el.style.height = '600px';
    document.body.appendChild(el);
    return el;
}

// ─── Map mock ─────────────────────────────────────────────────────────────────
export function createMap(): L.Map {
    const container = createContainer();

    // jsdom kennt kein echtes Layout → wir patchen getBoundingClientRect
    container.getBoundingClientRect = () => ({
        top: 0, left: 0, bottom: 600, right: 800,
        width: 800, height: 600,
        x: 0, y: 0,
        toJSON: () => ({}),
    });

    const map = L.map(container, {
        center: [51.505, -0.09],
        zoom: 13,
        // Renderer deaktivieren, da jsdom kein Canvas/SVG hat
        renderer: undefined as unknown as L.Renderer,
    });

    // latLngToContainerPoint  stub (gibt immer (x=0,y=0) zurück, reicht für logische Tests)
    vi.spyOn(map, 'latLngToContainerPoint').mockImplementation(
        (latlng: L.LatLng) => L.point(latlng.lng * 100, latlng.lat * 100),
    );

    vi.spyOn(map, 'latLngToLayerPoint').mockImplementation(
        (latlng: L.LatLng) => L.point(latlng.lng * 100, latlng.lat * 100),
    );

    vi.spyOn(map, 'containerPointToLatLng').mockImplementation(
        (p: L.Point) => L.latLng(p.y / 100, p.x / 100),
    );

    // getBounds – gibt einen realen Bounds-Stub zurück
    vi.spyOn(map, 'getBounds').mockReturnValue(
        L.latLngBounds(L.latLng(-90, -180), L.latLng(90, 180)),
    );

    return map;
}

// ─── Helper: simulierten Klick auf die Karte auslösen ─────────────────────────
export function fireMapClick(map: L.Map, lat: number, lng: number): void {
    const latlng = L.latLng(lat, lng);
    (map as any).fire('click', {
        latlng,
        originalEvent: new MouseEvent('click'),
    } as L.LeafletMouseEvent);
}

export function fireMapMouseMove(map: L.Map, lat: number, lng: number): void {
    const latlng = L.latLng(lat, lng);
    (map as any).fire('mousemove', {
        latlng,
        originalEvent: new MouseEvent('mousemove'),
    } as L.LeafletMouseEvent);
}

export function fireLayerClick(layer: L.Layer, lat: number, lng: number, mouseEventInit?: MouseEventInit): void {
    const latlng = L.latLng(lat, lng);
    (layer as any).fire('click', {
        latlng,
        target: layer,
        originalEvent: new MouseEvent('click', mouseEventInit),
    } as L.LeafletMouseEvent);
}
