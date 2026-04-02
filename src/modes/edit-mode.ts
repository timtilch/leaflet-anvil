import * as L from 'leaflet';
import { AnvilOptions, Mode } from '../anvil';
import { ANVIL_EVENTS } from '../events';
import { LayerStore } from '../layers/layer-store';
import { AnvilMode } from '../types';
import { getModeHandleOptions, getModeSelectionPathOptions } from '../utils/mode-styles';
import { getSnapLatLng } from '../utils/snapping';
import { isSelfIntersecting } from '../utils/geometry';

export class EditMode implements Mode {
    private activeLayers = new Set<L.Layer>();
    private markers: L.Marker[] = [];
    private ghostMarker: L.Marker | null = null;
    private segments: { p1: L.LatLng, p2: L.LatLng, refs: { layer: L.Path, path: number[] }[] }[] = [];
    private _isDragging = false;
    private originalLayerStyles = new Map<L.Path, L.PathOptions>();

    constructor(
        private map: L.Map,
        private store: LayerStore,
        private options: AnvilOptions = {},
    ) {
    }

    enable(): void {
        this.store.getGroup().eachLayer(layer => {
            if (layer instanceof L.Path || layer instanceof L.Marker) {
                layer.on('click', this.onLayerClick, this);
                layer.on('mousemove', this.onMouseMove, this); // Also listen on layers
                (layer.getElement() as HTMLElement)?.style.setProperty('cursor', 'pointer');
            }
        });
        this.map.on('click', this.onMapClick, this);
        this.map.on('mousemove', this.onMouseMove, this);
    }

    disable(): void {
        this.store.getGroup().eachLayer(layer => {
            if (layer instanceof L.Path || layer instanceof L.Marker) {
                layer.off('click', this.onLayerClick, this);
                layer.off('mousemove', this.onMouseMove, this);
                (layer.getElement() as HTMLElement)?.style.setProperty('cursor', '');
            }
        });
        this.map.off('click', this.onMapClick, this);
        this.map.off('mousemove', this.onMouseMove, this);
        this.restoreAllPathStyles();
        this.clearMarkers();
        this.activeLayers.clear();
    }

    private onLayerClick(e: L.LeafletMouseEvent): void {
        L.DomEvent.stopPropagation(e);
        const layer = e.target as L.Layer;

        const isMultiSelect = e.originalEvent.shiftKey;

        if (!isMultiSelect) {
            // Clear current selection if clicking a new layer and not multi-selecting
            if (this.activeLayers.has(layer) && this.activeLayers.size === 1) return;

            this.restoreAllPathStyles();
            this.clearMarkers();
            this.activeLayers.clear();
            this.activeLayers.add(layer);
        } else {
            if (this.activeLayers.has(layer)) {
                this.activeLayers.delete(layer);
                if (layer instanceof L.Path) this.restorePathStyle(layer);
            } else {
                this.activeLayers.add(layer);
            }
            this.clearMarkers();
        }

        // Highlight selection
        this.activeLayers.forEach(l => {
            if (l instanceof L.Path) this.applySelectionStyle(l);
        });

        this.createMarkers();
    }

    private onMapClick(): void {
        this.restoreAllPathStyles();
        this.clearMarkers();
        this.activeLayers.clear();
    }

