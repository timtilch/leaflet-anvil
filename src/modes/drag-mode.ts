import * as L from 'leaflet';
import { AnvilOptions, Mode } from '../anvil';
import { LayerStore } from '../layers/layer-store';
import { ANVIL_EVENTS } from '../events';
import { getSnapLatLng } from '../utils/snapping';

export class DragMode implements Mode {
    private isEnabled = false;
    private draggingLayer: L.Layer | null = null;
    private startLatLng: L.LatLng | null = null;
    private initialLatLngs: any = null;

    constructor(
        private map: L.Map,
        private store: LayerStore,
        private options: AnvilOptions = {},
    ) {
        this.store.getGroup().on('layeradd', (e: any) => {
            if (this.isEnabled) {
                this.addLayerListener(e.layer);
            }
        });
    }

    enable(): void {
        this.isEnabled = true;
        this.store.getGroup().eachLayer(layer => {
            this.addLayerListener(layer);
        });
    }

    disable(): void {
        this.isEnabled = false;
        this.store.getGroup().eachLayer(layer => {
            this.removeLayerListener(layer);
        });
        this.stopDragging();
    }

    private addLayerListener(layer: L.Layer): void {
        if (layer instanceof L.Path || layer instanceof L.Marker) {
            layer.on('mousedown', this.onMouseDown, this);
            (layer.getElement() as HTMLElement)?.style.setProperty('cursor', 'move');
        }
    }

    private removeLayerListener(layer: L.Layer): void {
        if (layer instanceof L.Path || layer instanceof L.Marker) {
            layer.off('mousedown', this.onMouseDown, this);
            (layer.getElement() as HTMLElement)?.style.setProperty('cursor', '');
        }
    }

    private onMouseDown(e: L.LeafletMouseEvent): void {
        L.DomEvent.stopPropagation(e);
        const layer = e.target as L.Layer;

        // Ensure we only drag layers that are in our store
        if (!this.store.hasLayer(layer)) {
            return;
        }

        this.draggingLayer = layer;
        this.startLatLng = e.latlng;

        if (this.draggingLayer instanceof L.Marker) {
            this.initialLatLngs = this.draggingLayer.getLatLng();
        } else if (this.draggingLayer instanceof L.Path) {
            if (this.draggingLayer instanceof L.Circle) {
                this.initialLatLngs = this.draggingLayer.getLatLng();
            } else if (this.draggingLayer instanceof L.Polyline) {
                this.initialLatLngs = JSON.parse(JSON.stringify(this.draggingLayer.getLatLngs()));
            }
            // Highlight
            this.draggingLayer.setStyle({ weight: 4, color: '#ffcc00' });
        }

        this.map.on('mousemove', this.onMouseMove, this);
        this.map.on('mouseup', this.onMouseUp, this);
        this.map.dragging.disable();
    }

    private onMouseMove(e: L.LeafletMouseEvent): void {
        if (!this.draggingLayer || !this.startLatLng) return;

        // Apply snapping, skipping the layer we are currently dragging
        const currentLatLng = getSnapLatLng(
            this.map,
            e.latlng,
            this.store,
            this.options,
            [],
            this.draggingLayer,
        );

        const deltaLat = currentLatLng.lat - this.startLatLng.lat;
        const deltaLng = currentLatLng.lng - this.startLatLng.lng;

        if (this.draggingLayer instanceof L.Marker || this.draggingLayer instanceof L.Circle) {
            const start = this.initialLatLngs as L.LatLng;
            (this.draggingLayer as any).setLatLng([start.lat + deltaLat, start.lng + deltaLng]);
        } else if (this.draggingLayer instanceof L.Polyline) {
            const newLatLngs = this.moveLatLngs(this.initialLatLngs, deltaLat, deltaLng);
            this.draggingLayer.setLatLngs(newLatLngs);
        }
    }

    private moveLatLngs(latlngs: any, deltaLat: number, deltaLng: number): any {
        if (Array.isArray(latlngs)) {
            return latlngs.map(item => this.moveLatLngs(item, deltaLat, deltaLng));
        }
        return L.latLng(latlngs.lat + deltaLat, latlngs.lng + deltaLng);
    }

    private onMouseUp(): void {
        if (this.draggingLayer) {
            if (this.draggingLayer instanceof L.Path) {
                this.draggingLayer.setStyle({ weight: 3, color: '#3388ff' });
            }
            this.map.fire(ANVIL_EVENTS.EDITED, { layer: this.draggingLayer });
        }
        this.stopDragging();
    }

    private stopDragging(): void {
        this.map.off('mousemove', this.onMouseMove, this);
        this.map.off('mouseup', this.onMouseUp, this);
        this.map.dragging.enable();
        this.draggingLayer = null;
        this.startLatLng = null;
        this.initialLatLngs = null;
    }
}
