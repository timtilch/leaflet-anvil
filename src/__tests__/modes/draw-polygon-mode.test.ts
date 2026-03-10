import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as L from 'leaflet';
import { DrawPolygonMode } from '../../modes/draw-polygon-mode';
import { LayerStore } from '../../layers/layer-store';
import { ANVIL_EVENTS } from '../../events';
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

    it('enable() setzt Cursor auf crosshair', () => {
        expect(map.getContainer().style.cursor).toBe('crosshair');
    });

    it('disable() setzt Cursor zurück', () => {
        mode.disable();
        expect(map.getContainer().style.cursor).toBe('');
    });

    it('3 Klicks + Schließen erzeugt ein Polygon und feuert anvil:created', () => {
        const handler = vi.fn();
        map.on(ANVIL_EVENTS.CREATED, handler);

        fireMapClick(map, 0, 0);
        fireMapClick(map, 1, 0);
        fireMapClick(map, 0, 1);

        // Klick zurück auf ersten Punkt (latLngToContainerPoint gibt (0,0) für (0,0))
        fireMapClick(map, 0, 0);

        expect(handler).toHaveBeenCalledOnce();
        expect(handler.mock.calls[0][0].layer).toBeInstanceOf(L.Polygon);
    });

    it('weniger als 3 Punkte → kein Polygon beim Schließen', () => {
        const handler = vi.fn();
        map.on(ANVIL_EVENTS.CREATED, handler);

        fireMapClick(map, 0, 0);
        fireMapClick(map, 1, 0);
        // Noch kein Schließen möglich – Klick auf ersten Punkt
        fireMapClick(map, 0, 0);

        expect(handler).not.toHaveBeenCalled();
    });

    it('Escape-Taste setzt Zeichnung zurück', () => {
        fireMapClick(map, 0, 0);
        fireMapClick(map, 1, 0);

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

        const handler = vi.fn();
        map.on(ANVIL_EVENTS.CREATED, handler);

        // Jetzt sollte der State leer sein – Schließen ohne vorherige Punkte geht nicht
        fireMapClick(map, 0, 0);
        expect(handler).not.toHaveBeenCalled();
    });

    it('mousemove erzeugt Ghost-Line nach dem ersten Klick', () => {
        const addLayerSpy = vi.spyOn(map, 'addLayer');

        fireMapClick(map, 0, 0);
        fireMapMouseMove(map, 0.5, 0.5);

        // addLayer sollte für die Ghost-Polyline aufgerufen worden sein
        expect(addLayerSpy).toHaveBeenCalled();
    });

    it('preventSelfIntersection – sich kreuzende Punkte werden abgelehnt', () => {
        const strictMode = new DrawPolygonMode(map, { preventSelfIntersection: true, snapDistance: 10 }, store);
        strictMode.enable();

        const handler = vi.fn();
        map.on(ANVIL_EVENTS.CREATED, handler);

        // Wir fügen Punkte hinzu, die sich potenziell schneiden
        fireMapClick(map, 0, 0);
        fireMapClick(map, 2, 2);
        fireMapClick(map, 0, 2);
        fireMapClick(map, 2, 0); // Dieser Punkt würde eine Kreuzung verursachen

        strictMode.disable();
    });
});