    private createMarkers(): void {
        this.clearMarkers(); // Ensure we start fresh
        if (this.activeLayers.size === 0) return;

        const vertexMap = new Map<string, { latlng: L.LatLng; refs: { layer: L.Path, path: number[] }[]; marker: L.Marker | null }>();
        this.segments = [];
        const segmentMap = new Map<string, { p1: L.LatLng, p2: L.LatLng, refs: { layer: L.Path, path: number[] }[] }>();

        const getPosKey = (ll: L.LatLng) => `${ll.lat.toFixed(6)},${ll.lng.toFixed(6)}`;

        this.activeLayers.forEach(layer => {
            if (layer instanceof L.Marker) {
                this.handleMarkerEdit(layer);
            } else if (layer instanceof L.Circle) {
                this.handleCircleEdit(layer);
            } else if (layer instanceof L.Polyline) { // This covers Polyline and Polygon
                const latlngs = (layer as L.Polyline).getLatLngs();

                const traverse = (arr: any, currentPath: number[]) => {
                    if (!arr) return;
                    // Check if we have an array of LatLngs directly
                    if (Array.isArray(arr) && arr.length > 0 && (arr[0] instanceof L.LatLng || (typeof arr[0].lat === 'number'))) {
                        const isPolygon = (layer as any) instanceof L.Polygon;

                        // Detect if the ring is explicitly closed (last point == first point)
                        let ringLen = arr.length;
                        if (isPolygon && ringLen > 1) {
                            if (getPosKey(arr[0]) === getPosKey(arr[ringLen - 1])) {
                                ringLen--; // Ignore last point for segment logic to avoid zero-length errors
                            }
                        }

                        arr.forEach((ll: L.LatLng, i: number) => {
                            if (i >= ringLen) return; // Skip redundant closing point

                            // Vertex
                            const key = getPosKey(ll);
                            if (!vertexMap.has(key)) vertexMap.set(key, { latlng: ll, refs: [], marker: null });
                            vertexMap.get(key)!.refs.push({ layer: layer as L.Polyline, path: [...currentPath, i] });

                            // Segment logic
                            if (i < ringLen - 1 || isPolygon) {
                                const nextIndex = (i + 1) % ringLen;
                                const nextLL = arr[nextIndex];

                                if (getPosKey(ll) === getPosKey(nextLL)) return; // Skip zero-length

                                const k1 = getPosKey(ll);
                                const k2 = getPosKey(nextLL);
                                const midKey = [k1, k2].sort().join('|');

                                if (!segmentMap.has(midKey)) {
                                    segmentMap.set(midKey, { p1: ll, p2: nextLL, refs: [] });
                                }
                                segmentMap.get(midKey)!.refs.push({ layer: layer as L.Polyline, path: [...currentPath, i] });
                            }
                        });
                    } else if (Array.isArray(arr)) {
                        arr.forEach((item, i) => traverse(item, [...currentPath, i]));
                    }
                };
                traverse(latlngs, []);
            }
        });

        this.segments = Array.from(segmentMap.values());

        // Create Vertex Markers
        vertexMap.forEach((group) => {
            const marker = this.createEditMarker(group.latlng);
            group.marker = marker;
            this.markers.push(marker);

            marker.on('dragstart', () => {
                this._isDragging = true;
            });
            marker.on('drag', (e: L.LeafletEvent) => {
                const mouseEvent = e as L.LeafletMouseEvent;
                const skipLayersArray = Array.from(this.activeLayers);
                const additionalPoints = [
                    ...this.markers.filter(m => m !== marker).map(m => m.getLatLng()),
                    ...Array.from(this.activeLayers).filter(l => l instanceof L.Marker).map(l => (l as L.Marker).getLatLng()),
                ];
                const snapped = getSnapLatLng(this.map, mouseEvent.latlng, this.store, this.options, additionalPoints, skipLayersArray);

                if (this.options.preventSelfIntersection) {
                    let wouldIntersect = false;

                    // Temporary update to check for intersections
                    group.refs.forEach(ref => {
                        const fullStructure = (ref.layer as L.Polyline).getLatLngs() as any;
                        let target: any = fullStructure;
                        for (let i = 0; i < ref.path.length - 1; i++) {
                            target = target[ref.path[i]];
                        }
                        const oldPos = target[ref.path[ref.path.length - 1]];
                        target[ref.path[ref.path.length - 1]] = snapped;

                        if (isSelfIntersecting(this.map, fullStructure, ref.layer instanceof L.Polygon)) {
                            wouldIntersect = true;
                        }

                        // Revert
                        target[ref.path[ref.path.length - 1]] = oldPos;
                    });

                    if (wouldIntersect) return;
                }

                marker.setLatLng(snapped);
                group.latlng = snapped;

                group.refs.forEach(ref => {
                    const fullStructure = (ref.layer as L.Polyline).getLatLngs();
                    let target: any = fullStructure;
                    for (let i = 0; i < ref.path.length - 1; i++) {
                        target = target[ref.path[i]];
                    }
                    target[ref.path[ref.path.length - 1]] = snapped;
                    (ref.layer as L.Polyline).setLatLngs(fullStructure);
                    ref.layer.redraw();
                });
            });

            marker.on('dragend', () => {
                this._isDragging = false;
                this.activeLayers.forEach(l => this.map.fire(ANVIL_EVENTS.EDITED, { layer: l }));
                this.refreshMarkers();
            });

            marker.on('contextmenu', (e: L.LeafletEvent) => {
                const mouseEvent = e as L.LeafletMouseEvent;
                L.DomEvent.stopPropagation(mouseEvent);
                this.deleteVertex(group);
            });
        });
    }

