import * as L from 'leaflet';
import { AnvilOptions, Mode } from '../anvil';
import { ANVIL_EVENTS } from '../events';
import { LayerStore } from '../layers/layer-store';
import { getSnapLatLng } from '../utils/snapping';

export class DrawSquareMode implements Mode {
    private rectangle: L.Rectangle | null = null;
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
        const squareBounds = this.getSquareBounds(this.startLatLng, currentLatLng);

        if (!this.rectangle) {
            this.rectangle = L.rectangle(squareBounds, { color: '#3388ff', weight: 2 }).addTo(this.map);
        } else {
            this.rectangle.setBounds(squareBounds);
        }
    }

    private onMouseUp(e: L.LeafletMouseEvent): void {
        if (!this.startLatLng) return;

        const currentLatLng = this.store ? getSnapLatLng(this.map, e.latlng, this.store, this.options) : e.latlng;
        const squareBounds = this.getSquareBounds(this.startLatLng, currentLatLng);

        const polygon = L.polygon([
            squareBounds.getNorthWest(),
            squareBounds.getNorthEast(),
            squareBounds.getSouthEast(),
            squareBounds.getSouthWest(),
        ]).addTo(this.map);

        this.map.fire(ANVIL_EVENTS.CREATED, { layer: polygon });
        this.reset();
    }

    private getSquareBounds(start: L.LatLng, end: L.LatLng): L.LatLngBounds {
        const startPoint = this.map.latLngToContainerPoint(start);
        const endPoint = this.map.latLngToContainerPoint(end);

        const dx = endPoint.x - startPoint.x;
        const dy = endPoint.y - startPoint.y;

        const side = Math.max(Math.abs(dx), Math.abs(dy));

        const newEndPoint = L.point(
            startPoint.x + side * Math.sign(dx),
            startPoint.y + side * Math.sign(dy),
        );

        return L.latLngBounds(start, this.map.containerPointToLatLng(newEndPoint));
    }

    private reset(): void {
        if (this.rectangle) this.map.removeLayer(this.rectangle);
        this.rectangle = null;
        this.startLatLng = null;
    }
}

