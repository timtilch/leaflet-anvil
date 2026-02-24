import * as L from 'leaflet';
import { AnvilOptions, Mode } from '../anvil';
import { ANVIL_EVENTS } from '../events';
import { LayerStore } from '../layers/layer-store';
import { getSnapLatLng } from '../utils/snapping';

export class DrawCircleMode implements Mode {
    private circle: L.Circle | null = null;
    private centerLatLng: L.LatLng | null = null;

    constructor(
        private map: L.Map,
        private options: AnvilOptions = {},
        private store?: LayerStore,
    ) {
    }

    enable(): void {
        this.map.on('mousedown', this.onMouseDown, this);
        this.map.on('mousemove', this.onMouseMove, this);
        this.map.on('mouseup', this.onMouseUp, this);
        this.map.dragging.disable();
        this.map.getContainer().style.cursor = 'crosshair';
    }

    disable(): void {
        this.map.off('mousedown', this.onMouseDown, this);
        this.map.off('mousemove', this.onMouseMove, this);
        this.map.off('mouseup', this.onMouseUp, this);
        this.map.dragging.enable();
        this.map.getContainer().style.cursor = '';
        this.reset();
    }

    private onMouseDown(e: L.LeafletMouseEvent): void {
        this.centerLatLng = this.store ? getSnapLatLng(this.map, e.latlng, this.store, this.options) : e.latlng;
    }

    private onMouseMove(e: L.LeafletMouseEvent): void {
        if (!this.centerLatLng) return;

        const currentLatLng = this.store ? getSnapLatLng(this.map, e.latlng, this.store, this.options) : e.latlng;
        const radius = this.map.distance(this.centerLatLng, currentLatLng);
        if (!this.circle) {
            this.circle = L.circle(this.centerLatLng, { radius, color: '#3388ff', weight: 2 }).addTo(this.map);
        } else {
            this.circle.setRadius(radius);
        }
    }

    private onMouseUp(e: L.LeafletMouseEvent): void {
        if (!this.centerLatLng) return;

        const currentLatLng = this.store ? getSnapLatLng(this.map, e.latlng, this.store, this.options) : e.latlng;
        const radius = this.map.distance(this.centerLatLng, currentLatLng);
        const circle = L.circle(this.centerLatLng, { radius }).addTo(this.map);
        this.map.fire(ANVIL_EVENTS.CREATED, { layer: circle });
        this.reset();
    }

    private reset(): void {
        if (this.circle) this.map.removeLayer(this.circle);
        this.circle = null;
        this.centerLatLng = null;
    }
}
