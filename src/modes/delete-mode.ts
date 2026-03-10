import * as L from 'leaflet';
import { Mode } from '../anvil';
import { ANVIL_EVENTS } from '../events';
import { LayerStore } from '../layers/layer-store';

export class DeleteMode implements Mode {
    private isEnabled = false;

    constructor(private map: L.Map, private store: LayerStore) {
        this.store.getGroup().on('layeradd', (e: any) => {
            if (this.isEnabled) {
                this.addLayerListener(e.layer);
            }
        });
    }

    enable(): void {
        this.isEnabled = true;
        this.store.getGroup().eachLayer(layer => {
            this.addLayerListener(layer);
        });
    }

    disable(): void {
        this.isEnabled = false;
        this.store.getGroup().eachLayer(layer => {
            this.removeLayerListener(layer);
        });
    }

    private addLayerListener(layer: L.Layer): void {
        layer.on('click', this.onClick, this);
        if (layer instanceof L.Path || layer instanceof L.Marker) {
            (layer.getElement() as HTMLElement)?.style.setProperty('cursor', 'pointer');
        }
    }

    private removeLayerListener(layer: L.Layer): void {
        layer.off('click', this.onClick, this);
        if (layer instanceof L.Path || layer instanceof L.Marker) {
            (layer.getElement() as HTMLElement)?.style.setProperty('cursor', '');
        }
    }

    private onClick(e: L.LeafletMouseEvent): void {
        L.DomEvent.stopPropagation(e);
        const layer = e.target as L.Layer;
        this.map.removeLayer(layer);
        this.map.fire(ANVIL_EVENTS.DELETED, { layer: layer });
    }
}