    private deleteVertex(group: { latlng: L.LatLng; refs: { layer: L.Path, path: number[] }[]; marker: L.Marker | null }): void {
        const layersToDelete = new Set<L.Layer>();

        group.refs.forEach(ref => {
            const fullStructure = (ref.layer as L.Polyline).getLatLngs() as any;
            let target: any = fullStructure;

            // Navigate to the correct nested array if necessary (for MultiPolyline/MultiPolygon)
            for (let i = 0; i < ref.path.length - 1; i++) {
                target = target[ref.path[i]];
            }

            const index = ref.path[ref.path.length - 1];

            // Determine minimum vertices to keep the shape valid
            const isPolygon = ref.layer instanceof L.Polygon;
            const minVertices = isPolygon ? 3 : 2;

            if (target.length > minVertices) {
                target.splice(index, 1);
                (ref.layer as L.Polyline).setLatLngs(fullStructure);
                ref.layer.redraw();
                this.map.fire(ANVIL_EVENTS.EDITED, { layer: ref.layer });
            } else {
                layersToDelete.add(ref.layer);
            }
        });

        layersToDelete.forEach(layer => {
            this.activeLayers.delete(layer);
            if (layer instanceof L.Path) {
                this.originalLayerStyles.delete(layer);
            }
            this.map.removeLayer(layer);
            this.map.fire(ANVIL_EVENTS.DELETED, { layer: layer });
        });

        this.refreshMarkers();
    }

    private onMouseMove(e: L.LeafletEvent): void {
        const mouseEvent = e as L.LeafletMouseEvent;
        if (this.activeLayers.size === 0 || this.segments.length === 0 || this._isDragging) {
            if (!this._isDragging) this.removeGhost();
            return;
        }

        const mousePoint = this.map.latLngToContainerPoint(mouseEvent.latlng);

        // FIX: Check if we are over an existing vertex marker to avoid blocking corner dragging
        const isOverVertex = this.markers.some(m => {
            const p = this.map.latLngToContainerPoint(m.getLatLng());
            return p.distanceTo(mousePoint) < 15;
        });

        if (isOverVertex) {
            this.removeGhost();
            return;
        }

        let closestSeg: typeof this.segments[0] | null = null;
        let minDistance = 24;
        let bestLatLng: L.LatLng | null = null;

        this.segments.forEach(seg => {
            const A = this.map.latLngToContainerPoint(seg.p1);
            const B = this.map.latLngToContainerPoint(seg.p2);
            const proj = L.LineUtil.closestPointOnSegment(mousePoint, A, B);
            const dist = mousePoint.distanceTo(proj);

            if (dist < minDistance) {
                minDistance = dist;
                closestSeg = seg;
                bestLatLng = this.map.containerPointToLatLng(proj);
            }
        });

        if (closestSeg && bestLatLng) {
            this.showGhost(bestLatLng, closestSeg);
        } else {
            this.removeGhost();
        }
    }

    private createEditMarker(latlng: L.LatLng): L.Marker {
        const visuals = this.getEditHandleVisuals();
        return L.marker(latlng, {
            draggable: true,
            zIndexOffset: 2000,
            icon: L.divIcon({
                className: 'anvil-edit-marker',
                html: this.createHandleHtml(visuals.size, visuals.fillColor, visuals.borderColor, visuals.borderWidth),
                iconSize: [visuals.size, visuals.size],
                iconAnchor: [visuals.size / 2, visuals.size / 2],
            }),
        }).addTo(this.map);
    }

