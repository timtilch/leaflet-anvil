import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as L from 'leaflet';
import { DrawRectangleMode } from '../../modes/draw-rectangle-mode';
import { LayerStore } from '../../layers/layer-store';
import { ANVIL_EVENTS } from '../../events';
import { createMap } from '../helpers/leaflet-mock';

function fireMouseEvent(map: L.Map, type: string, lat: number, lng: number) {
    (map as any).fire(type, {
        latlng: L.latLng(lat, lng),
        originalEvent: new MouseEvent(type),
    });
}

describe('DrawRectangleMode', () => {
    let map: L.Map;
    let store: LayerStore;
    let mode: DrawRectangleMode;

    beforeEach(() => {
        map = createMap();
        store = new LayerStore(map);
        mode = new DrawRectangleMode(map, {}, store);
        mode.enable();
    });

    afterEach(() => {
        mode.disable();
        map.remove();
    });

    it('enable() sets cursor to crosshair and disables drag', () => {
        expect(map.getContainer().style.cursor).toBe('crosshair');
    });

    it('disable() resets cursor', () => {
        mode.disable();
        expect(map.getContainer().style.cursor).toBe('');
    });

    it('mousedown → mousemove → mouseup creates a rectangle and fires anvil:created', () => {
        const handler = vi.fn();
        map.on(ANVIL_EVENTS.CREATED, handler);

        fireMouseEvent(map, 'mousedown', 0, 0);
        fireMouseEvent(map, 'mousemove', 1, 1);
        fireMouseEvent(map, 'mouseup', 1, 1);

        expect(handler).toHaveBeenCalledOnce();
        expect(handler.mock.calls[0][0].layer).toBeInstanceOf(L.Rectangle);
    });

    it('no rectangle when not clicking (mousemove without mousedown)', () => {
        const handler = vi.fn();
        map.on(ANVIL_EVENTS.CREATED, handler);

        fireMouseEvent(map, 'mousemove', 1, 1);
        fireMouseEvent(map, 'mouseup', 1, 1);

        expect(handler).not.toHaveBeenCalled();
    });
});
