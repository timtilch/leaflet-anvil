import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as L from 'leaflet';
import { Anvil } from '../anvil';
import { ANVIL_EVENTS } from '../events';
import { createMap, fireMapClick } from './helpers/leaflet-mock';

describe('Anvil', () => {
    let map: L.Map;
    let anvil: Anvil;

    beforeEach(() => {
        map = createMap();
        anvil = new Anvil(map);
    });

    afterEach(() => {
        anvil.disable();
        map.remove();
    });

    it('getLayerGroup() gibt eine FeatureGroup zurück', () => {
        expect(anvil.getLayerGroup()).toBeInstanceOf(L.FeatureGroup);
    });

    it('enable() aktiviert den angegebenen Modus', () => {
        // Sollte keinen Fehler werfen
        expect(() => anvil.enable('draw:marker')).not.toThrow();
    });

    it('disable() deaktiviert den aktiven Modus', () => {
        anvil.enable('draw:marker');
        expect(() => anvil.disable()).not.toThrow();
    });

    it('MODE_CHANGE-Event wird beim Moduswechsel gefeuert', () => {
        const handler = vi.fn();
        map.on(ANVIL_EVENTS.MODE_CHANGE, handler);

        anvil.enable('draw:marker');

        expect(handler).toHaveBeenCalledOnce();
        expect(handler.mock.calls[0][0]).toMatchObject({ mode: 'draw:marker' });
    });

    it('CREATED-Event → Layer wird automatisch zum Store hinzugefügt', () => {
        const marker = L.marker([51.5, -0.1]);
        map.fire(ANVIL_EVENTS.CREATED, { layer: marker });

        expect(anvil.getLayerGroup().hasLayer(marker)).toBe(true);
    });

    it('DELETED-Event → Layer wird automatisch aus dem Store entfernt', () => {
        const marker = L.marker([51.5, -0.1]);
        map.fire(ANVIL_EVENTS.CREATED, { layer: marker });
        map.fire(ANVIL_EVENTS.DELETED, { layer: marker });

        expect(anvil.getLayerGroup().hasLayer(marker)).toBe(false);
    });

    it('alle unterstützten Modi können aktiviert werden ohne Fehler', () => {
        const modes: Parameters<typeof anvil.enable>[0][] = [
            'draw:polygon', 'draw:polyline', 'draw:marker', 'draw:rectangle',
            'draw:square', 'draw:triangle', 'draw:circle', 'draw:freehand',
            'cut', 'split', 'union', 'subtract', 'drag', 'scale', 'rotate',
            'edit', 'delete',
        ];

        for (const mode of modes) {
            expect(() => anvil.enable(mode)).not.toThrow();
        }
    });

    it('Marker-Zeichnen integriert: Klick → anvil:created → im Store', () => {
        anvil.enable('draw:marker');
        const handler = vi.fn();
        map.on(ANVIL_EVENTS.CREATED, handler);

        fireMapClick(map, 51.5, -0.1);

        expect(handler).toHaveBeenCalledOnce();
        const layer = handler.mock.calls[0][0].layer as L.Marker;
        expect(anvil.getLayerGroup().hasLayer(layer)).toBe(true);
    });
});

