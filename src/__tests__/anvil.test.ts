import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as L from 'leaflet';
import { Anvil, AnvilMode } from '../anvil';
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

    it('getLayerGroup() returns a FeatureGroup', () => {
        expect(anvil.getLayerGroup()).toBeInstanceOf(L.FeatureGroup);
    });

    it('enable() activates the specified mode', () => {
        // Should not throw
        expect(() => anvil.enable(AnvilMode.Marker)).not.toThrow();
    });

    it('disable() deactivates the active mode', () => {
        anvil.enable(AnvilMode.Marker);
        expect(() => anvil.disable()).not.toThrow();
    });

    it('MODE_CHANGE event is fired on mode change', () => {
        const handler = vi.fn();
        map.on(ANVIL_EVENTS.MODE_CHANGE, handler);

        anvil.enable(AnvilMode.Marker);

        expect(handler).toHaveBeenCalledOnce();
        expect(handler.mock.calls[0][0]).toMatchObject({ mode: AnvilMode.Marker });
    });

    it('CREATED event → Layer is automatically added to the store', () => {
        const marker = L.marker([51.5, -0.1]);
        map.fire(ANVIL_EVENTS.CREATED, { layer: marker });

        expect(anvil.getLayerGroup().hasLayer(marker)).toBe(true);
    });

    it('DELETED event → Layer is automatically removed from the store', () => {
        const marker = L.marker([51.5, -0.1]);
        map.fire(ANVIL_EVENTS.CREATED, { layer: marker });
        map.fire(ANVIL_EVENTS.DELETED, { layer: marker });

        expect(anvil.getLayerGroup().hasLayer(marker)).toBe(false);
    });

    it('all supported modes can be activated without error', () => {
        const modes: AnvilMode[] = Object.values(AnvilMode);

        for (const mode of modes) {
            expect(() => anvil.enable(mode)).not.toThrow();
        }
    });

    it('Marker drawing integration: Click → anvil:created → in store', () => {
        anvil.enable(AnvilMode.Marker);
        const handler = vi.fn();
        map.on(ANVIL_EVENTS.CREATED, handler);

        fireMapClick(map, 51.5, -0.1);

        expect(handler).toHaveBeenCalledOnce();
        const layer = handler.mock.calls[0][0].layer as L.Marker;
        expect(anvil.getLayerGroup().hasLayer(layer)).toBe(true);
    });
});
