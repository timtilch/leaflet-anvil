import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as L from 'leaflet';
import * as turf from '@turf/turf';
import { SplitMode } from '../../modes/split-mode';
import { LayerStore } from '../../layers/layer-store';
import { ANVIL_EVENTS } from '../../events';
import { createMap } from '../helpers/leaflet-mock';

describe('SplitMode', () => {
    let map: L.Map;
    let store: LayerStore;
    let mode: SplitMode;

    beforeEach(() => {
        map = createMap();
        store = new LayerStore(map);
        mode = new SplitMode(map, store, {});
    });

    afterEach(() => {
        mode.disable();
        map.remove();
    });

    function getCoverageArea(layers: L.Polygon[]): number {
        const features = layers.map(layer => layer.toGeoJSON() as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>);
        if (features.length === 1) return turf.area(features[0] as any);
        const unioned = turf.union(turf.featureCollection(features as any));
        return unioned ? turf.area(unioned as any) : 0;
    }

    function getSummedArea(layers: L.Polygon[]): number {
        return layers.reduce((sum, layer) => sum + turf.area(layer.toGeoJSON() as any), 0);
    }

    it('inserts intersection vertices into neighboring geometries by default', () => {
        const active = L.polygon([[0, 0], [0, 2], [2, 2], [2, 0]]).addTo(map);
        const neighbor = L.polyline([[0, 1], [2, 1]]).addTo(map);
        store.addLayer(active);
        store.addLayer(neighbor);

        vi.spyOn(mode as any, 'insertVerticesIntoNeighbors');

        (mode as any).points = [L.latLng(-1, 1), L.latLng(3, 1)];
        (mode as any).finish();

        expect((mode as any).insertVerticesIntoNeighbors).toHaveBeenCalled();
    });

    it('preserves bends in the drawn split line', () => {
        const polygon = L.polygon([[0, 0], [0, 4], [4, 4], [4, 0]]).addTo(map);
        store.addLayer(polygon);

        const created = vi.fn();
        map.on(ANVIL_EVENTS.CREATED, created);

        (mode as any).points = [L.latLng(2, -1), L.latLng(1, 2), L.latLng(2, 5)];
        (mode as any).finish();

        const createdPolygons = created.mock.calls.map((call) => call[0].layer as L.Polygon);
        expect(createdPolygons).toHaveLength(2);

        const hasInsertedCorner = createdPolygons.some((layer) => {
            const rings = layer.getLatLngs() as L.LatLng[][];
            return rings[0].some((point) => point.lat === 1 && point.lng === 2);
        });

        expect(hasInsertedCorner).toBe(true);
    });

    it('handles polygons with holes without throwing', () => {
        const polygon = L.polygon([
            [[0, 0], [0, 8], [8, 8], [8, 0]],
            [[3, 3], [3, 5], [5, 5], [5, 3]],
        ]).addTo(map);
        store.addLayer(polygon);

        const created = vi.fn();
        map.on(ANVIL_EVENTS.CREATED, created);

        (mode as any).points = [L.latLng(6, -1), L.latLng(6, 9)];

        expect(() => (mode as any).finish()).not.toThrow();
        expect(created).toHaveBeenCalledTimes(2);
    });

    it('preserves the original polygon style on created split parts', () => {
        mode = new SplitMode(map, store, {
            modeStyles: {
                split: {
                    pathOptions: {
                        color: '#9333ea',
                        weight: 4,
                    },
                },
            },
        });

        const polygon = L.polygon([[0, 0], [0, 4], [4, 4], [4, 0]], {
            color: '#14532d',
            fillColor: '#bbf7d0',
            fillOpacity: 0.6,
            weight: 2,
        }).addTo(map);
        store.addLayer(polygon);

        const created = vi.fn();
        map.on(ANVIL_EVENTS.CREATED, created);

        (mode as any).points = [L.latLng(2, -1), L.latLng(2, 5)];
        (mode as any).finish();

        const createdPolygons = created.mock.calls.map((call) => call[0].layer as L.Polygon);
        expect(createdPolygons).toHaveLength(2);

        createdPolygons.forEach((layer) => {
            expect(layer.options.color).toBe('#14532d');
            expect(layer.options.fillColor).toBe('#bbf7d0');
            expect(layer.options.fillOpacity).toBe(0.6);
            expect(layer.options.weight).toBe(2);
        });
    });

    it('repairs missing coverage when a single polygon split leaves a gap between created parts', () => {
        const polygon = L.polygon([[0, 0], [0, 4], [4, 4], [4, 0]]).addTo(map);
        store.addLayer(polygon);

        const originalArea = getCoverageArea([polygon]);
        const created = vi.fn();
        map.on(ANVIL_EVENTS.CREATED, created);

        vi.spyOn(mode as any, 'splitPolygonAlongLine').mockReturnValue([
            turf.polygon([[[0, 0], [0, 4], [1.5, 4], [1.5, 0], [0, 0]]]),
            turf.polygon([[[2.5, 0], [2.5, 4], [4, 4], [4, 0], [2.5, 0]]]),
        ]);

        (mode as any).points = [L.latLng(2, -1), L.latLng(2, 5)];
        (mode as any).finish();

        const createdPolygons = created.mock.calls.map((call) => call[0].layer as L.Polygon);
        expect(createdPolygons).toHaveLength(2);
        expect(getCoverageArea(createdPolygons)).toBeCloseTo(originalArea, 8);
    });

    it('removes overlap when split parts would otherwise stack on top of each other', () => {
        const polygon = L.polygon([[0, 0], [0, 4], [4, 4], [4, 0]]).addTo(map);
        store.addLayer(polygon);

        const originalArea = getCoverageArea([polygon]);
        const created = vi.fn();
        map.on(ANVIL_EVENTS.CREATED, created);

        vi.spyOn(mode as any, 'splitPolygonAlongLine').mockReturnValue([
            turf.polygon([[[0, 0], [0, 4], [2.5, 4], [2.5, 0], [0, 0]]]),
            turf.polygon([[[1.5, 0], [1.5, 4], [4, 4], [4, 0], [1.5, 0]]]),
        ]);

        (mode as any).points = [L.latLng(2, -1), L.latLng(2, 5)];
        (mode as any).finish();

        const createdPolygons = created.mock.calls.map((call) => call[0].layer as L.Polygon);
        expect(createdPolygons).toHaveLength(2);
        expect(getCoverageArea(createdPolygons)).toBeCloseTo(originalArea, 8);
        expect(Math.abs(getSummedArea(createdPolygons) - originalArea)).toBeLessThan(1e-3);
    });
});
