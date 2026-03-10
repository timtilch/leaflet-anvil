import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as L from 'leaflet';
import { getSnapLatLng } from '../../utils/snapping';
import { LayerStore } from '../../layers/layer-store';
import { createMap } from '../helpers/leaflet-mock';

describe('getSnapLatLng', () => {
    let map: L.Map;
    let store: LayerStore;

    beforeEach(() => {
        map = createMap();
        store = new LayerStore(map);
    });

    afterEach(() => {
        map.remove();
    });

    it('gibt das Original-LatLng zurück wenn snapping deaktiviert ist', () => {
        const latlng = L.latLng(51.5, -0.1);
        const result = getSnapLatLng(map, latlng, store, { snapping: false });
        expect(result).toBe(latlng);
    });

    it('gibt das Original-LatLng zurück wenn kein Layer in Reichweite ist', () => {
        const latlng = L.latLng(0, 0);
        const result = getSnapLatLng(map, latlng, store, { snapping: true, snapDistance: 10 });
        expect(result).toBe(latlng);
    });

    it('snapped zum nächsten Marker-Punkt wenn nahe genug', () => {
        // latLngToContainerPoint: (lat*100, lng*100) gemäß Mock
        // Marker bei (1, 1) → containerPoint (100, 100)
        const snapTarget = L.latLng(1, 1);
        const marker = L.marker(snapTarget).addTo(map);
        store.addLayer(marker);

        // Klick bei (1.001, 1.001) → containerPoint ≈ (100.1, 100.1)
        // Distanz ≈ sqrt(0.1² + 0.1²) ≈ 0.14 px → weit unter snapDistance=20
        const clickLatLng = L.latLng(1.001, 1.001);
        const result = getSnapLatLng(map, clickLatLng, store, { snapping: true, snapDistance: 20 });

        expect(result).toBe(snapTarget);
    });

    it('snapped NICHT wenn Layer zu weit entfernt ist', () => {
        const snapTarget = L.latLng(10, 10);
        const marker = L.marker(snapTarget).addTo(map);
        store.addLayer(marker);

        // Klick bei (0, 0) → containerPoint (0, 0), Marker bei (1000, 1000) → weit weg
        const clickLatLng = L.latLng(0, 0);
        const result = getSnapLatLng(map, clickLatLng, store, { snapping: true, snapDistance: 10 });

        expect(result).toBe(clickLatLng);
    });

    it('snapped zu additionalPoints wenn nahe genug', () => {
        const additionalPoint = L.latLng(1, 1);
        const clickLatLng = L.latLng(1.001, 1.001);

        const result = getSnapLatLng(map, clickLatLng, store, { snapping: true, snapDistance: 20 }, [additionalPoint]);

        expect(result).toBe(additionalPoint);
    });

    it('skipLayer wird beim Snapping ignoriert', () => {
        const snapTarget = L.latLng(1, 1);
        const marker = L.marker(snapTarget).addTo(map);
        store.addLayer(marker);

        const clickLatLng = L.latLng(1.001, 1.001);
        const result = getSnapLatLng(map, clickLatLng, store, { snapping: true, snapDistance: 20 }, [], marker);

        expect(result).toBe(clickLatLng);
    });

    it('snapped zu Polyline-Vertices', () => {
        const vertex = L.latLng(2, 2);
        const polyline = L.polyline([L.latLng(1, 1), vertex]).addTo(map);
        store.addLayer(polyline);

        vi.spyOn(polyline, 'getBounds').mockReturnValue(
            L.latLngBounds(L.latLng(-90, -180), L.latLng(90, 180)),
        );

        const clickLatLng = L.latLng(2.001, 2.001);
        const result = getSnapLatLng(map, clickLatLng, store, { snapping: true, snapDistance: 20 });

        expect(result).toBe(vertex);
    });
});

