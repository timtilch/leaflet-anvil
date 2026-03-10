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

    it('erster Klick setzt das Basis-Polygon, noch kein Event', () => {
        const base = L.polygon(poly1Coords).addTo(map);
        store.addLayer(base);
        mode.enable();

        const handler = vi.fn();
        map.on(ANVIL_EVENTS.DELETED, handler);

        fireLayerClick(base, 2, 2);

        expect(handler).not.toHaveBeenCalled();
    });

    it('Subtraktion zweier Polygone → deleted-Event für beide, created für Ergebnis', () => {
        const base = L.polygon(poly1Coords).addTo(map);
        const hole = L.polygon(poly2Coords).addTo(map);
        store.addLayer(base);
        store.addLayer(hole);
        mode.enable();

        const deletedHandler = vi.fn();
        const createdHandler = vi.fn();
        map.on(ANVIL_EVENTS.DELETED, deletedHandler);
        map.on(ANVIL_EVENTS.CREATED, createdHandler);

        fireLayerClick(base, 0.5, 0.5);
        fireLayerClick(hole, 2, 2);

        expect(deletedHandler).toHaveBeenCalledTimes(2);
        expect(createdHandler).toHaveBeenCalled();
    });

    it('Klick auf dasselbe Polygon zweimal → Reset, kein Event', () => {
        const base = L.polygon(poly1Coords).addTo(map);
        store.addLayer(base);
        mode.enable();

        const handler = vi.fn();
        map.on(ANVIL_EVENTS.DELETED, handler);

        fireLayerClick(base, 2, 2);
        fireLayerClick(base, 2, 2);

        expect(handler).not.toHaveBeenCalled();
    });
});

