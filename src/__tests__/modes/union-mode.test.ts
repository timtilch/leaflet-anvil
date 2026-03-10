import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as L from 'leaflet';
import { UnionMode } from '../../modes/union-mode';
import { LayerStore } from '../../layers/layer-store';
import { ANVIL_EVENTS } from '../../events';
import { createMap, fireLayerClick } from '../helpers/leaflet-mock';

// Two overlapping polygons
const poly1Coords: L.LatLngExpression[] = [[0, 0], [0, 2], [2, 2], [2, 0]];
const poly2Coords: L.LatLngExpression[] = [[1, 1], [1, 3], [3, 3], [3, 1]];

describe('UnionMode', () => {
    let map: L.Map;
    let store: LayerStore;
    let mode: UnionMode;

    beforeEach(() => {
        map = createMap();
        store = new LayerStore(map);
        mode = new UnionMode(map, store, {});
    });

    afterEach(() => {
        mode.disable();
        map.remove();
    });

    it('enable() registers click listener on polygons in the store', () => {
        const polygon = L.polygon(poly1Coords).addTo(map);
        store.addLayer(polygon);
        const spy = vi.spyOn(polygon, 'on');

        mode.enable();

        expect(spy).toHaveBeenCalledWith('click', expect.any(Function), expect.anything());
    });

    it('first click highlights the polygon, no event yet', () => {
        const polygon = L.polygon(poly1Coords).addTo(map);
        store.addLayer(polygon);
        mode.enable();

        const createdHandler = vi.fn();
        map.on(ANVIL_EVENTS.CREATED, createdHandler);

        fireLayerClick(polygon, 1, 1);

        expect(createdHandler).not.toHaveBeenCalled();
    });

    it('union of two polygons fires anvil:deleted for both and anvil:created for the result', () => {
        const p1 = L.polygon(poly1Coords).addTo(map);
        const p2 = L.polygon(poly2Coords).addTo(map);
        store.addLayer(p1);
        store.addLayer(p2);
        mode.enable();

        const createdHandler = vi.fn();
        const deletedHandler = vi.fn();
        map.on(ANVIL_EVENTS.CREATED, createdHandler);
        map.on(ANVIL_EVENTS.DELETED, deletedHandler);

        fireLayerClick(p1, 0, 0);
        fireLayerClick(p2, 3, 3);

        expect(deletedHandler).toHaveBeenCalledTimes(2);
        expect(createdHandler).toHaveBeenCalledOnce();

        const resultLayer = createdHandler.mock.calls[0][0].layer as L.Polygon;
        expect(resultLayer).toBeInstanceOf(L.Polygon);
        // Union of two 2x2 squares: from (0,0) to (3,3) total 7 units square? No, 2*2 + 2*2 - 1 = 7.
    });

    it('Escape resets the selection', () => {
        const p1 = L.polygon(poly1Coords).addTo(map);
        store.addLayer(p1);
        mode.enable();

        fireLayerClick(p1, 0, 0);
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

        const createdHandler = vi.fn();
        map.on(ANVIL_EVENTS.CREATED, createdHandler);

        // Clicking p1 again should be treated as the new FIRST click
        fireLayerClick(p1, 0, 0);
        expect(createdHandler).not.toHaveBeenCalled();
    });
});
