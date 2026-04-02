import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as L from 'leaflet';
import { DragMode } from '../../modes/drag-mode';
import { LayerStore } from '../../layers/layer-store';
import { ANVIL_EVENTS } from '../../events';
import { AnvilMode } from '../../types';
import { createMap } from '../helpers/leaflet-mock';

function fireMouseDown(layer: L.Layer, lat: number, lng: number) {
    (layer as any).fire('mousedown', {
        latlng: L.latLng(lat, lng),
        target: layer,
        originalEvent: new MouseEvent('mousedown'),
    });
}

function fireMouseMove(map: L.Map, lat: number, lng: number) {
    (map as any).fire('mousemove', {
        latlng: L.latLng(lat, lng),
        originalEvent: new MouseEvent('mousemove'),
    });
}

function fireMouseUp(map: L.Map) {
    (map as any).fire('mouseup', {
        originalEvent: new MouseEvent('mouseup'),
    });
}

describe('DragMode', () => {
    let map: L.Map;
    let store: LayerStore;
    let mode: DragMode;

    beforeEach(() => {
        map = createMap();
        store = new LayerStore(map);
        mode = new DragMode(map, store, {});
    });

    afterEach(() => {
        mode.disable();
        map.remove();
    });

    it('enable() registers mousedown on existing layers', () => {
        const marker = L.marker([51.5, -0.1]).addTo(map);
        store.addLayer(marker);
        const spy = vi.spyOn(marker, 'on');

        mode.enable();

        expect(spy).toHaveBeenCalledWith('mousedown', expect.any(Function), expect.anything());
    });

    it('disable() removes mousedown listener', () => {
        const marker = L.marker([51.5, -0.1]).addTo(map);
        store.addLayer(marker);
        mode.enable();
        const spy = vi.spyOn(marker, 'off');

        mode.disable();

        expect(spy).toHaveBeenCalledWith('mousedown', expect.any(Function), expect.anything());
    });

    it('mousedown + mousemove updates layer position and fires anvil:edited on mouseup', () => {
        const marker = L.marker([10, 10]).addTo(map);
        store.addLayer(marker);
        mode.enable();

        const editHandler = vi.fn();
        map.on(ANVIL_EVENTS.EDITED, editHandler);

        fireMouseDown(marker, 10, 10);
        fireMouseMove(map, 11, 11); // Move by 1,1
        fireMouseUp(map);

        expect(marker.getLatLng().lat).toBeCloseTo(11);
        expect(marker.getLatLng().lng).toBeCloseTo(11);
        expect(editHandler).toHaveBeenCalledOnce();
        expect(editHandler.mock.calls[0][0]).toMatchObject({ layer: marker });
    });

    it('newly added layer also gets listener if mode is enabled', () => {
        mode.enable();
        const marker = L.marker([0, 0]).addTo(map);
        const spy = vi.spyOn(marker, 'on');

        store.addLayer(marker);
        expect(spy).toHaveBeenCalledWith('mousedown', expect.any(Function), expect.anything());
    });

    it('uses selectionPathOptions while dragging and restores the original style afterwards', () => {
        const polygon = L.polygon([[0, 0], [1, 0], [0, 1]], {
            color: '#123456',
            weight: 2,
        }).addTo(map);
        store.addLayer(polygon);

        const styledMode = new DragMode(map, store, {
            modeStyles: {
                [AnvilMode.Drag]: {
                    selectionPathOptions: {
                        color: '#f97316',
                        weight: 6,
                    },
                },
            },
        });
        styledMode.enable();

        fireMouseDown(polygon, 0, 0);
        expect(polygon.options.color).toBe('#f97316');
        expect(polygon.options.weight).toBe(6);

        fireMouseUp(map);
        expect(polygon.options.color).toBe('#123456');
        expect(polygon.options.weight).toBe(2);

        styledMode.disable();
    });
});
