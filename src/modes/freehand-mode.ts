import * as L from 'leaflet';
import * as turf from '@turf/turf';
import { AnvilOptions, Mode } from '../anvil';
import { LayerStore } from '../layers/layer-store';
import { ANVIL_EVENTS } from '../events';
import { AnvilMode } from '../types';
import { getModeGhostPathOptions, getModePathOptions } from '../utils/mode-styles';

export class FreehandMode implements Mode {
    private points: L.LatLng[] = [];
    private polyline: L.Polyline | null = null;
    private isDrawing = false;

    constructor(
        private map: L.Map,
        _store: LayerStore,
        private options: AnvilOptions = {},
    ) {
    }

    enable(): void {
        this.map.dragging.disable(); // Prevent map move while drawing
        this.map.on('mousedown', this.onMouseDown, this);
        this.map.on('mousemove', this.onMouseMove, this);
        this.map.on('mouseup', this.onMouseUp, this);
        L.DomEvent.on(window as any, 'keydown', this.onKeyDown as any, this);
        this.map.getContainer().style.cursor = 'crosshair';
    }

    disable(): void {
        this.map.dragging.enable();
        this.map.off('mousedown', this.onMouseDown, this);
        this.map.off('mousemove', this.onMouseMove, this);
        this.map.off('mouseup', this.onMouseUp, this);
        L.DomEvent.off(window as any, 'keydown', this.onKeyDown as any, this);
        this.map.getContainer().style.cursor = '';
        this.resetDrawing();
    }

    private onMouseDown(e: L.LeafletMouseEvent): void {
        this.isDrawing = true;
        this.points = [e.latlng];
        this.updateDrawing();
    }

    private onMouseMove(e: L.LeafletMouseEvent): void {
        if (!this.isDrawing) return;

        const lastPoint = this.points[this.points.length - 1];
        if (lastPoint.distanceTo(e.latlng) > 5) { // Threshold for adding points
            this.points.push(e.latlng);
            this.updateDrawing();
        }
    }

    private onMouseUp(): void {
        if (!this.isDrawing) return;
        this.finish();
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
                getModeGhostPathOptions(this.options, AnvilMode.Freehand, {
                    color: '#3388ff',
                    weight: 3,
                    opacity: 0.8,
                    dashArray: '5, 5',
                }),
            ).addTo(this.map);
        }
    }

    private finish(): void {
        if (this.points.length < 3) {
            this.resetDrawing();
            return;
        }

        // Use Turf to simplify the freehand line
        const lineGeo = L.polyline(this.points).toGeoJSON();
        const tolerance = (this.options as any).freehandTolerance || 0.00001;
        const simplified = turf.simplify(lineGeo, { tolerance, highQuality: true });

        // Final result as a polygon
        const finalCoords = turf.getCoords(simplified) as [number, number][];
        // Ensure it is closed for Turf polygon
        if (finalCoords.length > 0 && (finalCoords[0][0] !== finalCoords[finalCoords.length - 1][0] || finalCoords[0][1] !== finalCoords[finalCoords.length - 1][1])) {
            finalCoords.push(finalCoords[0]);
        }

        const finalPolygon = L.polygon(
            finalCoords.map(c => [c[1], c[0]]) as L.LatLngExpression[],
            getModePathOptions(this.options, AnvilMode.Freehand),
        ).addTo(this.map);

        this.map.fire(ANVIL_EVENTS.CREATED, { layer: finalPolygon });
        this.resetDrawing();
    }

    private resetDrawing(): void {
        if (this.polyline) this.map.removeLayer(this.polyline);
        this.polyline = null;
        this.points = [];
        this.isDrawing = false;
    }
}
