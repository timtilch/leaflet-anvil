import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as L from 'leaflet';
import { DrawPolylineMode } from '../../modes/draw-polyline-mode';
import { LayerStore } from '../../layers/layer-store';
import { ANVIL_EVENTS } from '../../events';
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

    it('enable() setzt Cursor auf crosshair', () => {
        expect(map.getContainer().style.cursor).toBe('crosshair');
    });

    it('disable() setzt Cursor zurück', () => {
        mode.disable();
        expect(map.getContainer().style.cursor).toBe('');
    });

    it('Enter-Taste nach ≥2 Punkten finalisiert die Linie', () => {
        const handler = vi.fn();
        map.on(ANVIL_EVENTS.CREATED, handler);

        fireMapClick(map, 0, 0);
        fireMapClick(map, 1, 1);

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

        expect(handler).toHaveBeenCalledOnce();
        expect(handler.mock.calls[0][0].layer).toBeInstanceOf(L.Polyline);
    });

    it('Enter-Taste mit nur 1 Punkt erzeugt keine Linie', () => {
        const handler = vi.fn();
        map.on(ANVIL_EVENTS.CREATED, handler);

        fireMapClick(map, 0, 0);
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

        expect(handler).not.toHaveBeenCalled();
    });

    it('Escape-Taste setzt Zeichnung zurück', () => {
        const handler = vi.fn();
        map.on(ANVIL_EVENTS.CREATED, handler);

        fireMapClick(map, 0, 0);
        fireMapClick(map, 1, 1);
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        expect(handler).not.toHaveBeenCalled();
    });

    it('Doppelklick finalisiert die Linie', () => {
        const handler = vi.fn();
        map.on(ANVIL_EVENTS.CREATED, handler);

        fireMapClick(map, 0, 0);
        fireMapClick(map, 1, 1);

        (map as any).fire('dblclick', {
            latlng: L.latLng(1, 1),
            originalEvent: new MouseEvent('dblclick'),
        });

        expect(handler).toHaveBeenCalledOnce();
    });
});

