import * as L from 'leaflet';
import { Mode } from '../anvil';
import { ANVIL_EVENTS } from '../events';
import { LayerStore } from '../layers/layer-store';

export class DeleteMode implements Mode {
    constructor(private map: L.Map, private store: LayerStore) {
    }

    enable(): void {
        this.store.getGroup().eachLayer(layer => {
            layer.on('click', this.onClick, this);
            if (layer instanceof L.Path || layer instanceof L.Marker) {
                (layer.getElement() as HTMLElement)?.style.setProperty('cursor', 'pointer');
            }
        });
    }

    disable(): void {
        this.store.getGroup().eachLayer(layer => {
            layer.off('click', this.onClick, this);
            if (layer instanceof L.Path || layer instanceof L.Marker) {
                (layer.getElement() as HTMLElement)?.style.setProperty('cursor', '');
            }
        });
    }

    private onClick(e: L.LeafletMouseEvent): void {
        L.DomEvent.stopPropagation(e);
        const layer = e.target as L.Layer;
        this.map.removeLayer(layer);
        this.map.fire(ANVIL_EVENTS.DELETED, { layer: layer });
    }
}
