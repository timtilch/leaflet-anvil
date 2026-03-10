import * as L from 'leaflet';

export class LayerStore {
    private group: L.FeatureGroup;

    constructor(map: L.Map, layerGroup?: L.FeatureGroup) {
        this.group = layerGroup || L.featureGroup();
        this.group.addTo(map);
    }

    addLayer(layer: L.Layer): void {
        this.group.addLayer(layer);
    }

    removeLayer(layer: L.Layer): void {
        this.group.removeLayer(layer);
    }

    hasLayer(layer: L.Layer): boolean {
        return this.group.hasLayer(layer);
    }

    getGroup(): L.FeatureGroup {
        return this.group;
    }

    getLayers(): L.Layer[] {
        return this.group.getLayers();
    }
}
