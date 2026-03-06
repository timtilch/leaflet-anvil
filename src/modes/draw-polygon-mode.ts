import * as L from 'leaflet';
import { AnvilOptions, Mode } from '../anvil';
import { ANVIL_EVENTS } from '../events';
import { LayerStore } from '../layers/layer-store';
import { getSnapLatLng } from '../utils/snapping';
import { causesSelfIntersection } from '../utils/geometry';

export class DrawPolygonMode implements Mode {
    private points: L.LatLng[] = [];
    private markers: L.Layer[] = [];
    private polyline: L.Polyline | null = null;
    private ghostLine: L.Polyline | null = null;

    constructor(
        private map: L.Map,
        private options: AnvilOptions = {},
        private store?: LayerStore,
    ) {
    }

    enable(): void {
        this.map.on('click', this.onClick, this);
        this.map.on('mousemove', this.onMouseMove, this);
        L.DomEvent.on(window as any, 'keydown', this.onKeyDown as any, this);
        this.map.getContainer().style.cursor = 'crosshair';
    }

    disable(): void {
        this.map.off('click', this.onClick, this);
        this.map.off('mousemove', this.onMouseMove, this);
        L.DomEvent.off(window as any, 'keydown', this.onKeyDown as any, this);
        this.map.getContainer().style.cursor = '';
        this.reset();
    }

    private onClick(e: L.LeafletMouseEvent): void {
        const latlng = this.store
            ? getSnapLatLng(this.map, e.latlng, this.store, this.options, this.points)
            : e.latlng;

        if (this.points.length > 0 && this.isFirstPoint(latlng)) {
            // Check if closing segment is valid (last point to first point)
            if (this.options.preventSelfIntersection && causesSelfIntersection(this.map, this.points, this.points[0])) {
                return;
            }
            this.finish();
            return;
        }

        if (this.options.preventSelfIntersection && causesSelfIntersection(this.map, this.points, latlng)) {
            return;
        }

        this.points.push(latlng);
        this.updateDrawing();
    }

    private isFirstPoint(latlng: L.LatLng): boolean {
        if (this.points.length < 3) return false;
        const firstPoint = this.points[0];

        // If snapped exactly to the first point
        if (latlng.equals(firstPoint)) return true;

        const containerPoint = this.map.latLngToContainerPoint(latlng);
        const firstContainerPoint = this.map.latLngToContainerPoint(firstPoint);
        return containerPoint.distanceTo(firstContainerPoint) < (this.options.snapDistance || 10);
    }

    private onMouseMove(e: L.LeafletMouseEvent): void {
        if (this.points.length === 0) return;

        const snapLatLng = this.store
            ? getSnapLatLng(this.map, e.latlng, this.store, this.options, this.points)
            : e.latlng;
        const lastPoint = this.points[this.points.length - 1];
        if (!this.ghostLine) {
            this.ghostLine = L.polyline([lastPoint, snapLatLng], {
                dashArray: '5, 5',
                color: '#3388ff',
                weight: 2,
            }).addTo(this.map);
        } else {
            this.ghostLine.setLatLngs([lastPoint, snapLatLng]);
        }
    }

    private onKeyDown(e: KeyboardEvent): void {
        if (e.key === 'Escape') {
            this.reset();
        }
    }

    private updateDrawing(): void {
        if (this.polyline) {
            this.polyline.setLatLngs(this.points);
        } else {
            this.polyline = L.polyline(this.points, { color: '#3388ff' }).addTo(this.map);
        }

        // Add a marker for the first point to make it easier to click
        if (this.points.length === 1 && this.markers.length === 0) {
            const marker = L.circleMarker(this.points[0], {
                radius: 5,
                fillColor: '#fff',
                fillOpacity: 1,
                color: '#3388ff',
                weight: 2,
            }).addTo(this.map);
            marker.on('click', (e) => {
                L.DomEvent.stopPropagation(e);
                this.finish();
            });
            this.markers.push(marker);
        }
    }

    private finish(): void {
        if (this.points.length < 3) return;
        const polygon = L.polygon(this.points).addTo(this.map);
        this.map.fire(ANVIL_EVENTS.CREATED, { layer: polygon });
        this.reset();
    }

    private reset(): void {
        if (this.polyline) this.map.removeLayer(this.polyline);
        if (this.ghostLine) this.map.removeLayer(this.ghostLine);
        this.markers.forEach(m => this.map.removeLayer(m));
        this.points = [];
        this.markers = [];
        this.polyline = null;
        this.ghostLine = null;
    }
}
