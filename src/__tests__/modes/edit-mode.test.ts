import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as L from 'leaflet';
import { EditMode } from '../../modes/edit-mode';
import { LayerStore } from '../../layers/layer-store';
import { createMap, fireLayerClick } from '../helpers/leaflet-mock';

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

    it('pins shared vertices when touching selected geometries are multi-selected', () => {
        const first = L.polygon([[0, 0], [0, 1], [1, 0]]).addTo(map);
        const second = L.polygon([[0, 0], [0, -1], [-1, 0]]).addTo(map);
        store.addLayer(first);
        store.addLayer(second);
        mode.enable();

        fireLayerClick(first, 0, 0);
        fireLayerClick(second, 0, 0, { shiftKey: true });

        const markers = (mode as any).markers as L.Marker[];
        const sharedMarker = markers.find((marker) => {
            const pos = marker.getLatLng();
            return pos.lat === 0 && pos.lng === 0;
        });

        expect(sharedMarker).toBeDefined();

        sharedMarker!.fire('dragstart');
        sharedMarker!.fire('drag', { latlng: L.latLng(0.5, 0.5) });
        sharedMarker!.fire('dragend');

        const firstLatLngs = first.getLatLngs() as L.LatLng[][];
        const secondLatLngs = second.getLatLngs() as L.LatLng[][];

        expect(firstLatLngs[0][0]).toMatchObject({ lat: 0.5, lng: 0.5 });
        expect(secondLatLngs[0][0]).toMatchObject({ lat: 0.5, lng: 0.5 });
    });
});
