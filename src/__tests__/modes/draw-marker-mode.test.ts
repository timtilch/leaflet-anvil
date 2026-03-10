import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as L from 'leaflet';
import { DrawMarkerMode } from '../../modes/draw-marker-mode';
import { LayerStore } from '../../layers/layer-store';
import { ANVIL_EVENTS } from '../../events';
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

    it('enable() setzt Cursor auf crosshair', () => {
        mode.enable();
        expect(map.getContainer().style.cursor).toBe('crosshair');
    });

    it('disable() setzt Cursor zurück', () => {
        mode.enable();
        mode.disable();
        expect(map.getContainer().style.cursor).toBe('');
    });

    it('Klick auf Karte erstellt einen Marker und feuert anvil:created', () => {
        mode.enable();
        const handler = vi.fn();
        map.on(ANVIL_EVENTS.CREATED, handler);

        fireMapClick(map, 51.5, -0.1);

        expect(handler).toHaveBeenCalledOnce();
        const payload = handler.mock.calls[0][0] as any;
        expect(payload.layer).toBeInstanceOf(L.Marker);
        expect((payload.layer as L.Marker).getLatLng()).toMatchObject({ lat: 51.5, lng: -0.1 });
    });

    it('nach disable() werden keine weiteren Marker erstellt', () => {
        mode.enable();
        mode.disable();
        const handler = vi.fn();
        map.on(ANVIL_EVENTS.CREATED, handler);

        fireMapClick(map, 51.5, -0.1);

        expect(handler).not.toHaveBeenCalled();
    });

    it('mit Snapping: wenn Snap-Punkt nahe ist, wird der Snap-Punkt verwendet', () => {
        // Einen existierenden Marker in den Store legen
        const existing = L.marker([51.5, -0.1]);
        store.addLayer(existing);

        // latLngToContainerPoint so mocken, dass der bestehende Punkt sehr nah erscheint
        const modeWithSnap = new DrawMarkerMode(map, { snapping: true, snapDistance: 50 }, store);
        modeWithSnap.enable();

        const handler = vi.fn();
        map.on(ANVIL_EVENTS.CREATED, handler);

        // Klick fast auf den existierenden Punkt
        fireMapClick(map, 51.501, -0.101);

        expect(handler).toHaveBeenCalledOnce();
        modeWithSnap.disable();
    });
});

