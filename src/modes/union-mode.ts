import * as L from 'leaflet';
import * as turf from '@turf/turf';
import { AnvilOptions, Mode } from '../anvil';
import { LayerStore } from '../layers/layer-store';
import { ANVIL_EVENTS } from '../events';
import { AnvilMode } from '../types';
import { getModePathOptions, getModeSelectionPathOptions } from '../utils/mode-styles';

export class UnionMode implements Mode {
    private firstLayer: L.Polygon | null = null;
    private firstLayerStyle: L.PathOptions | null = null;

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

        if (!this.firstLayer) {
            this.firstLayer = layer;
            this.firstLayerStyle = { ...layer.options };
            this.firstLayer.setStyle(
                getModeSelectionPathOptions(this.options, AnvilMode.Union, this.firstLayerStyle, {
                    color: '#ff00ff',
                    weight: 4,
                }),
            );
            return;
        }

        if (this.firstLayer === layer) {
            this.reset();
            return;
        }

        // Use Turf to perform Union
        const g1 = this.firstLayer.toGeoJSON();
        const g2 = layer.toGeoJSON();

        const united = turf.union(turf.featureCollection([g1 as any, g2 as any]));

        if (!united) {
            console.error('Union failed - results null');
            this.reset();
            return;
        }

        // Remove old ones
        this.map.fire(ANVIL_EVENTS.DELETED, { layer: this.firstLayer });
        this.map.fire(ANVIL_EVENTS.DELETED, { layer: layer });
        this.map.removeLayer(this.firstLayer);
        this.map.removeLayer(layer);

        // Flatten result and add all parts
        const flattened = turf.flatten(united);
        flattened.features.forEach(f => {
            const newLayerGroup = L.geoJSON(f, {
                style: getModePathOptions(this.options, AnvilMode.Union),
            });
            const l = newLayerGroup.getLayers()[0] as L.Polygon;
            l.addTo(this.map);
            this.map.fire(ANVIL_EVENTS.CREATED, { layer: l });
        });

        this.firstLayer = null;
        this.firstLayerStyle = null;
    }

    private reset(): void {
        if (this.firstLayer) {
            this.firstLayer.setStyle(this.firstLayerStyle || {});
            this.firstLayer = null;
            this.firstLayerStyle = null;
        }
    }
}
