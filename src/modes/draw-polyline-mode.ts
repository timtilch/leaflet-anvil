import * as L from 'leaflet';
import { AnvilOptions, Mode } from '../anvil';
import { ANVIL_EVENTS } from '../events';
import { LayerStore } from '../layers/layer-store';
import { AnvilMode } from '../types';
import { getModeGhostPathOptions, getModePathOptions } from '../utils/mode-styles';
import { getSnapLatLng } from '../utils/snapping';
import { causesSelfIntersection } from '../utils/geometry';

export class DrawPolylineMode implements Mode {
    private points: L.LatLng[] = [];
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
        this.map.on('dblclick', this.onDoubleClick, this);
        L.DomEvent.on(window as any, 'keydown', this.onKeyDown as any, this);
        this.map.doubleClickZoom.disable();
        this.map.getContainer().style.cursor = 'crosshair';
    }

    disable(): void {
        this.map.off('click', this.onClick, this);
        this.map.off('mousemove', this.onMouseMove, this);
        this.map.off('dblclick', this.onDoubleClick, this);
        L.DomEvent.off(window as any, 'keydown', this.onKeyDown as any, this);
        this.map.doubleClickZoom.enable();
        this.map.getContainer().style.cursor = '';
        this.reset();
    }

    private onClick(e: L.LeafletMouseEvent): void {
        const latlng = this.store
            ? getSnapLatLng(this.map, e.latlng, this.store, this.options, this.points)
            : e.latlng;

        if (this.options.preventSelfIntersection && causesSelfIntersection(this.map, this.points, latlng)) {
            return;
        }

        this.points.push(latlng);
        this.updateDrawing();
    }

    private onMouseMove(e: L.LeafletMouseEvent): void {
        if (this.points.length === 0) return;

        const snapLatLng = this.store
            ? getSnapLatLng(this.map, e.latlng, this.store, this.options, this.points)
            : e.latlng;
        const lastPoint = this.points[this.points.length - 1];
        if (!this.ghostLine) {
            this.ghostLine = L.polyline(
                [lastPoint, e.latlng],
                getModeGhostPathOptions(this.options, AnvilMode.Polyline, {
                    dashArray: '5, 5',
                    color: '#3388ff',
                    weight: 2,
                }),
            ).addTo(this.map);
        } else {
            this.ghostLine.setLatLngs([lastPoint, snapLatLng]);
        }
    }

    private onDoubleClick(e: L.LeafletMouseEvent): void {
        L.DomEvent.stopPropagation(e);
        this.finish();
    }

    private onKeyDown(e: KeyboardEvent): void {
        if (e.key === 'Escape') {
            this.reset();
        } else if (e.key === 'Enter') {
            this.finish();
        }
    }

    private updateDrawing(): void {
        if (this.polyline) {
            this.polyline.setLatLngs(this.points);
        } else {
            this.polyline = L.polyline(
                this.points,
                getModePathOptions(this.options, AnvilMode.Polyline, { color: '#3388ff' }),
            ).addTo(this.map);
        }
    }

    private finish(): void {
        if (this.points.length < 2) return;
        const polyline = L.polyline(
            this.points,
            getModePathOptions(this.options, AnvilMode.Polyline),
        ).addTo(this.map);
        this.map.fire(ANVIL_EVENTS.CREATED, { layer: polyline });
        this.reset();
    }

    private reset(): void {
        if (this.polyline) this.map.removeLayer(this.polyline);
        if (this.ghostLine) this.map.removeLayer(this.ghostLine);
        this.points = [];
        this.polyline = null;
        this.ghostLine = null;
    }
}
