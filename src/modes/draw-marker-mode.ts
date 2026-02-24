import * as L from 'leaflet';
import { AnvilOptions, Mode } from '../anvil';
import { ANVIL_EVENTS } from '../events';
import { LayerStore } from '../layers/layer-store';
import { getSnapLatLng } from '../utils/snapping';

export class DrawMarkerMode implements Mode {
    constructor(
        private map: L.Map,
        private options: AnvilOptions = {},
        private store?: LayerStore,
    ) {
    }

    enable(): void {
        this.map.on('click', this.onClick, this);
        this.map.getContainer().style.cursor = 'crosshair';
    }

    disable(): void {
        this.map.off('click', this.onClick, this);
        this.map.getContainer().style.cursor = '';
    }

    private onClick(e: L.LeafletMouseEvent): void {
        const latlng = this.store ? getSnapLatLng(this.map, e.latlng, this.store, this.options) : e.latlng;
        const marker = L.marker(latlng).addTo(this.map);
        this.map.fire(ANVIL_EVENTS.CREATED, { layer: marker });
    }
}
