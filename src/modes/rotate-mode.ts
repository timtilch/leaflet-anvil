import * as L from 'leaflet';
import { AnvilOptions, Mode } from '../anvil';
import { LayerStore } from '../layers/layer-store';
import { ANVIL_EVENTS } from '../events';
import { AnvilMode } from '../types';
import { getModeSelectionPathOptions } from '../utils/mode-styles';

export class RotateMode implements Mode {
    private selectedLayer: L.Path | null = null;
    private centerLatLng: L.LatLng | null = null;
    private initialLatLngs: any = null;
    private startAngle: number = 0;
    private originalPathStyle: L.PathOptions | null = null;

    constructor(private map: L.Map, private store: LayerStore, private options: AnvilOptions = {}) {
    }

    enable(): void {
        this.store.getGroup().eachLayer(layer => {
            if (layer instanceof L.Path) {
                layer.on('mousedown', this.onMouseDown, this);
                (layer.getElement() as HTMLElement)?.style.setProperty('cursor', 'crosshair');
            }
        });
    }

    disable(): void {
        this.store.getGroup().eachLayer(layer => {
            if (layer instanceof L.Path) {
                layer.off('mousedown', this.onMouseDown, this);
                (layer.getElement() as HTMLElement)?.style.setProperty('cursor', '');
            }
        });
        this.stopRotating();
    }

    private onMouseDown(e: L.LeafletMouseEvent): void {
        L.DomEvent.stopPropagation(e);
        const layer = e.target as L.Layer;

        if (!this.store.hasLayer(layer) || !(layer instanceof L.Path) || (layer as any) instanceof L.Circle) {
            return;
        }

        const pathLayer = layer as L.Path;
        this.selectedLayer = pathLayer;
        const bounds = (pathLayer as any).getBounds();
        this.centerLatLng = bounds.getCenter();
        this.initialLatLngs = JSON.parse(JSON.stringify((pathLayer as any).getLatLngs()));
        this.originalPathStyle = { ...pathLayer.options };

        const point = this.map.latLngToContainerPoint(e.latlng);
        const centerPoint = this.map.latLngToContainerPoint(this.centerLatLng!);
        this.startAngle = Math.atan2(point.y - centerPoint.y, point.x - centerPoint.x);

        pathLayer.setStyle(
            getModeSelectionPathOptions(this.options, AnvilMode.Rotate, this.originalPathStyle, {
                weight: 4,
                color: '#ffcc00',
            }),
        );

        this.map.on('mousemove', this.onMouseMove, this);
        this.map.on('mouseup', this.onMouseUp, this);
        this.map.dragging.disable();
    }

    private onMouseMove(e: L.LeafletMouseEvent): void {
        if (!this.selectedLayer || !this.centerLatLng) return;

        const point = this.map.latLngToContainerPoint(e.latlng);
        const centerPoint = this.map.latLngToContainerPoint(this.centerLatLng);
        const currentAngle = Math.atan2(point.y - centerPoint.y, point.x - centerPoint.x);
        const rotationAngle = currentAngle - this.startAngle;

        const newLatLngs = this.rotateLatLngs(this.initialLatLngs, this.centerLatLng, rotationAngle);
        (this.selectedLayer as any).setLatLngs(newLatLngs);
    }

    private rotateLatLngs(latlngs: any, center: L.LatLng, angle: number): any {
        if (Array.isArray(latlngs)) {
            return latlngs.map(item => this.rotateLatLngs(item, center, angle));
        }

        const point = this.map.latLngToContainerPoint(latlngs);
        const centerPoint = this.map.latLngToContainerPoint(center);

        const cos = Math.cos(angle);
        const sin = Math.sin(angle);

        const dx = point.x - centerPoint.x;
        const dy = point.y - centerPoint.y;

        const nx = dx * cos - dy * sin + centerPoint.x;
        const ny = dx * sin + dy * cos + centerPoint.y;

        return this.map.containerPointToLatLng([nx, ny]);
    }

    private onMouseUp(): void {
        if (this.selectedLayer) {
            this.selectedLayer.setStyle(this.originalPathStyle || {});
            this.map.fire(ANVIL_EVENTS.EDITED, { layer: this.selectedLayer });
        }
        this.stopRotating();
    }

    private stopRotating(): void {
        this.map.off('mousemove', this.onMouseMove, this);
        this.map.off('mouseup', this.onMouseUp, this);
        this.map.dragging.enable();
        if (this.selectedLayer && this.originalPathStyle) {
            this.selectedLayer.setStyle(this.originalPathStyle);
        }
        this.selectedLayer = null;
        this.centerLatLng = null;
        this.initialLatLngs = null;
        this.originalPathStyle = null;
    }
}
