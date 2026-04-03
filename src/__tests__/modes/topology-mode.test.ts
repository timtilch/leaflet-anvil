import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as L from 'leaflet';
import * as turf from '@turf/turf';
import { TopologyMode } from '../../modes/topology-mode';
import { LayerStore } from '../../layers/layer-store';
import { createMap, fireMapClick, fireMapMouseMove } from '../helpers/leaflet-mock';

describe('TopologyMode', () => {
    let map: L.Map;
    let store: LayerStore;
    let mode: TopologyMode;

    beforeEach(() => {
        map = createMap();
        store = new LayerStore(map);
        mode = new TopologyMode(map, store);
    });

    afterEach(() => {
        mode.disable();
        map.remove();
    });

    function getCoverageArea(layers: L.Polygon[]): number {
        const features = layers.map(layer => layer.toGeoJSON() as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>);
        const unioned = turf.union(turf.featureCollection(features as any));
        return unioned ? turf.area(unioned as any) : 0;
    }

    it('activates all editable layers when enabled', () => {
        const first = L.polygon([[0, 0], [0, 1], [1, 0]]).addTo(map);
        const second = L.polygon([[2, 0], [2, 1], [3, 0]]).addTo(map);
        store.addLayer(first);
        store.addLayer(second);

        mode.enable();

        const activeLayers = (mode as any).activeLayers as Set<L.Layer>;
        expect(activeLayers.size).toBe(2);
        expect(activeLayers.has(first)).toBe(true);
        expect(activeLayers.has(second)).toBe(true);
        expect(((mode as any).markers as L.CircleMarker[]).length).toBeGreaterThan(0);
    });

    it('moves common vertices across touching geometries without manual selection', () => {
        const first = L.polygon([[0, 0], [0, 1], [1, 0]]).addTo(map);
        const second = L.polygon([[0, 0], [0, -1], [-1, 0]]).addTo(map);
        store.addLayer(first);
        store.addLayer(second);

        mode.enable();

        map.fire('mousedown', {
            latlng: L.latLng(0, 0),
            originalEvent: new MouseEvent('mousedown'),
        });
        fireMapMouseMove(map, 0.5, 0.5);
        map.fire('mouseup', {
            latlng: L.latLng(0.5, 0.5),
            originalEvent: new MouseEvent('mouseup'),
        });

        const firstLatLngs = first.getLatLngs() as L.LatLng[][];
        const secondLatLngs = second.getLatLngs() as L.LatLng[][];

        expect(firstLatLngs[0][0]).toMatchObject({ lat: 0.5, lng: 0.5 });
        expect(secondLatLngs[0][0]).toMatchObject({ lat: 0.5, lng: 0.5 });
    });

    it('keeps the topology selection active on map click', () => {
        const polygon = L.polygon([[0, 0], [0, 1], [1, 0]]).addTo(map);
        store.addLayer(polygon);

        mode.enable();
        fireMapClick(map, 2, 2);

        const activeLayers = (mode as any).activeLayers as Set<L.Layer>;
        expect(activeLayers.size).toBe(1);
        expect(activeLayers.has(polygon)).toBe(true);
        expect(((mode as any).markers as L.CircleMarker[]).length).toBeGreaterThan(0);
    });

    it('prevents vertex deletion from creating a self-intersection', () => {
        mode.disable();
        mode = new TopologyMode(map, store, { preventSelfIntersection: true });

        const polygon = L.polygon([
            [0, 0],
            [0, 4],
            [4, 4],
            [4, 0],
            [3, 1],
            [1, 3],
            [1, 1],
        ]).addTo(map);
        store.addLayer(polygon);

        mode.enable();

        const vertexGroup = ((mode as any).markers as L.CircleMarker[])
            .map(marker => (marker as any)._anvilHandleMeta?.group)
            .find((group: any) => group?.latlng.lat === 0 && group?.latlng.lng === 4);

        expect(vertexGroup).toBeDefined();

        (mode as any).deleteVertex(vertexGroup);

        const latlngs = (polygon.getLatLngs() as L.LatLng[][])[0];
        expect(latlngs).toHaveLength(7);
        expect(latlngs[1]).toMatchObject({ lat: 0, lng: 4 });
    });

    it('repairs local coverage after deleting a non-shared boundary vertex', () => {
        const left = L.polygon([
            [0, 0],
            [0, 2],
            [2, 3],
            [4, 2],
            [4, 0],
        ]).addTo(map);
        const right = L.polygon([
            [0, 2],
            [0, 4],
            [4, 4],
            [4, 2],
            [3, 2.5],
            [1, 2.5],
        ]).addTo(map);
        store.addLayer(left);
        store.addLayer(right);

        mode.enable();
        const originalArea = getCoverageArea([left, right]);

        const vertexGroup = ((mode as any).markers as L.CircleMarker[])
            .map(marker => (marker as any)._anvilHandleMeta?.group)
            .find((group: any) => group?.latlng.lat === 2 && group?.latlng.lng === 3);

        expect(vertexGroup).toBeDefined();
        expect(vertexGroup.refs).toHaveLength(1);

        (mode as any).deleteVertex(vertexGroup);

        expect(getCoverageArea([left, right])).toBeCloseTo(originalArea, 8);
    });

    it('prevents dragging a polygon vertex into overlap with another polygon when self-intersection prevention is enabled', () => {
        mode.disable();
        mode = new TopologyMode(map, store, { preventSelfIntersection: true });

        const triangle = L.polygon([
            [0, 0],
            [0, 2],
            [2, 0],
        ]).addTo(map);
        const neighbor = L.polygon([
            [0, 2.5],
            [0, 4.5],
            [2, 4.5],
            [2, 2.5],
        ]).addTo(map);
        store.addLayer(triangle);
        store.addLayer(neighbor);

        mode.enable();

        map.fire('mousedown', {
            latlng: L.latLng(0, 2),
            originalEvent: new MouseEvent('mousedown'),
        });
        fireMapMouseMove(map, 1, 4);
        map.fire('mouseup', {
            latlng: L.latLng(1, 4),
            originalEvent: new MouseEvent('mouseup'),
        });

        const latlngs = (triangle.getLatLngs() as L.LatLng[][])[0];
        expect(latlngs[1]).toMatchObject({ lat: 0, lng: 2 });
    });
});
