import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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

    it('returns original LatLng if snapping is disabled', () => {
        const latlng = L.latLng(51.5, -0.1);
        const result = getSnapLatLng(map, latlng, store, { snapping: false });
        expect(result).toBe(latlng);
    });

    it('returns original LatLng if no layer is within range', () => {
        const latlng = L.latLng(0, 0);
        const result = getSnapLatLng(map, latlng, store, { snapping: true, snapDistance: 10 });
        expect(result).toBe(latlng);
    });

    it('snaps to the nearest marker point if close enough', () => {
        // latLngToContainerPoint: (lat*100, lng*100) according to mock
        // Marker at (1, 1) → containerPoint (100, 100)
        const snapTarget = L.latLng(1, 1);
        const marker = L.marker(snapTarget).addTo(map);
        store.addLayer(marker);

        // Click at (1.001, 1.001) → containerPoint ≈ (100.1, 100.1)
        // Distance ≈ sqrt(0.1² + 0.1²) ≈ 0.14 px → far below snapDistance=20
        const clickLatLng = L.latLng(1.001, 1.001);
        const result = getSnapLatLng(map, clickLatLng, store, { snapping: true, snapDistance: 20 });

        expect(result).toBe(snapTarget);
    });

    it('does NOT snap if layer is too far away', () => {
        const snapTarget = L.latLng(10, 10);
        const marker = L.marker(snapTarget).addTo(map);
        store.addLayer(marker);

        // Click at (11, 11) -> Distance is (1100 - 1000) = 100 pixels
        // with snapDistance=20 it should not snap
        const clickLatLng = L.latLng(11, 11);
        const result = getSnapLatLng(map, clickLatLng, store, { snapping: true, snapDistance: 20 });

        expect(result).toBe(clickLatLng);
    });

    it('snaps to polygon vertices', () => {
        const polygon = L.polygon([
            [1, 1], [1, 2], [2, 2], [2, 1],
        ]);
        store.addLayer(polygon);

        const clickTarget = L.latLng(1.01, 1.01); // near (1,1)
        const result = getSnapLatLng(map, clickTarget, store, { snapping: true, snapDistance: 30 });
        expect(result.lat).toBe(1);
        expect(result.lng).toBe(1);
    });

    it('excludes specified layer from snapping', () => {
        const target = L.latLng(1, 1);
        const marker = L.marker(target);
        store.addLayer(marker);

        const clickTarget = L.latLng(1.1, 1.1); // distance 10 pixels (110 - 100)

        // Passing arguments in order: map, latlng, store, options, additionalPoints (must be array!), skipLayer
        const result = getSnapLatLng(map, clickTarget, store, { snapping: true, snapDistance: 30 }, [], marker);

        // Should not snap because 'marker' is excluded
        expect(result).toBe(clickTarget);
    });
});
