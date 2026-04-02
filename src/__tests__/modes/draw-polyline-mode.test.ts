import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as L from 'leaflet';
import { DrawPolylineMode } from '../../modes/draw-polyline-mode';
import { LayerStore } from '../../layers/layer-store';
import { ANVIL_EVENTS } from '../../events';
import { AnvilMode } from '../../types';
import { createMap, fireMapClick } from '../helpers/leaflet-mock';

describe('DrawPolylineMode', () => {
    let map: L.Map;
    let store: LayerStore;
    let mode: DrawPolylineMode;

    beforeEach(() => {
        map = createMap();
        store = new LayerStore(map);
        mode = new DrawPolylineMode(map, { snapDistance: 10 }, store);
        mode.enable();
    });

    afterEach(() => {
        mode.disable();
        map.remove();
    });

    it('enable() sets cursor to crosshair', () => {
        expect(map.getContainer().style.cursor).toBe('crosshair');
    });

    it('disable() resets cursor', () => {
        mode.disable();
        expect(map.getContainer().style.cursor).toBe('');
    });

    it('Enter-key after ≥2 points finalizes the line', () => {
        const handler = vi.fn();
        map.on(ANVIL_EVENTS.CREATED, handler);

        fireMapClick(map, 0, 0);
        fireMapClick(map, 1, 1);

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

        expect(handler).toHaveBeenCalledOnce();
        expect(handler.mock.calls[0][0].layer).toBeInstanceOf(L.Polyline);
    });

    it('Enter-key with only 1 point does not create a line', () => {
        const handler = vi.fn();
        map.on(ANVIL_EVENTS.CREATED, handler);

        fireMapClick(map, 0, 0);
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

        expect(handler).not.toHaveBeenCalled();
    });

    it('Escape-key resets drawing state', () => {
        fireMapClick(map, 0, 0);
        fireMapClick(map, 1, 1);

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

        const handler = vi.fn();
        map.on(ANVIL_EVENTS.CREATED, handler);

        // State is empty, Enter shouldn't produce anything
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        expect(handler).not.toHaveBeenCalled();
    });

    it('double click on last point finalizes the line', () => {
        // Simulating second click on same coordinates
        fireMapClick(map, 0, 0);
        fireMapClick(map, 1, 1);

        const handler = vi.fn();
        map.on(ANVIL_EVENTS.CREATED, handler);

        // Double click often fires a click first, then dblclick.
        // Our mode listens to dblclick.
        (map as any).fire('dblclick', {
            latlng: L.latLng(1, 1),
            originalEvent: new MouseEvent('dblclick'),
        });

        expect(handler).toHaveBeenCalledOnce();
    });

    it('allows mode-specific line styles to override global path options', () => {
        mode.disable();

        const styledMode = new DrawPolylineMode(map, {
            pathOptions: { color: '#123456', weight: 2 },
            modeStyles: {
                [AnvilMode.Polyline]: {
                    pathOptions: { color: '#ff6600', weight: 6 },
                },
            },
        }, store);
        styledMode.enable();

        const handler = vi.fn();
        map.on(ANVIL_EVENTS.CREATED, handler);

        fireMapClick(map, 0, 0);
        fireMapClick(map, 1, 1);
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

        const polyline = handler.mock.calls[0][0].layer as L.Polyline;
        expect(polyline.options.color).toBe('#ff6600');
        expect(polyline.options.weight).toBe(6);

        styledMode.disable();
    });
});
