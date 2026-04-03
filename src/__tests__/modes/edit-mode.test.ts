import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as L from 'leaflet';
import * as turf from '@turf/turf';
import { EditMode } from '../../modes/edit-mode';
import { LayerStore } from '../../layers/layer-store';
import { createMap, fireLayerClick, fireMapClick, fireMapMouseMove } from '../helpers/leaflet-mock';

describe('EditMode', () => {
    let map: L.Map;
    let store: LayerStore;
    let mode: EditMode;

    beforeEach(() => {
        map = createMap();
        store = new LayerStore(map);
        mode = new EditMode(map, store);
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

    it('requires Shift to multi-select layers', () => {
        const first = L.polygon([[0, 0], [0, 1], [1, 0]]).addTo(map);
        const second = L.polygon([[0, 0], [0, -1], [-1, 0]]).addTo(map);
        store.addLayer(first);
        store.addLayer(second);
        mode.enable();

        fireLayerClick(first, 0, 0);
        fireLayerClick(second, 0, 0);

        expect(((mode as any).activeLayers as Set<L.Layer>).size).toBe(1);
        expect(((mode as any).activeLayers as Set<L.Layer>).has(second)).toBe(true);
    });

    it('adds a second layer to the selection when Shift is held', () => {
        const first = L.polygon([[0, 0], [0, 1], [1, 0]]).addTo(map);
        const second = L.polygon([[2, 0], [2, 1], [3, 0]]).addTo(map);
        store.addLayer(first);
        store.addLayer(second);
        mode.enable();

        fireLayerClick(first, 0, 0);
        fireLayerClick(second, 2, 0, { shiftKey: true });

        const activeLayers = (mode as any).activeLayers as Set<L.Layer>;
        expect(activeLayers.size).toBe(2);
        expect(activeLayers.has(first)).toBe(true);
        expect(activeLayers.has(second)).toBe(true);
    });

    it('allows selecting a layer again after clearing the current selection', () => {
        const first = L.polygon([[0, 0], [0, 1], [1, 0]]).addTo(map);
        const second = L.polygon([[2, 0], [2, 1], [3, 0]]).addTo(map);
        store.addLayer(first);
        store.addLayer(second);
        mode.enable();

        fireLayerClick(first, 0, 0);
        fireMapClick(map, 10, 10);
        fireLayerClick(second, 2, 0);

        const activeLayers = (mode as any).activeLayers as Set<L.Layer>;
        expect(activeLayers.size).toBe(1);
        expect(activeLayers.has(second)).toBe(true);
    });

    it('links common vertices when touching selected geometries are multi-selected', () => {
        const first = L.polygon([[0, 0], [0, 1], [1, 0]]).addTo(map);
        const second = L.polygon([[0, 0], [0, -1], [-1, 0]]).addTo(map);
        store.addLayer(first);
        store.addLayer(second);
        mode.enable();

        fireLayerClick(first, 0, 0);
        fireLayerClick(second, 0, 0, { shiftKey: true });

        const markers = (mode as any).markers as L.CircleMarker[];
        const sharedMarker = markers.find((marker) => {
            const pos = marker.getLatLng();
            return pos.lat === 0 && pos.lng === 0;
        });

        expect(sharedMarker).toBeDefined();

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

    it('keeps the selection active after finishing a drag', () => {
        const polygon = L.polygon([[0, 0], [0, 1], [1, 0]]).addTo(map);
        store.addLayer(polygon);
        mode.enable();

        fireLayerClick(polygon, 0, 0);

        map.fire('mousedown', {
            latlng: L.latLng(0, 0),
            originalEvent: new MouseEvent('mousedown'),
        });
        fireMapMouseMove(map, 0.25, 0.25);
        map.fire('mouseup', {
            latlng: L.latLng(0.25, 0.25),
            originalEvent: new MouseEvent('mouseup'),
        });
        fireMapClick(map, 0.25, 0.25);

        const activeLayers = (mode as any).activeLayers as Set<L.Layer>;
        expect(activeLayers.size).toBe(1);
        expect(activeLayers.has(polygon)).toBe(true);
    });

    it('keeps the selection when a post-drag click hits the layer and then the map', () => {
        const polygon = L.polygon([[0, 0], [0, 1], [1, 0]]).addTo(map);
        store.addLayer(polygon);
        mode.enable();

        fireLayerClick(polygon, 0, 0);

        map.fire('mousedown', {
            latlng: L.latLng(0, 0),
            originalEvent: new MouseEvent('mousedown'),
        });
        fireMapMouseMove(map, 0.25, 0.25);
        map.fire('mouseup', {
            latlng: L.latLng(0.25, 0.25),
            originalEvent: new MouseEvent('mouseup'),
        });

        fireLayerClick(polygon, 0.25, 0.25);
        fireMapClick(map, 0.25, 0.25);

        const activeLayers = (mode as any).activeLayers as Set<L.Layer>;
        expect(activeLayers.size).toBe(1);
        expect(activeLayers.has(polygon)).toBe(true);
    });

    it('prevents deleting a vertex when that would create a self-intersection', () => {
        mode.disable();
        mode = new EditMode(map, store, { preventSelfIntersection: true });

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

        fireLayerClick(polygon, 0, 0);

        const vertexGroup = ((mode as any).markers as L.CircleMarker[])
            .map(marker => (marker as any)._anvilHandleMeta?.group)
            .find((group: any) => group?.latlng.lat === 0 && group?.latlng.lng === 4);

        expect(vertexGroup).toBeDefined();

        (mode as any).deleteVertex(vertexGroup);

        const latlngs = (polygon.getLatLngs() as L.LatLng[][])[0];
        expect(latlngs).toHaveLength(7);
        expect(latlngs[1]).toMatchObject({ lat: 0, lng: 4 });
    });

    it('repairs local coverage after deleting a non-shared boundary vertex in a multi-selection', () => {
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

        fireLayerClick(left, 0, 0);
        fireLayerClick(right, 0, 2, { shiftKey: true });

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
        mode = new EditMode(map, store, { preventSelfIntersection: true });

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

        fireLayerClick(triangle, 0, 0);

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
