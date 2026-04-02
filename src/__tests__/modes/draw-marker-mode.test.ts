import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as L from 'leaflet';
import { DrawMarkerMode } from '../../modes/draw-marker-mode';
import { LayerStore } from '../../layers/layer-store';
import { ANVIL_EVENTS } from '../../events';
import { AnvilMode } from '../../types';
import { createMap, fireMapClick } from '../helpers/leaflet-mock';

describe('DrawMarkerMode', () => {
    let map: L.Map;
    let store: LayerStore;
    let mode: DrawMarkerMode;

    beforeEach(() => {
        map = createMap();
        store = new LayerStore(map);
        mode = new DrawMarkerMode(map, {}, store);
    });

    afterEach(() => {
        mode.disable();
        map.remove();
    });

    it('enable() sets cursor to crosshair', () => {
        mode.enable();
        expect(map.getContainer().style.cursor).toBe('crosshair');
    });

    it('disable() resets cursor', () => {
        mode.enable();
        mode.disable();
        expect(map.getContainer().style.cursor).toBe('');
    });

    it('click on map creates a marker and fires anvil:created', () => {
        mode.enable();
        const handler = vi.fn();
        map.on(ANVIL_EVENTS.CREATED, handler);

        fireMapClick(map, 51.5, -0.1);

        expect(handler).toHaveBeenCalledOnce();
        const payload = handler.mock.calls[0][0] as any;
        expect(payload.layer).toBeInstanceOf(L.Marker);
        expect((payload.layer as L.Marker).getLatLng()).toMatchObject({ lat: 51.5, lng: -0.1 });
    });

    it('after disable() no further markers are created', () => {
        mode.enable();
        mode.disable();

        const handler = vi.fn();
        map.on(ANVIL_EVENTS.CREATED, handler);

        fireMapClick(map, 51.5, -0.1);
        expect(handler).not.toHaveBeenCalled();
    });

    it('respects vertexOptions for Marker', () => {
        const title = 'Custom Title';
        // Test setup with custom vertexOptions
        const modeWithOptions = new DrawMarkerMode(map, { vertexOptions: { title } }, store);
        modeWithOptions.enable();

        const handler = vi.fn();
        map.on(ANVIL_EVENTS.CREATED, handler);

        fireMapClick(map, 0, 0);

        const marker = handler.mock.calls[0][0].layer as L.Marker;
        expect(marker.options.title).toBe(title);

        modeWithOptions.disable();
    });

    it('allows mode-specific marker styles to override global marker options', () => {
        const modeWithOptions = new DrawMarkerMode(map, {
            vertexOptions: { title: 'Global Title', keyboard: false },
            modeStyles: {
                [AnvilMode.Marker]: {
                    vertexOptions: { title: 'Mode Title', riseOnHover: true },
                },
            },
        }, store);
        modeWithOptions.enable();

        const handler = vi.fn();
        map.on(ANVIL_EVENTS.CREATED, handler);

        fireMapClick(map, 0, 0);

        const marker = handler.mock.calls[0][0].layer as L.Marker;
        expect(marker.options.title).toBe('Mode Title');
        expect(marker.options.keyboard).toBe(false);
        expect(marker.options.riseOnHover).toBe(true);

        modeWithOptions.disable();
    });
});
