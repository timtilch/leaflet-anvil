import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as L from 'leaflet';
import { UnionMode } from '../../modes/union-mode';
import { LayerStore } from '../../layers/layer-store';
import { ANVIL_EVENTS } from '../../events';
import { createMap, fireLayerClick } from '../helpers/leaflet-mock';

// Zwei überlappende Polygone
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

    it('enable() registriert Click-Listener auf Polygonen im Store', () => {
        const polygon = L.polygon(poly1Coords).addTo(map);
        store.addLayer(polygon);
        const spy = vi.spyOn(polygon, 'on');

        mode.enable();

        expect(spy).toHaveBeenCalledWith('click', expect.any(Function), expect.anything());
    });

    it('erster Klick hebt das Polygon hervor, kein Event', () => {
        const polygon = L.polygon(poly1Coords).addTo(map);
        store.addLayer(polygon);
        mode.enable();

        const createdHandler = vi.fn();
        map.on(ANVIL_EVENTS.CREATED, createdHandler);

        fireLayerClick(polygon, 1, 1);

        expect(createdHandler).not.toHaveBeenCalled();
    });

    it('zwei überlappende Polygone → Union erzeugt neuen Layer und feuert created/deleted', () => {
        const p1 = L.polygon(poly1Coords).addTo(map);
        const p2 = L.polygon(poly2Coords).addTo(map);
        store.addLayer(p1);
        store.addLayer(p2);
        mode.enable();

        const createdHandler = vi.fn();
        const deletedHandler = vi.fn();
        map.on(ANVIL_EVENTS.CREATED, createdHandler);
        map.on(ANVIL_EVENTS.DELETED, deletedHandler);

        fireLayerClick(p1, 1, 1);
        fireLayerClick(p2, 2, 2);

        expect(deletedHandler).toHaveBeenCalledTimes(2);
        expect(createdHandler).toHaveBeenCalled();
    });

    it('Klick auf dasselbe Polygon zweimal → reset (kein Event)', () => {
        const polygon = L.polygon(poly1Coords).addTo(map);
        store.addLayer(polygon);
        mode.enable();

        const handler = vi.fn();
        map.on(ANVIL_EVENTS.CREATED, handler);

        fireLayerClick(polygon, 1, 1);
        fireLayerClick(polygon, 1, 1); // Same polygon → reset

        expect(handler).not.toHaveBeenCalled();
    });
});