    private showGhost(latlng: L.LatLng, segment: typeof this.segments[0]): void {
        if (this.ghostMarker) {
            if (!this._isDragging) {
                this.ghostMarker.setLatLng(latlng);
                // Update segment ref so dragging uses the correct segment even if marker is reused
                (this.ghostMarker as any)._activeSeg = segment;
            }
            return;
        }

        const visuals = this.getGhostHandleVisuals();
        this.ghostMarker = L.marker(latlng, {
            draggable: true,
            opacity: 0.7,
            zIndexOffset: 3000,
            icon: L.divIcon({
                className: 'anvil-ghost-marker',
                html: this.createHandleHtml(visuals.size, visuals.fillColor, visuals.borderColor, visuals.borderWidth),
                iconSize: [visuals.size, visuals.size],
                iconAnchor: [visuals.size / 2, visuals.size / 2],
            }),
        }).addTo(this.map);

        this.ghostMarker.on('dragstart', () => {
            this._isDragging = true;
            const activeSeg = (this.ghostMarker as any)._activeSeg || segment;
            const startLL = this.ghostMarker!.getLatLng();

            activeSeg.refs.forEach((ref: { layer: L.Path, path: number[] }) => {
                const fullStructure = (ref.layer as L.Polyline).getLatLngs() as any;
                let target: any = fullStructure;
                for (let i = 0; i < ref.path.length - 1; i++) {
                    target = target[ref.path[i]];
                }
                target.splice(ref.path[ref.path.length - 1] + 1, 0, startLL);
                (ref.layer as L.Polyline).setLatLngs(fullStructure);
            });
        });

        this.ghostMarker.on('drag', (e: L.LeafletEvent) => {
            const mouseEvent = e as L.LeafletMouseEvent;
            const skipLayersArray = Array.from(this.activeLayers);
            const additionalPoints = [
                ...this.markers.map(m => m.getLatLng()),
                ...Array.from(this.activeLayers).filter(l => l instanceof L.Marker).map(l => (l as L.Marker).getLatLng()),
            ];
            const snapped = getSnapLatLng(this.map, mouseEvent.latlng, this.store, this.options, additionalPoints, skipLayersArray);

            if (this.options.preventSelfIntersection) {
                let wouldIntersect = false;
                const activeSeg = (this.ghostMarker as any)._activeSeg || segment;

                activeSeg.refs.forEach((ref: { layer: L.Path, path: number[] }) => {
                    const fullStructure = (ref.layer as L.Polyline).getLatLngs() as any;
                    let target: any = fullStructure;
                    for (let i = 0; i < ref.path.length - 1; i++) {
                        target = target[ref.path[i]];
                    }
                    // Ghost marker logic: it's inserted at path + 1
                    const oldPos = target[ref.path[ref.path.length - 1] + 1];
                    target[ref.path[ref.path.length - 1] + 1] = snapped;

                    if (isSelfIntersecting(this.map, fullStructure, ref.layer instanceof L.Polygon)) {
                        wouldIntersect = true;
                    }

                    // Revert
                    target[ref.path[ref.path.length - 1] + 1] = oldPos;
                });

                if (wouldIntersect) return;
            }

            this.ghostMarker!.setLatLng(snapped);

            const activeSeg = (this.ghostMarker as any)._activeSeg || segment;
            activeSeg.refs.forEach((ref: { layer: L.Path, path: number[] }) => {
                const fullStructure = (ref.layer as L.Polyline).getLatLngs() as any;
                let target: any = fullStructure;
                for (let i = 0; i < ref.path.length - 1; i++) {
                    target = target[ref.path[i]];
                }
                target[ref.path[ref.path.length - 1] + 1] = snapped;
                (ref.layer as L.Polyline).setLatLngs(fullStructure);
                ref.layer.redraw();
            });
        });

        this.ghostMarker.on('dragend', () => {
            this._isDragging = false;
            this.activeLayers.forEach(l => this.map.fire(ANVIL_EVENTS.EDITED, { layer: l }));
            this.removeGhost();
            this.refreshMarkers();
        });
    }

    private removeGhost(): void {
        if (this.ghostMarker && !this._isDragging) {
            this.map.removeLayer(this.ghostMarker);
            this.ghostMarker = null;
        }
    }

    private handleMarkerEdit(marker: L.Marker): void {
        marker.dragging?.enable();
        marker.on('drag', (e: L.LeafletEvent) => {
            const mouseEvent = e as L.LeafletMouseEvent;
            const additionalPoints = this.markers.map(m => m.getLatLng());
            const snapped = getSnapLatLng(this.map, mouseEvent.latlng, this.store, this.options, additionalPoints, marker);
            marker.setLatLng(snapped);
        });
        marker.on('dragend', () => {
            this.map.fire(ANVIL_EVENTS.EDITED, { layer: marker });
        });
        marker.on('contextmenu', (e: L.LeafletEvent) => {
            const mouseEvent = e as L.LeafletMouseEvent;
            L.DomEvent.stopPropagation(mouseEvent);
            this.activeLayers.delete(marker);
            this.map.removeLayer(marker);
            this.map.fire(ANVIL_EVENTS.DELETED, { layer: marker });
            this.refreshMarkers();
        });
    }

