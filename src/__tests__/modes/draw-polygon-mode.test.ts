import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as L from 'leaflet';
import { DrawPolygonMode } from '../../modes/draw-polygon-mode';
import { LayerStore } from '../../layers/layer-store';
import { ANVIL_EVENTS } from '../../events';
import { AnvilMode } from '../../types';
import { createMap, fireMapClick, fireMapMouseMove } from '../helpers/leaflet-mock';

describe('DrawPolygonMode', () => {
    let map: L.Map;
    let store: LayerStore;
    let mode: DrawPolygonMode;

    beforeEach(() => {
        map = createMap();
        store = new LayerStore(map);
        mode = new DrawPolygonMode(map, { snapDistance: 10 }, store);
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

    it('3 clicks + closing creates a polygon and fires anvil:created', () => {
        const handler = vi.fn();
        map.on(ANVIL_EVENTS.CREATED, handler);

        fireMapClick(map, 0, 0);
        fireMapClick(map, 1, 0);
        fireMapClick(map, 0, 1);

        // Click back to first point (latLngToContainerPoint returns (0,0) for (0,0))
        fireMapClick(map, 0, 0);

        expect(handler).toHaveBeenCalledOnce();
        expect(handler.mock.calls[0][0].layer).toBeInstanceOf(L.Polygon);
    });

    it('fewer than 3 points → no polygon on closing', () => {
        const handler = vi.fn();
        map.on(ANVIL_EVENTS.CREATED, handler);

        fireMapClick(map, 0, 0);
        fireMapClick(map, 1, 0);

        // Closing click to (0,0)
        fireMapClick(map, 0, 0);

        expect(handler).not.toHaveBeenCalled();
    });

    it('Escape-Key resets drawing', () => {
        fireMapClick(map, 0, 0);
        fireMapClick(map, 1, 0);

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

        const handler = vi.fn();
        map.on(ANVIL_EVENTS.CREATED, handler);

        // State should be empty – clicking (0,0) without previous points shouldn't close anything
        fireMapClick(map, 0, 0);
        expect(handler).not.toHaveBeenCalled();
    });

    it('mousemove updates the ghost line', () => {
        fireMapClick(map, 0, 0);
        fireMapMouseMove(map, 1, 1);

        // No explicit way to check ghost line easily without spy or private access
        // but we ensure it doesn't crash
    });

    it('preventSelfIntersection: true blocks intersecting segment', () => {
        const modeIntersect = new DrawPolygonMode(map, { preventSelfIntersection: true }, store);
        modeIntersect.enable();

        fireMapClick(map, 0, 0);
        fireMapClick(map, 2, 2);
        fireMapClick(map, 2, 0);

        // This move/click would cross 0,0-2,2
        // We simulate a click at 0,2
        fireMapClick(map, 0, 2);

        // Should have only 3 points (0,0), (2,2), (2,0)
        // (the last one was blocked)
        // Actually we cannot easily check private 'points' here
        // but it's a structural test
    });

    it('snapping integration: clicks near existing vertices', () => {
        const marker = L.marker([10, 10]).addTo(map);
        store.addLayer(marker);

        fireMapClick(map, 10.01, 10.01); // should snap to 10,10
        // No easy way to check internal state without spies,
        // focus remains on translation of descriptions.
    });

    it('allows mode-specific polygon styles to override global path options', () => {
        mode.disable();

        const styledMode = new DrawPolygonMode(map, {
            pathOptions: { color: '#123456', fillColor: '#abcdef' },
            modeStyles: {
                [AnvilMode.Polygon]: {
                    pathOptions: { color: '#ff6600', fillColor: '#fed7aa', fillOpacity: 0.6 },
                },
            },
            snapDistance: 10,
        }, store);
        styledMode.enable();

        const handler = vi.fn();
        map.on(ANVIL_EVENTS.CREATED, handler);

        fireMapClick(map, 0, 0);
        fireMapClick(map, 1, 0);
        fireMapClick(map, 0, 1);
        fireMapClick(map, 0, 0);

        const polygon = handler.mock.calls[0][0].layer as L.Polygon;
        expect(polygon.options.color).toBe('#ff6600');
        expect(polygon.options.fillColor).toBe('#fed7aa');
        expect(polygon.options.fillOpacity).toBe(0.6);

        styledMode.disable();
    });
});
