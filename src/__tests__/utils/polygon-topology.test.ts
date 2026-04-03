import { describe, expect, it, vi } from 'vitest';
import * as L from 'leaflet';
import { createCoverageSnapshot, repairPolygonCoverage } from '../../utils/polygon-topology';

function polygonLayer(
    feature: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>,
): L.Polygon {
    return {
        toGeoJSON: () => feature,
        setLatLngs: vi.fn(),
        redraw: vi.fn(),
    } as unknown as L.Polygon;
}

describe('polygon-topology', () => {
    it('ignores invalid polygons during coverage repair instead of throwing', () => {
        const snapshot = createCoverageSnapshot([
            polygonLayer({
                type: 'Feature',
                properties: {},
                geometry: {
                    type: 'Polygon',
                    coordinates: [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]],
                },
            }),
            polygonLayer({
                type: 'Feature',
                properties: {},
                geometry: {
                    type: 'Polygon',
                    coordinates: [[[2, 0], [4, 0], [4, 2], [2, 2], [2, 0]]],
                },
            }),
        ]);

        expect(snapshot).not.toBeNull();

        const invalidLayer = polygonLayer({
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'Polygon',
                coordinates: [[[0, 0], [1, 0], [0, 0]]],
            },
        });

        const validLayer = polygonLayer({
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'Polygon',
                coordinates: [[[2, 0], [4, 0], [4, 2], [2, 2], [2, 0]]],
            },
        });

        expect(() => repairPolygonCoverage([invalidLayer, validLayer], snapshot!)).not.toThrow();
    });
});
