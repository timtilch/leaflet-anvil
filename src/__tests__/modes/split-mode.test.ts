import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as L from 'leaflet';
import { SplitMode } from '../../modes/split-mode';
import { LayerStore } from '../../layers/layer-store';
import { ANVIL_EVENTS } from '../../events';
import { createMap } from '../helpers/leaflet-mock';

describe('SplitMode', () => {
    let map: L.Map;
    let store: LayerStore;
    let mode: SplitMode;

    beforeEach(() => {
        map = createMap();
        store = new LayerStore(map);
        mode = new SplitMode(map, store, {});
    });

    afterEach(() => {
        mode.disable();
        map.remove();
    });

    it('inserts intersection vertices into neighboring geometries by default', () => {
        const active = L.polygon([[0, 0], [0, 2], [2, 2], [2, 0]]).addTo(map);
        const neighbor = L.polyline([[0, 1], [2, 1]]).addTo(map);
        store.addLayer(active);
        store.addLayer(neighbor);

        vi.spyOn(mode as any, 'insertVerticesIntoNeighbors');

        (mode as any).points = [L.latLng(-1, 1), L.latLng(3, 1)];
        (mode as any).finish();

        expect((mode as any).insertVerticesIntoNeighbors).toHaveBeenCalled();
    });

    it('preserves bends in the drawn split line', () => {
        const polygon = L.polygon([[0, 0], [0, 4], [4, 4], [4, 0]]).addTo(map);
        store.addLayer(polygon);

        const created = vi.fn();
        map.on(ANVIL_EVENTS.CREATED, created);

        (mode as any).points = [L.latLng(2, -1), L.latLng(1, 2), L.latLng(2, 5)];
        (mode as any).finish();

        const createdPolygons = created.mock.calls.map((call) => call[0].layer as L.Polygon);
        expect(createdPolygons).toHaveLength(2);

        const hasInsertedCorner = createdPolygons.some((layer) => {
            const rings = layer.getLatLngs() as L.LatLng[][];
            return rings[0].some((point) => point.lat === 1 && point.lng === 2);
        });

        expect(hasInsertedCorner).toBe(true);
    });
});
