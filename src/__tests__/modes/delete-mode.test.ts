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

    it('enable() registers click listener on existing layers', () => {
        const polygon = L.polygon([[0, 0], [1, 0], [0, 1]]).addTo(map);
        store.addLayer(polygon);
        const spy = vi.spyOn(polygon, 'on');

        mode.enable();

        expect(spy).toHaveBeenCalledWith('click', expect.any(Function), expect.anything());
    });

    it('disable() removes click listener', () => {
        const polygon = L.polygon([[0, 0], [1, 0], [0, 1]]).addTo(map);
        store.addLayer(polygon);
        mode.enable();
        const spy = vi.spyOn(polygon, 'off');

        mode.disable();

        expect(spy).toHaveBeenCalledWith('click', expect.any(Function), expect.anything());
    });

    it('click on layer removes it from the map and fires anvil:deleted', () => {
        const polygon = L.polygon([[0, 0], [1, 0], [0, 1]]).addTo(map);
        store.addLayer(polygon);
        mode.enable();

        const handler = vi.fn();
        map.on(ANVIL_EVENTS.DELETED, handler);

        fireLayerClick(polygon);

        expect(handler).toHaveBeenCalledOnce();
        expect(handler.mock.calls[0][0]).toMatchObject({ layer: polygon });
        expect(map.hasLayer(polygon)).toBe(false);
    });

    it('newly added layer to store also gets click listener if mode is enabled', () => {
        mode.enable();
        const marker = L.marker([0, 0]).addTo(map);

        const spy = vi.spyOn(marker, 'on');
        store.addLayer(marker);

        expect(spy).toHaveBeenCalledWith('click', expect.any(Function), expect.anything());
    });
});
