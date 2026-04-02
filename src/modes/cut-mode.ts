import * as L from 'leaflet';
import * as turf from '@turf/turf';
import { AnvilOptions, Mode } from '../anvil';
import { LayerStore } from '../layers/layer-store';
import { ANVIL_EVENTS } from '../events';
import { AnvilMode } from '../types';
import { getModeGhostPathOptions, getModeHandleOptions, getModePathOptions } from '../utils/mode-styles';
import { getSnapLatLng } from '../utils/snapping';

export class CutMode implements Mode {
    private points: L.LatLng[] = [];
    private markers: L.Layer[] = [];
    private polyline: L.Polyline | null = null;
    private ghostLine: L.Polyline | null = null;

    constructor(
        private map: L.Map,
        private store: LayerStore,
        private options: AnvilOptions = {},
    ) {
    }

    enable(): void {
        this.map.on('click', this.onMapClick, this);
        this.map.on('mousemove', this.onMouseMove, this);
        L.DomEvent.on(window as any, 'keydown', this.onKeyDown as any, this);
        this.map.getContainer().style.cursor = 'crosshair';
    }

    disable(): void {
        this.map.off('click', this.onMapClick, this);
        this.map.off('mousemove', this.onMouseMove, this);
        L.DomEvent.off(window as any, 'keydown', this.onKeyDown as any, this);
        this.resetDrawing();
        this.map.getContainer().style.cursor = '';
    }

    private onMapClick(e: L.LeafletMouseEvent): void {
        const latlng = getSnapLatLng(this.map, e.latlng, this.store, this.options, this.points);
        if (this.points.length > 0 && this.isFirstPoint(latlng)) {
            this.finish();
            return;
        }

        this.points.push(latlng);
        this.updateDrawing();
    }

    private isFirstPoint(latlng: L.LatLng): boolean {
        if (this.points.length < 3) return false;
        const firstPoint = this.points[0];
        const containerPoint = this.map.latLngToContainerPoint(latlng);
        const firstContainerPoint = this.map.latLngToContainerPoint(firstPoint);
        return containerPoint.distanceTo(firstContainerPoint) < 15;
    }

    private onMouseMove(e: L.LeafletMouseEvent): void {
        if (this.points.length === 0) return;

        const snapLatLng = getSnapLatLng(this.map, e.latlng, this.store, this.options, this.points);
        const lastPoint = this.points[this.points.length - 1];
        if (!this.ghostLine) {
            this.ghostLine = L.polyline(
                [lastPoint, snapLatLng],
                getModeGhostPathOptions(this.options, AnvilMode.Cut, {
                    dashArray: '5, 5',
                    color: '#ff0000',
                    weight: 2,
                }),
            ).addTo(this.map);
        } else {
            this.ghostLine.setLatLngs([lastPoint, snapLatLng]);
        }
    }

    private onKeyDown(e: KeyboardEvent): void {
        if (e.key === 'Escape') {
            this.resetDrawing();
        }
    }

    private updateDrawing(): void {
        if (this.polyline) {
            this.polyline.setLatLngs(this.points);
        } else {
            this.polyline = L.polyline(
                this.points,
                getModePathOptions(this.options, AnvilMode.Cut, { color: '#ff0000' }),
            ).addTo(this.map);
        }

        if (this.points.length === 1 && this.markers.length === 0) {
            const marker = L.circleMarker(
                this.points[0],
                getModeHandleOptions(this.options, AnvilMode.Cut, {
                    radius: 6,
                    color: '#ff0000',
                }),
            ).addTo(this.map);
            marker.on('click', (e) => {
                L.DomEvent.stopPropagation(e);
                if (this.points.length >= 3) this.finish();
            });
            this.markers.push(marker);
        }
    }

    private finish(): void {
        if (this.points.length < 3) return;

        const holeGeo = L.polygon(this.points).toGeoJSON();
        const intersectedLayers: L.Polygon[] = [];

        this.store.getGroup().eachLayer(layer => {
            if (layer instanceof L.Polygon) {
                const polyGeo = layer.toGeoJSON();
                if (turf.booleanIntersects(polyGeo as any, holeGeo as any)) {
                    intersectedLayers.push(layer);
                }
            }
        });

        if (intersectedLayers.length === 0) {
            this.resetDrawing();
            return;
        }

        intersectedLayers.forEach(polygon => {
            const polyGeo = polygon.toGeoJSON();
            const result = turf.difference(turf.featureCollection([polyGeo as any, holeGeo as any]));

            if (result) {
                this.map.fire(ANVIL_EVENTS.DELETED, { layer: polygon });
                this.map.removeLayer(polygon);

                const flattened = turf.flatten(result);
                flattened.features.forEach(f => {
                    const l = L.geoJSON(f, {
                        style: getModePathOptions(this.options, AnvilMode.Cut),
                    }).getLayers()[0] as L.Polygon;
                    l.addTo(this.map);
                    this.map.fire(ANVIL_EVENTS.CREATED, { layer: l });
                });
            }
        });

        this.resetDrawing();
    }

    private resetDrawing(): void {
        if (this.polyline) this.map.removeLayer(this.polyline);
        if (this.ghostLine) this.map.removeLayer(this.ghostLine);
        this.markers.forEach(m => this.map.removeLayer(m));
        this.points = [];
        this.markers = [];
        this.polyline = null;
        this.ghostLine = null;
    }
}
