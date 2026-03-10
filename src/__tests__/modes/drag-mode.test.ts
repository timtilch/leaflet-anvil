import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as L from 'leaflet';
import { DragMode } from '../../modes/drag-mode';
import { LayerStore } from '../../layers/layer-store';
import { ANVIL_EVENTS } from '../../events';
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

    it('enable() registriert mousedown auf vorhandenen Layern', () => {
        const marker = L.marker([51.5, -0.1]).addTo(map);
        store.addLayer(marker);
        const spy = vi.spyOn(marker, 'on');

        mode.enable();

        expect(spy).toHaveBeenCalledWith('mousedown', expect.any(Function), expect.anything());
    });

    it('disable() entfernt mousedown-Listener', () => {
        const marker = L.marker([51.5, -0.1]).addTo(map);
        store.addLayer(marker);
        mode.enable();
        const spy = vi.spyOn(marker, 'off');

        mode.disable();

        expect(spy).toHaveBeenCalledWith('mousedown', expect.any(Function), expect.anything());
    });

    it('Marker wird nach mousedown + mousemove verschoben und anvil:edited wird gefeuert', () => {
        const marker = L.marker([0, 0]).addTo(map);
        store.addLayer(marker);
        mode.enable();

        const handler = vi.fn();
        map.on(ANVIL_EVENTS.EDITED, handler);

        fireMouseDown(marker, 0, 0);
        fireMouseMove(map, 1, 1);
        fireMouseUp(map);

        expect(handler).toHaveBeenCalledOnce();
        expect(handler.mock.calls[0][0]).toMatchObject({ layer: marker });

        const newLatLng = marker.getLatLng();
        expect(newLatLng.lat).toBeCloseTo(1);
        expect(newLatLng.lng).toBeCloseTo(1);
    });

    it('Layer der nicht im Store ist, wird nicht gedraggt', () => {
        const marker = L.marker([0, 0]).addTo(map);
        // NICHT in den Store aufnehmen
        mode.enable();

        const handler = vi.fn();
        map.on(ANVIL_EVENTS.EDITED, handler);

        fireMouseDown(marker, 0, 0);
        fireMouseMove(map, 1, 1);
        fireMouseUp(map);

        expect(handler).not.toHaveBeenCalled();
    });
});