    private handleCircleEdit(circle: L.Circle): void {
        const marker = this.createEditMarker(circle.getLatLng());
        marker.on('drag', (e: L.LeafletEvent) => {
            const mouseEvent = e as L.LeafletMouseEvent;
            const additionalPoints = this.markers.filter(m => m !== marker).map(m => m.getLatLng());
            const snapped = getSnapLatLng(this.map, mouseEvent.latlng, this.store, this.options, additionalPoints, circle);
            marker.setLatLng(snapped);
            circle.setLatLng(snapped);
        });
        marker.on('dragend', () => {
            this.map.fire(ANVIL_EVENTS.EDITED, { layer: circle });
        });
        marker.on('contextmenu', (e: L.LeafletEvent) => {
            const mouseEvent = e as L.LeafletMouseEvent;
            L.DomEvent.stopPropagation(mouseEvent);
            this.activeLayers.delete(circle);
            this.originalLayerStyles.delete(circle);
            this.map.removeLayer(circle);
            this.map.fire(ANVIL_EVENTS.DELETED, { layer: circle });
            this.refreshMarkers();
        });
        this.markers.push(marker);
    }

    private clearMarkers(): void {
        this.activeLayers.forEach(layer => {
            if (layer instanceof L.Marker) {
                layer.dragging?.disable();
                layer.off('drag');
                layer.off('dragend');
                layer.off('contextmenu');
            }
        });
        this.markers.forEach(m => this.map.removeLayer(m));
        this.markers = [];
        this.removeGhost();
    }

    private refreshMarkers(): void {
        this.clearMarkers();
        this.createMarkers();
    }

    private applySelectionStyle(layer: L.Path): void {
        if (!this.originalLayerStyles.has(layer)) {
            this.originalLayerStyles.set(layer, { ...layer.options });
        }

        layer.setStyle(
            getModeSelectionPathOptions(this.options, AnvilMode.Edit, this.originalLayerStyles.get(layer) || {}, {
                color: '#ff00ff',
                weight: 4,
            }),
        );
    }

    private restorePathStyle(layer: L.Path): void {
        const original = this.originalLayerStyles.get(layer);
        if (!original) return;

        layer.setStyle(original);
        this.originalLayerStyles.delete(layer);
    }

    private restoreAllPathStyles(): void {
        this.originalLayerStyles.forEach((style, layer) => {
            layer.setStyle(style);
        });
        this.originalLayerStyles.clear();
    }

    private getEditHandleVisuals(): { size: number; fillColor: string; borderColor: string; borderWidth: number } {
        const selection = getModeSelectionPathOptions(this.options, AnvilMode.Edit, {}, { color: '#ff00ff' });
        const handle = getModeHandleOptions(this.options, AnvilMode.Edit, {
            radius: 6,
            color: (selection.color as string | undefined) || '#ff00ff',
            fillColor: '#fff',
            fillOpacity: 1,
            weight: 2,
        });

        return {
            size: ((handle.radius as number | undefined) || 6) * 2,
            fillColor: (handle.fillColor as string | undefined) || '#fff',
            borderColor: (handle.color as string | undefined) || ((selection.color as string | undefined) || '#ff00ff'),
            borderWidth: (handle.weight as number | undefined) || 2,
        };
    }

    private getGhostHandleVisuals(): { size: number; fillColor: string; borderColor: string; borderWidth: number } {
        const selection = getModeSelectionPathOptions(this.options, AnvilMode.Edit, {}, { color: '#ff00ff' });
        const handle = getModeHandleOptions(this.options, AnvilMode.Edit, {
            radius: 5,
            color: '#fff',
            fillColor: (selection.color as string | undefined) || '#ff00ff',
            fillOpacity: 1,
            weight: 2,
        });

        return {
            size: ((handle.radius as number | undefined) || 5) * 2,
            fillColor: (handle.fillColor as string | undefined) || ((selection.color as string | undefined) || '#ff00ff'),
            borderColor: (handle.color as string | undefined) || '#fff',
            borderWidth: (handle.weight as number | undefined) || 2,
        };
    }

    private createHandleHtml(size: number, fillColor: string, borderColor: string, borderWidth: number): string {
        return `<div style="width: ${size}px; height: ${size}px; background: ${fillColor}; border: ${borderWidth}px solid ${borderColor}; border-radius: 50%; box-sizing: border-box; box-shadow: 0 0 4px rgba(0,0,0,0.3);"></div>`;
    }
}
