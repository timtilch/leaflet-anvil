import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as L from 'leaflet';
import { SubtractMode } from '../../modes/subtract-mode';
import { LayerStore } from '../../layers/layer-store';
import { ANVIL_EVENTS } from '../../events';
import { createMap, fireLayerClick } from '../helpers/leaflet-mock';

const poly1Coords: L.LatLngExpression[] = [[0, 0], [0, 4], [4, 4], [4, 0]];
const poly2Coords: L.LatLngExpression[] = [[1, 1], [1, 3], [3, 3], [3, 1]];

describe('SubtractMode', () => {
    let map: L.Map;
    let store: LayerStore;
    let mode: SubtractMode;

    beforeEach(() => {
        map = createMap();
        store = new LayerStore(map);
        mode = new SubtractMode(map, store);
    });

    afterEach(() => {
        mode.disable();
        map.remove();
    });

    it('first click sets base polygon, no event yet', () => {
        const base = L.polygon(poly1Coords).addTo(map);
        store.addLayer(base);
        mode.enable();

        const handler = vi.fn();
        map.on(ANVIL_EVENTS.DELETED, handler);

        fireLayerClick(base, 2, 2);

        expect(handler).not.toHaveBeenCalled();
    });

    it('subtracting two polygons → deleted event for both, created for result', () => {
        const base = L.polygon(poly1Coords).addTo(map);
        const hole = L.polygon(poly2Coords).addTo(map);
        store.addLayer(base);
        store.addLayer(hole);
        mode.enable();

        const deletedHandler = vi.fn();
        const createdHandler = vi.fn();
        map.on(ANVIL_EVENTS.DELETED, deletedHandler);
        map.on(ANVIL_EVENTS.CREATED, createdHandler);

        fireLayerClick(base, 2, 2);
        fireLayerClick(hole, 2, 2);

        expect(deletedHandler).toHaveBeenCalledTimes(2);
        expect(createdHandler).toHaveBeenCalledOnce();

        const resultLayer = createdHandler.mock.calls[0][0].layer as L.Polygon;
        expect(resultLayer).toBeInstanceOf(L.Polygon);
    });

    it('Escape resets the selection', () => {
        const base = L.polygon(poly1Coords).addTo(map);
        store.addLayer(base);
        mode.enable();

        fireLayerClick(base, 2, 2);
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

        const deletedHandler = vi.fn();
        map.on(ANVIL_EVENTS.DELETED, deletedHandler);

        // Clicking the same polygon again should be seen as the new FIRST click
        fireLayerClick(base, 2, 2);
        expect(deletedHandler).not.toHaveBeenCalled();
    });
});
