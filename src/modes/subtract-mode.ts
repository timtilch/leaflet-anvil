import * as L from 'leaflet';
import * as turf from '@turf/turf';
import { Mode } from '../anvil';
import { LayerStore } from '../layers/layer-store';
import { ANVIL_EVENTS } from '../events';

export class SubtractMode implements Mode {
    private baseLayer: L.Polygon | null = null;

    constructor(
        private map: L.Map,
        private store: LayerStore,
    ) {
    }

    enable(): void {
        this.store.getGroup().eachLayer(layer => {
            if (layer instanceof L.Polygon) {
                layer.on('click', this.onLayerClick, this);
                (layer.getElement() as HTMLElement)?.style.setProperty('cursor', 'pointer');
            }
        });
    }

    disable(): void {
        this.store.getGroup().eachLayer(layer => {
            if (layer instanceof L.Polygon) {
                layer.off('click', this.onLayerClick, this);
                (layer.getElement() as HTMLElement)?.style.setProperty('cursor', '');
            }
        });
        this.reset();
    }

    private onLayerClick(e: L.LeafletMouseEvent): void {
        L.DomEvent.stopPropagation(e);
        const layer = e.target as L.Polygon;

        if (!this.baseLayer) {
            this.baseLayer = layer;
            this.baseLayer.setStyle({ color: '#ff0000', weight: 4 });
            return;
        }

        if (this.baseLayer === layer) {
            this.reset();
            return;
        }

        // Use Turf to perform Difference (Subtract)
        const g1 = this.baseLayer.toGeoJSON();
        const g2 = layer.toGeoJSON();

        const diff = turf.difference(turf.featureCollection([g1 as any, g2 as any]));

        // Remove old ones
        this.map.fire(ANVIL_EVENTS.DELETED, { layer: this.baseLayer });
        this.map.fire(ANVIL_EVENTS.DELETED, { layer: layer });
        this.map.removeLayer(this.baseLayer);
        this.map.removeLayer(layer);

        if (diff) {
            // Flatten result and add all parts
            const flattened = turf.flatten(diff);
            flattened.features.forEach(f => {
                const newLayerGroup = L.geoJSON(f);
                const l = newLayerGroup.getLayers()[0] as L.Polygon;
                l.addTo(this.map);
                this.map.fire(ANVIL_EVENTS.CREATED, { layer: l });
            });
        }

        this.baseLayer = null;
    }

    private reset(): void {
        if (this.baseLayer) {
            this.baseLayer.setStyle({ color: '#3388ff', weight: 3 });
            this.baseLayer = null;
        }
    }
}
