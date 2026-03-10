import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as L from 'leaflet';
import { LayerStore } from '../layers/layer-store';
import { createMap } from './helpers/leaflet-mock';

describe('LayerStore', () => {
    let map: L.Map;
    let store: LayerStore;

    beforeEach(() => {
        map = createMap();
        store = new LayerStore(map);
    });

    afterEach(() => {
        map.remove();
    });

    it('creates a FeatureGroup internally and adds it to the map', () => {
        const group = store.getGroup();
        expect(group).toBeInstanceOf(L.FeatureGroup);
        expect(map.hasLayer(group)).toBe(true);
    });

    it('uses a provided external FeatureGroup', () => {
        const external = L.featureGroup();
        const storeWithGroup = new LayerStore(map, external);
        expect(storeWithGroup.getGroup()).toBe(external);
    });

    it('addLayer – adds layer to the group', () => {
        const marker = L.marker([51.5, -0.1]);
        store.addLayer(marker);
        expect(store.hasLayer(marker)).toBe(true);
    });

    it('removeLayer – removes layer from the group', () => {
        const marker = L.marker([51.5, -0.1]);
        store.addLayer(marker);
        store.removeLayer(marker);
        expect(store.hasLayer(marker)).toBe(false);
    });

    it('hasLayer returns false for a layer not in the group', () => {
        const marker = L.marker([51.5, -0.1]);
        expect(store.hasLayer(marker)).toBe(false);
    });

    it('getGroup returns the same instance', () => {
        const g1 = store.getGroup();
        const g2 = store.getGroup();
        expect(g1).toBe(g2);
    });

    it('getLayers returns all layers in the group', () => {
        const m1 = L.marker([51.5, -0.1]);
        const m2 = L.marker([51.5, -0.2]);
        store.addLayer(m1);
        store.addLayer(m2);

        const layers = store.getLayers();
        expect(layers).toContain(m1);
        expect(layers).toContain(m2);
        expect(layers.length).toBe(2);
    });
});
