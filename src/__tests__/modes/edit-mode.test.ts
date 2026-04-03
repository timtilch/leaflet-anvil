import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as L from 'leaflet';
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

    it('pins shared vertices when touching selected geometries are multi-selected', () => {
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
});
