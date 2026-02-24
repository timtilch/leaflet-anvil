import * as L from 'leaflet';
import { AnvilOptions, Mode } from '../anvil';
import { ANVIL_EVENTS } from '../events';
import { LayerStore } from '../layers/layer-store';
import { getSnapLatLng } from '../utils/snapping';

export class DrawTriangleMode implements Mode {
    private ghostTriangle: L.Polygon | null = null;
    private startLatLng: L.LatLng | null = null;

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
        this.startLatLng = this.store ? getSnapLatLng(this.map, e.latlng, this.store, this.options) : e.latlng;
    }

    private onMouseMove(e: L.LeafletMouseEvent): void {
        if (!this.startLatLng) return;

        const currentLatLng = this.store ? getSnapLatLng(this.map, e.latlng, this.store, this.options) : e.latlng;
        const trianglePoints = this.getTrianglePoints(this.startLatLng, currentLatLng);

        if (!this.ghostTriangle) {
            this.ghostTriangle = L.polygon(trianglePoints, { color: '#3388ff', weight: 2 }).addTo(this.map);
        } else {
            this.ghostTriangle.setLatLngs(trianglePoints);
        }
    }

    private onMouseUp(e: L.LeafletMouseEvent): void {
        if (!this.startLatLng) return;

        const currentLatLng = this.store ? getSnapLatLng(this.map, e.latlng, this.store, this.options) : e.latlng;
        const trianglePoints = this.getTrianglePoints(this.startLatLng, currentLatLng);

        const polygon = L.polygon(trianglePoints).addTo(this.map);

        this.map.fire(ANVIL_EVENTS.CREATED, { layer: polygon });
        this.reset();
    }

    private getTrianglePoints(start: L.LatLng, end: L.LatLng): L.LatLng[] {
        const midLng = (start.lng + end.lng) / 2;

        // Tip follows vertical mouse position (end.lat)
        // Base stays at the starting vertical position (start.lat)
        const tip = L.latLng(end.lat, midLng);
        const baseLeft = L.latLng(start.lat, start.lng);
        const baseRight = L.latLng(start.lat, end.lng);

        return [
            tip,
            baseRight,
            baseLeft,
        ];
    }

    private reset(): void {
        if (this.ghostTriangle) this.map.removeLayer(this.ghostTriangle);
        this.ghostTriangle = null;
        this.startLatLng = null;
    }
}
