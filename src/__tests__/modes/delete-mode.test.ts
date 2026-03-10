import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as L from 'leaflet';
import { DeleteMode } from '../../modes/delete-mode';
import { LayerStore } from '../../layers/layer-store';
import { ANVIL_EVENTS } from '../../events';
import { createMap, fireLayerClick } from '../helpers/leaflet-mock';

describe('DeleteMode', () => {
    let map: L.Map;
    let store: LayerStore;
    let mode: DeleteMode;

    beforeEach(() => {
        map = createMap();
        store = new LayerStore(map);
        mode = new DeleteMode(map, store);
    });

    afterEach(() => {
        mode.disable();
        map.remove();
    });

    it('enable() registriert Click-Listener auf vorhandenen Layern', () => {
        const polygon = L.polygon([[0, 0], [1, 0], [0, 1]]).addTo(map);
        store.addLayer(polygon);
        const spy = vi.spyOn(polygon, 'on');

        mode.enable();

        expect(spy).toHaveBeenCalledWith('click', expect.any(Function), expect.anything());
    });

    it('disable() entfernt Click-Listener', () => {
        const polygon = L.polygon([[0, 0], [1, 0], [0, 1]]).addTo(map);
        store.addLayer(polygon);
        mode.enable();
        const spy = vi.spyOn(polygon, 'off');

        mode.disable();

        expect(spy).toHaveBeenCalledWith('click', expect.any(Function), expect.anything());
    });

    it('Klick auf Layer entfernt ihn von der Karte und feuert anvil:deleted', () => {
        const polygon = L.polygon([[0, 0], [1, 0], [0, 1]]).addTo(map);
        store.addLayer(polygon);
        mode.enable();

        const handler = vi.fn();
        map.on(ANVIL_EVENTS.DELETED, handler);

        fireLayerClick(polygon, 0.3, 0.3);

        expect(handler).toHaveBeenCalledOnce();
        expect(handler.mock.calls[0][0]).toMatchObject({ layer: polygon });
        expect(map.hasLayer(polygon)).toBe(false);
    });

    it('nach disable() werden keine weiteren Delete-Events ausgelöst', () => {
        const polygon = L.polygon([[0, 0], [1, 0], [0, 1]]).addTo(map);
        store.addLayer(polygon);
        mode.enable();
        mode.disable();

        const handler = vi.fn();
        map.on(ANVIL_EVENTS.DELETED, handler);

        fireLayerClick(polygon, 0.3, 0.3);

        expect(handler).not.toHaveBeenCalled();
    });
});

