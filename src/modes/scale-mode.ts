import * as L from 'leaflet';
import { AnvilOptions, Mode } from '../anvil';
import { LayerStore } from '../layers/layer-store';
import { ANVIL_EVENTS } from '../events';
import { AnvilMode } from '../types';
import { getModeSelectionPathOptions } from '../utils/mode-styles';

export class ScaleMode implements Mode {
    private selectedLayer: L.Layer | null = null;
    private centerLatLng: L.LatLng | null = null;
    private initialLatLngs: any = null;
    private initialRadius: number = 0;
    private initialDistance: number = 0;
    private originalPathStyle: L.PathOptions | null = null;

    constructor(private map: L.Map, private store: LayerStore, private options: AnvilOptions = {}) {
    }

    enable(): void {
        this.store.getGroup().eachLayer(layer => {
            if (layer instanceof L.Path) {
                layer.on('mousedown', this.onMouseDown, this);
                (layer.getElement() as HTMLElement)?.style.setProperty('cursor', 'nwse-resize');
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
        this.stopScaling();
    }

    private onMouseDown(e: L.LeafletMouseEvent): void {
        L.DomEvent.stopPropagation(e);
        const layer = e.target as L.Layer;

        // Ensure we only scale layers that are in our store
        if (!this.store.hasLayer(layer)) {
            return;
        }

        this.selectedLayer = layer;

        if (this.selectedLayer instanceof L.Circle) {
            this.centerLatLng = this.selectedLayer.getLatLng();
            this.initialRadius = this.selectedLayer.getRadius();
        }

        if (this.selectedLayer instanceof L.Path) {
            this.originalPathStyle = { ...this.selectedLayer.options };
            this.selectedLayer.setStyle(
                getModeSelectionPathOptions(this.options, AnvilMode.Scale, this.originalPathStyle, {
                    weight: 4,
                    color: '#ffcc00',
                }),
            );

            if (!(this.selectedLayer instanceof L.Circle)) {
                const bounds = (this.selectedLayer as any).getBounds();
                this.centerLatLng = bounds.getCenter();
                this.initialLatLngs = JSON.parse(JSON.stringify((this.selectedLayer as any).getLatLngs()));
            }
        }

        if (this.centerLatLng) {
            this.initialDistance = this.map.distance(this.centerLatLng, e.latlng);
            this.map.on('mousemove', this.onMouseMove, this);
            this.map.on('mouseup', this.onMouseUp, this);
            this.map.dragging.disable();
        }
    }

    private onMouseMove(e: L.LeafletMouseEvent): void {
        if (!this.selectedLayer || !this.centerLatLng || this.initialDistance === 0) return;

        const currentDistance = this.map.distance(this.centerLatLng, e.latlng);
        const ratio = currentDistance / this.initialDistance;

        if (this.selectedLayer instanceof L.Circle) {
            this.selectedLayer.setRadius(this.initialRadius * ratio);
        } else if (this.selectedLayer instanceof L.Path) {
            const newLatLngs = this.scaleLatLngs(this.initialLatLngs, this.centerLatLng, ratio);
            (this.selectedLayer as any).setLatLngs(newLatLngs);
        }
    }

    private scaleLatLngs(latlngs: any, center: L.LatLng, ratio: number): any {
        if (Array.isArray(latlngs)) {
            return latlngs.map(item => this.scaleLatLngs(item, center, ratio));
        }
        const lat = center.lat + (latlngs.lat - center.lat) * ratio;
        const lng = center.lng + (latlngs.lng - center.lng) * ratio;
        return L.latLng(lat, lng);
    }

    private onMouseUp(): void {
        if (this.selectedLayer) {
            if (this.selectedLayer instanceof L.Path) {
                this.selectedLayer.setStyle(this.originalPathStyle || {});
            }
            this.map.fire(ANVIL_EVENTS.EDITED, { layer: this.selectedLayer });
        }
        this.stopScaling();
    }

    private stopScaling(): void {
        this.map.off('mousemove', this.onMouseMove, this);
        this.map.off('mouseup', this.onMouseUp, this);
        this.map.dragging.enable();
        if (this.selectedLayer instanceof L.Path && this.originalPathStyle) {
            this.selectedLayer.setStyle(this.originalPathStyle);
        }
        this.selectedLayer = null;
        this.centerLatLng = null;
        this.initialLatLngs = null;
        this.originalPathStyle = null;
    }
}
