import * as L from 'leaflet';
import * as turf from '@turf/turf';
import { AnvilOptions, Mode } from '../anvil';
import { LayerStore } from '../layers/layer-store';
import { ANVIL_EVENTS } from '../events';
import { AnvilMode } from '../types';
import { getModePathOptions, getModeSelectionPathOptions } from '../utils/mode-styles';

export class SubtractMode implements Mode {
    private baseLayer: L.Polygon | null = null;
    private baseLayerStyle: L.PathOptions | null = null;

    constructor(
        private map: L.Map,
        private store: LayerStore,
        private options: AnvilOptions = {},
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
            this.baseLayerStyle = { ...layer.options };
            this.baseLayer.setStyle(
                getModeSelectionPathOptions(this.options, AnvilMode.Subtract, this.baseLayerStyle, {
                    color: '#ff0000',
                    weight: 4,
                }),
            );
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
                const newLayerGroup = L.geoJSON(f, {
                    style: getModePathOptions(this.options, AnvilMode.Subtract),
                });
                const l = newLayerGroup.getLayers()[0] as L.Polygon;
                l.addTo(this.map);
                this.map.fire(ANVIL_EVENTS.CREATED, { layer: l });
            });
        }

        this.baseLayer = null;
        this.baseLayerStyle = null;
    }

    private reset(): void {
        if (this.baseLayer) {
            this.baseLayer.setStyle(this.baseLayerStyle || {});
            this.baseLayer = null;
            this.baseLayerStyle = null;
        }
    }
}
