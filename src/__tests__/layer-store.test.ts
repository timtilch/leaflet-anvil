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

    it('erstellt intern eine FeatureGroup und fügt sie der Karte hinzu', () => {
        const group = store.getGroup();
        expect(group).toBeInstanceOf(L.FeatureGroup);
        expect(map.hasLayer(group)).toBe(true);
    });

    it('verwendet eine übergebene externe FeatureGroup', () => {
        const external = L.featureGroup();
        const storeWithGroup = new LayerStore(map, external);
        expect(storeWithGroup.getGroup()).toBe(external);
    });

    it('addLayer – Layer wird zur Gruppe hinzugefügt', () => {
        const marker = L.marker([51.5, -0.1]);
        store.addLayer(marker);
        expect(store.hasLayer(marker)).toBe(true);
    });

    it('removeLayer – Layer wird aus der Gruppe entfernt', () => {
        const marker = L.marker([51.5, -0.1]);
        store.addLayer(marker);
        store.removeLayer(marker);
        expect(store.hasLayer(marker)).toBe(false);
    });

    it('hasLayer gibt false zurück für einen nicht enthaltenen Layer', () => {
        const marker = L.marker([51.5, -0.1]);
        expect(store.hasLayer(marker)).toBe(false);
    });

    it('getGroup gibt dieselbe Instanz zurück', () => {
        const g1 = store.getGroup();
        const g2 = store.getGroup();
        expect(g1).toBe(g2);
    });

    it('mehrere Layer können hinzugefügt werden', () => {
        const m1 = L.marker([51.5, -0.1]);
        const m2 = L.marker([51.6, -0.2]);
        store.addLayer(m1);
        store.addLayer(m2);
        expect(store.hasLayer(m1)).toBe(true);
        expect(store.hasLayer(m2)).toBe(true);
    });
});

