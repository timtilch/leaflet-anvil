import * as L from 'leaflet';
import { AnvilOptions, Mode } from '../anvil';
import { ANVIL_EVENTS } from '../events';
import { LayerStore } from '../layers/layer-store';
import { AnvilMode } from '../types';
import { getModeHandleOptions, getModeSelectionPathOptions } from '../utils/mode-styles';
import { getSnapLatLng } from '../utils/snapping';
import { segmentsIntersect } from '../utils/geometry';

export interface EditModeConfig {
    modeId?: AnvilMode;
    autoSelectAll?: boolean;
    allowLayerSelection?: boolean;
    clearSelectionOnMapClick?: boolean;
    defaultSelectionPathOptions?: L.PathOptions;
    defaultHandleOptions?: L.CircleMarkerOptions;
    defaultGhostHandleOptions?: L.CircleMarkerOptions;
}

type VertexRef = { layer: L.Path; path: number[] };
type VertexGroup = { latlng: L.LatLng; refs: VertexRef[]; marker: L.CircleMarker | null };
type SegmentRef = { layer: L.Path; path: number[] };
type SegmentGroup = { p1: L.LatLng; p2: L.LatLng; refs: SegmentRef[] };
type HandleMeta =
    | { kind: 'vertex'; group: VertexGroup }
    | { kind: 'circle'; circle: L.Circle };
type DragState =
    | { kind: 'vertex'; group: VertexGroup; marker: L.CircleMarker }
    | { kind: 'ghost'; segment: SegmentGroup; marker: L.CircleMarker }
    | { kind: 'circle'; circle: L.Circle; marker: L.CircleMarker };

export class EditMode implements Mode {
    private activeLayers = new Set<L.Layer>();
    private markers: L.CircleMarker[] = [];
    private ghostMarker: L.CircleMarker | null = null;
    private segments: SegmentGroup[] = [];
    private isDragging = false;
    private dragState: DragState | null = null;
    private suppressNextClick = false;
    private originalLayerStyles = new Map<L.Path, L.PathOptions>();
    private handleRenderer?: L.Renderer;
    private readonly handlePaneName = 'anvil-edit-handles';
    private readonly config: Required<EditModeConfig>;

    constructor(
        private map: L.Map,
        private store: LayerStore,
        private options: AnvilOptions = {},
        config: EditModeConfig = {},
    ) {
        this.config = {
            modeId: AnvilMode.Edit,
            autoSelectAll: false,
            allowLayerSelection: true,
            clearSelectionOnMapClick: true,
            defaultSelectionPathOptions: {
                color: '#ff00ff',
                weight: 4,
            },
            defaultHandleOptions: {
                radius: 6,
                color: '#ff00ff',
                fillColor: '#fff',
                fillOpacity: 1,
                weight: 2,
            },
            defaultGhostHandleOptions: {
                radius: 5,
                color: '#fff',
                fillColor: '#ff00ff',
                fillOpacity: 0.85,
                weight: 2,
            },
            ...config,
        };
    }

    enable(): void {
        this.ensureHandlePane();
        this.handleRenderer = this.createHandleRenderer();

        this.store.getGroup().eachLayer(layer => {
            this.bindLayerEvents(layer);
        });

        this.map.on('click', this.onMapClick, this);
        this.map.on('mousedown', this.onMapMouseDown, this);
        this.map.on('mousemove', this.onMapMouseMove, this);
        this.map.on('mouseup', this.onMapMouseUp, this);
        this.map.on('contextmenu', this.onMapContextMenu, this);
        this.map.on(ANVIL_EVENTS.CREATED, this.onLayerCreated, this);
        this.map.on(ANVIL_EVENTS.DELETED, this.onLayerDeleted, this);
        L.DomEvent.on(window as any, 'mousemove', this.onWindowMouseMove as any, this);
        L.DomEvent.on(window as any, 'mouseup', this.onWindowMouseUp as any, this);

        if (this.config.autoSelectAll) {
            this.syncAutoSelection();
        }
    }

    disable(): void {
        this.finishDrag(false);

        this.store.getGroup().eachLayer(layer => {
            this.unbindLayerEvents(layer);
        });

        this.map.off('click', this.onMapClick, this);
        this.map.off('mousedown', this.onMapMouseDown, this);
        this.map.off('mousemove', this.onMapMouseMove, this);
        this.map.off('mouseup', this.onMapMouseUp, this);
        this.map.off('contextmenu', this.onMapContextMenu, this);
        this.map.off(ANVIL_EVENTS.CREATED, this.onLayerCreated, this);
        this.map.off(ANVIL_EVENTS.DELETED, this.onLayerDeleted, this);
        L.DomEvent.off(window as any, 'mousemove', this.onWindowMouseMove as any, this);
        L.DomEvent.off(window as any, 'mouseup', this.onWindowMouseUp as any, this);

        this.restoreAllPathStyles();
        this.clearMarkers();
        this.activeLayers.clear();
    }

    private onLayerClick(e: L.LeafletMouseEvent): void {
        if (this.suppressNextClick) {
            this.stopLeafletEvent(e);
            return;
        }

        this.stopLeafletEvent(e);
        this.blurActiveElement();

        if (!this.config.allowLayerSelection) {
            return;
        }

        const layer = e.target as L.Layer;
        const isMultiSelect = e.originalEvent.shiftKey || this.options.magnetic;

        if (!isMultiSelect) {
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

        this.activeLayers.forEach(activeLayer => {
            if (activeLayer instanceof L.Path) this.applySelectionStyle(activeLayer);
        });

        this.createMarkers();
    }

    private onMapClick(): void {
        if (this.suppressNextClick) {
            this.suppressNextClick = false;
            return;
        }

        if (this.isDragging) return;
        if (!this.config.clearSelectionOnMapClick) return;

        this.restoreAllPathStyles();
        this.clearMarkers();
        this.activeLayers.clear();
    }

    private onLayerCreated(e: { layer: L.Layer }): void {
        this.bindLayerEvents(e.layer);
        if (this.config.autoSelectAll) this.syncAutoSelection();
    }

    private onLayerDeleted(e: { layer: L.Layer }): void {
        this.unbindLayerEvents(e.layer);
        this.activeLayers.delete(e.layer);
        if (e.layer instanceof L.Path) this.originalLayerStyles.delete(e.layer);
        if (this.config.autoSelectAll) this.syncAutoSelection();
    }

    private onMapMouseDown(e: L.LeafletMouseEvent): void {
        if (this.activeLayers.size === 0 || this.dragState) return;

        const hit = this.hitTestHandle(e.latlng);
        if (!hit) return;

        this.stopLeafletEvent(e);
        this.blurActiveElement();
        this.suppressNextClick = true;

        if (hit.kind === 'ghost') {
            this.startGhostDrag(hit.segment, hit.marker);
            return;
        }

        if (hit.kind === 'circle') {
            this.startCircleDrag(hit.circle, hit.marker);
            return;
        }

        this.startVertexDrag(hit.group, hit.marker);
    }

    private onMapMouseMove(e: L.LeafletMouseEvent): void {
        if (this.dragState) {
            this.updateDrag(e.latlng);
            return;
        }

        if (this.activeLayers.size === 0 || this.segments.length === 0) {
            this.removeGhost();
            return;
        }

        const mousePoint = this.map.latLngToContainerPoint(e.latlng);
        const isOverVertex = this.markers.some(marker => {
            const markerPoint = this.map.latLngToContainerPoint(marker.getLatLng());
            return markerPoint.distanceTo(mousePoint) < 15;
        });

        if (isOverVertex) {
            this.removeGhost();
            return;
        }

        let closestSegment: SegmentGroup | null = null;
        let minDistance = 24;
        let bestLatLng: L.LatLng | null = null;

        this.segments.forEach(segment => {
            const a = this.map.latLngToContainerPoint(segment.p1);
            const b = this.map.latLngToContainerPoint(segment.p2);
            const projection = L.LineUtil.closestPointOnSegment(mousePoint, a, b);
            const distance = mousePoint.distanceTo(projection);

            if (distance < minDistance) {
                minDistance = distance;
                closestSegment = segment;
                bestLatLng = this.map.containerPointToLatLng(projection);
            }
        });

        if (closestSegment && bestLatLng) {
            this.showGhost(bestLatLng, closestSegment);
        } else {
            this.removeGhost();
        }
    }

    private onMapMouseUp(): void {
        this.finishDrag();
    }

    private onMapContextMenu(e: L.LeafletMouseEvent): void {
        const hit = this.hitTestHandle(e.latlng);
        if (!hit || hit.kind === 'ghost') return;

        this.stopLeafletEvent(e);
        this.blurActiveElement();
        this.suppressNextClick = true;

        if (hit.kind === 'circle') {
            this.activeLayers.delete(hit.circle);
            this.originalLayerStyles.delete(hit.circle);
            this.map.removeLayer(hit.circle);
            this.map.fire(ANVIL_EVENTS.DELETED, { layer: hit.circle });
            this.refreshMarkers();
            return;
        }

        this.deleteVertex(hit.group);
    }

    private onWindowMouseMove(e: MouseEvent): void {
        if (!this.dragState) return;

        const rect = this.map.getContainer().getBoundingClientRect();
        const point = L.point(e.clientX - rect.left, e.clientY - rect.top);
        this.updateDrag(this.map.containerPointToLatLng(point));
    }

    private onWindowMouseUp(): void {
        this.finishDrag();
    }

    private createMarkers(): void {
        this.clearMarkers();
        if (this.activeLayers.size === 0) return;

        const vertexMap = new Map<string, VertexGroup>();
        const segmentMap = new Map<string, SegmentGroup>();
        this.segments = [];

        const getPosKey = (latlng: L.LatLng) => `${latlng.lat.toFixed(6)},${latlng.lng.toFixed(6)}`;

        this.activeLayers.forEach(layer => {
            if (layer instanceof L.Marker) {
                this.enableMarkerEditing(layer);
                return;
            }

            if (layer instanceof L.Circle) {
                this.createCircleHandle(layer);
                return;
            }

            if (!(layer instanceof L.Polyline)) return;

            const traverse = (arr: any, currentPath: number[]) => {
                if (!arr) return;

                if (Array.isArray(arr) && arr.length > 0 && (arr[0] instanceof L.LatLng || typeof arr[0].lat === 'number')) {
                    const isPolygon = layer instanceof L.Polygon;
                    let ringLen = arr.length;

                    if (isPolygon && ringLen > 1 && getPosKey(arr[0]) === getPosKey(arr[ringLen - 1])) {
                        ringLen--;
                    }

                    arr.forEach((latlng: L.LatLng, index: number) => {
                        if (index >= ringLen) return;

                        const key = getPosKey(latlng);
                        if (!vertexMap.has(key)) {
                            vertexMap.set(key, { latlng, refs: [], marker: null });
                        }
                        vertexMap.get(key)!.refs.push({ layer, path: [...currentPath, index] });

                        if (index < ringLen - 1 || isPolygon) {
                            const nextIndex = (index + 1) % ringLen;
                            const nextLatLng = arr[nextIndex];
                            if (getPosKey(latlng) === getPosKey(nextLatLng)) return;

                            const segmentKey = [getPosKey(latlng), getPosKey(nextLatLng)].sort().join('|');
                            if (!segmentMap.has(segmentKey)) {
                                segmentMap.set(segmentKey, { p1: latlng, p2: nextLatLng, refs: [] });
                            }
                            segmentMap.get(segmentKey)!.refs.push({ layer, path: [...currentPath, index] });
                        }
                    });
                    return;
                }

                if (Array.isArray(arr)) {
                    arr.forEach((item, index) => traverse(item, [...currentPath, index]));
                }
            };

            traverse(layer.getLatLngs(), []);
        });

        this.segments = Array.from(segmentMap.values());

        vertexMap.forEach(group => {
            const marker = this.createHandle(group.latlng);
            group.marker = marker;
            this.setHandleMeta(marker, { kind: 'vertex', group });
            this.markers.push(marker);
        });
    }

    private startVertexDrag(group: VertexGroup, marker: L.CircleMarker): void {
        this.removeGhost();
        this.dragState = { kind: 'vertex', group, marker };
        this.isDragging = true;
        this.map.dragging?.disable();
    }

    private startGhostDrag(segment: SegmentGroup, marker: L.CircleMarker): void {
        const startLatLng = marker.getLatLng();
        segment.refs.forEach(ref => {
            const fullStructure = (ref.layer as L.Polyline).getLatLngs() as any;
            let target: any = fullStructure;
            for (let i = 0; i < ref.path.length - 1; i++) {
                target = target[ref.path[i]];
            }
            target.splice(ref.path[ref.path.length - 1] + 1, 0, startLatLng);
            (ref.layer as L.Polyline).setLatLngs(fullStructure);
        });

        this.dragState = { kind: 'ghost', segment, marker };
        this.isDragging = true;
        this.map.dragging?.disable();
    }

    private startCircleDrag(circle: L.Circle, marker: L.CircleMarker): void {
        this.removeGhost();
        this.dragState = { kind: 'circle', circle, marker };
        this.isDragging = true;
        this.map.dragging?.disable();
    }

    private updateDrag(latlng: L.LatLng): void {
        if (!this.dragState) return;

        if (this.dragState.kind === 'vertex') {
            this.updateVertexDrag(this.dragState.group, this.dragState.marker, latlng);
            return;
        }

        if (this.dragState.kind === 'ghost') {
            this.updateGhostDrag(this.dragState.segment, this.dragState.marker, latlng);
            return;
        }

        this.updateCircleDrag(this.dragState.circle, this.dragState.marker, latlng);
    }

    private updateVertexDrag(group: VertexGroup, marker: L.CircleMarker, latlng: L.LatLng): void {
        const skipLayersArray = Array.from(this.activeLayers);
        const snapped = getSnapLatLng(this.map, latlng, this.store, this.options, [], skipLayersArray);

        if (this.options.preventSelfIntersection) {
            let wouldIntersect = false;

            group.refs.forEach(ref => {
                if (this.wouldVertexMoveSelfIntersect(ref, snapped)) {
                    wouldIntersect = true;
                }
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
    }

    private updateGhostDrag(segment: SegmentGroup, marker: L.CircleMarker, latlng: L.LatLng): void {
        const skipLayersArray = Array.from(this.activeLayers);
        const snapped = getSnapLatLng(this.map, latlng, this.store, this.options, [], skipLayersArray);

        if (this.options.preventSelfIntersection) {
            let wouldIntersect = false;

            segment.refs.forEach(ref => {
                if (this.wouldInsertedVertexSelfIntersect(ref, snapped)) {
                    wouldIntersect = true;
                }
            });

            if (wouldIntersect) return;
        }

        marker.setLatLng(snapped);

        segment.refs.forEach(ref => {
            const fullStructure = (ref.layer as L.Polyline).getLatLngs() as any;
            let target: any = fullStructure;
            for (let i = 0; i < ref.path.length - 1; i++) {
                target = target[ref.path[i]];
            }
            target[ref.path[ref.path.length - 1] + 1] = snapped;
            (ref.layer as L.Polyline).setLatLngs(fullStructure);
            ref.layer.redraw();
        });
    }

    private updateCircleDrag(circle: L.Circle, marker: L.CircleMarker, latlng: L.LatLng): void {
        const additionalPoints = this.markers.filter(candidate => candidate !== marker).map(candidate => candidate.getLatLng());
        const snapped = getSnapLatLng(this.map, latlng, this.store, this.options, additionalPoints, circle);

        marker.setLatLng(snapped);
        circle.setLatLng(snapped);
    }

    private finishDrag(emitEdited = true): void {
        if (!this.dragState) return;

        const editedLayers = new Set<L.Layer>();

        if (this.dragState.kind === 'vertex') {
            this.dragState.group.refs.forEach(ref => editedLayers.add(ref.layer));
        } else if (this.dragState.kind === 'ghost') {
            this.dragState.segment.refs.forEach(ref => editedLayers.add(ref.layer));
        } else {
            editedLayers.add(this.dragState.circle);
        }

        this.dragState = null;
        this.isDragging = false;
        this.suppressNextClick = true;
        if (this.map.dragging && !this.map.dragging.enabled()) {
            this.map.dragging.enable();
        }

        if (emitEdited) {
            editedLayers.forEach(layer => this.map.fire(ANVIL_EVENTS.EDITED, { layer }));
        }

        this.refreshMarkers();
    }

    private deleteVertex(group: VertexGroup): void {
        if (this.options.preventSelfIntersection) {
            const wouldIntersect = group.refs.some(ref => this.wouldDeletedVertexSelfIntersect(ref));
            if (wouldIntersect) return;
        }

        const layersToDelete = new Set<L.Layer>();

        group.refs.forEach(ref => {
            const fullStructure = (ref.layer as L.Polyline).getLatLngs() as any;
            let target: any = fullStructure;

            for (let i = 0; i < ref.path.length - 1; i++) {
                target = target[ref.path[i]];
            }

            const index = ref.path[ref.path.length - 1];
            const minVertices = ref.layer instanceof L.Polygon ? 3 : 2;

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
            if (layer instanceof L.Path) this.originalLayerStyles.delete(layer);
            this.map.removeLayer(layer);
            this.map.fire(ANVIL_EVENTS.DELETED, { layer });
        });

        this.refreshMarkers();
    }

    private showGhost(latlng: L.LatLng, segment: SegmentGroup): void {
        if (this.ghostMarker) {
            this.ghostMarker.setLatLng(latlng);
            (this.ghostMarker as any)._activeSeg = segment;
            return;
        }

        const marker = this.createGhostHandle(latlng);
        (marker as any)._activeSeg = segment;
        this.ghostMarker = marker;
    }

    private removeGhost(): void {
        if (!this.ghostMarker || this.isDragging) return;

        this.ghostMarker.off();
        this.map.removeLayer(this.ghostMarker);
        this.ghostMarker = null;
    }

    private enableMarkerEditing(marker: L.Marker): void {
        marker.dragging?.enable();
        marker.off('drag');
        marker.off('dragend');
        marker.off('contextmenu');

        marker.on('drag', (e: L.LeafletMouseEvent) => {
            const additionalPoints = this.markers.map(candidate => candidate.getLatLng());
            const snapped = getSnapLatLng(this.map, e.latlng, this.store, this.options, additionalPoints, marker);
            marker.setLatLng(snapped);
        });
        marker.on('dragend', () => {
            this.map.fire(ANVIL_EVENTS.EDITED, { layer: marker });
        });
        marker.on('contextmenu', (e: L.LeafletMouseEvent) => {
            this.stopLeafletEvent(e);
            this.activeLayers.delete(marker);
            this.map.removeLayer(marker);
            this.map.fire(ANVIL_EVENTS.DELETED, { layer: marker });
            this.refreshMarkers();
        });
    }

    private createCircleHandle(circle: L.Circle): void {
        const marker = this.createHandle(circle.getLatLng());
        this.setHandleMeta(marker, { kind: 'circle', circle });
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

        this.markers.forEach(marker => {
            this.map.removeLayer(marker);
        });

        this.markers = [];
        this.segments = [];
        this.dragState = null;
        this.isDragging = false;

        if (this.ghostMarker) {
            this.map.removeLayer(this.ghostMarker);
            this.ghostMarker = null;
        }

        if (this.map.dragging && !this.map.dragging.enabled()) {
            this.map.dragging.enable();
        }
    }

    private refreshMarkers(): void {
        if (this.config.autoSelectAll) {
            this.syncAutoSelection();
            return;
        }

        this.clearMarkers();
        this.createMarkers();
    }

    private bindLayerEvents(layer: L.Layer): void {
        if (!this.isEditableLayer(layer)) return;

        layer.on('click', this.onLayerClick, this);
        layer.on('mousemove', this.onMapMouseMove, this);
        (layer.getElement() as HTMLElement | undefined)?.style.setProperty('cursor', 'pointer');
    }

    private unbindLayerEvents(layer: L.Layer): void {
        if (!this.isEditableLayer(layer)) return;

        layer.off('click', this.onLayerClick, this);
        layer.off('mousemove', this.onMapMouseMove, this);
        (layer.getElement() as HTMLElement | undefined)?.style.setProperty('cursor', '');
    }

    private isEditableLayer(layer: L.Layer): layer is L.Path | L.Marker {
        return layer instanceof L.Path || layer instanceof L.Marker;
    }

    private syncAutoSelection(): void {
        this.restoreAllPathStyles();
        this.clearMarkers();
        this.activeLayers.clear();

        this.store.getGroup().eachLayer(layer => {
            if (!this.isEditableLayer(layer)) return;
            this.activeLayers.add(layer);
        });

        this.activeLayers.forEach(layer => {
            if (layer instanceof L.Path) this.applySelectionStyle(layer);
        });

        this.createMarkers();
    }

    private applySelectionStyle(layer: L.Path): void {
        if (!this.originalLayerStyles.has(layer)) {
            this.originalLayerStyles.set(layer, { ...layer.options });
        }

        layer.setStyle(
            getModeSelectionPathOptions(
                this.options,
                this.config.modeId,
                this.originalLayerStyles.get(layer) || {},
                this.config.defaultSelectionPathOptions,
            ),
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

    private createHandle(latlng: L.LatLng): L.CircleMarker {
        const marker = L.circleMarker(latlng, this.getEditHandleOptions()).addTo(this.map);
        marker.bringToFront();
        return marker;
    }

    private createGhostHandle(latlng: L.LatLng): L.CircleMarker {
        const marker = L.circleMarker(latlng, this.getGhostHandleOptions()).addTo(this.map);
        marker.bringToFront();
        return marker;
    }

    private getEditHandleOptions(): L.CircleMarkerOptions {
        const handle = getModeHandleOptions(this.options, this.config.modeId, this.config.defaultHandleOptions);

        return {
            ...handle,
            pane: this.handlePaneName,
            renderer: this.handleRenderer,
            interactive: false,
            bubblingMouseEvents: false,
        };
    }

    private getGhostHandleOptions(): L.CircleMarkerOptions {
        const handle = getModeHandleOptions(this.options, this.config.modeId, this.config.defaultGhostHandleOptions);

        return {
            ...handle,
            pane: this.handlePaneName,
            renderer: this.handleRenderer,
            interactive: false,
            bubblingMouseEvents: false,
        };
    }

    private wouldVertexMoveSelfIntersect(ref: VertexRef, latlng: L.LatLng): boolean {
        const ring = this.getEditableRing(ref);
        if (!ring) return false;

        const { points, index, isPolygon } = ring;
        const updatedPoints = points.slice();
        updatedPoints[index] = latlng;

        const changedSegments = [
            index - 1,
            index,
        ];

        if (isPolygon) {
            if (changedSegments[0] < 0) changedSegments[0] = points.length - 1;
            if (changedSegments[1] >= points.length) changedSegments[1] = 0;
        }

        return this.changedSegmentsIntersect(updatedPoints, changedSegments, isPolygon);
    }

    private wouldInsertedVertexSelfIntersect(ref: SegmentRef, latlng: L.LatLng): boolean {
        const ring = this.getEditableRing(ref);
        if (!ring) return false;

        const { points, index, isPolygon } = ring;
        const insertAt = index + 1;
        const updatedPoints = [
            ...points.slice(0, insertAt),
            latlng,
            ...points.slice(insertAt),
        ];

        return this.changedSegmentsIntersect(updatedPoints, [index, index + 1], isPolygon);
    }

    private wouldDeletedVertexSelfIntersect(ref: VertexRef): boolean {
        const ring = this.getEditableRing(ref);
        if (!ring) return false;

        const { points, index, isPolygon } = ring;
        const minVertices = isPolygon ? 3 : 2;

        if (points.length <= minVertices) return false;
        if (!isPolygon && (index === 0 || index === points.length - 1)) return false;

        const updatedPoints = points.slice();
        updatedPoints.splice(index, 1);

        if (updatedPoints.length < minVertices) return false;

        const changedSegmentIndex = isPolygon
            ? (index - 1 + updatedPoints.length) % updatedPoints.length
            : index - 1;

        return this.changedSegmentsIntersect(updatedPoints, [changedSegmentIndex], isPolygon);
    }

    private getEditableRing(ref: VertexRef | SegmentRef): { points: L.LatLng[]; index: number; isPolygon: boolean } | null {
        const fullStructure = (ref.layer as L.Polyline).getLatLngs() as any;
        let target: any = fullStructure;

        for (let i = 0; i < ref.path.length - 1; i++) {
            target = target[ref.path[i]];
        }

        if (!Array.isArray(target)) return null;

        const isPolygon = ref.layer instanceof L.Polygon;
        const ring = target as L.LatLng[];
        let points = ring.slice();

        if (isPolygon && points.length > 1 && this.sameLatLng(points[0], points[points.length - 1])) {
            points = points.slice(0, -1);
        }

        return {
            points,
            index: ref.path[ref.path.length - 1],
            isPolygon,
        };
    }

    private changedSegmentsIntersect(points: L.LatLng[], changedSegments: number[], isPolygon: boolean): boolean {
        if (points.length < (isPolygon ? 3 : 2)) return false;

        const segmentCount = isPolygon ? points.length : points.length - 1;
        if (segmentCount < 2) return false;

        const projected = points.map(point => this.map.latLngToLayerPoint(point));

        for (const changedIndex of changedSegments) {
            if (changedIndex < 0 || changedIndex >= segmentCount) continue;

            const aIndex = changedIndex;
            const bIndex = this.segmentEndIndex(changedIndex, points.length, isPolygon);

            for (let otherIndex = 0; otherIndex < segmentCount; otherIndex++) {
                if (otherIndex === changedIndex) continue;

                const cIndex = otherIndex;
                const dIndex = this.segmentEndIndex(otherIndex, points.length, isPolygon);

                if (this.segmentsShareEndpoint(aIndex, bIndex, cIndex, dIndex)) continue;

                if (segmentsIntersect(
                    projected[aIndex],
                    projected[bIndex],
                    projected[cIndex],
                    projected[dIndex],
                )) {
                    return true;
                }
            }
        }

        return false;
    }

    private segmentEndIndex(segmentIndex: number, pointCount: number, isPolygon: boolean): number {
        return isPolygon ? (segmentIndex + 1) % pointCount : segmentIndex + 1;
    }

    private segmentsShareEndpoint(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
        return aStart === bStart || aStart === bEnd || aEnd === bStart || aEnd === bEnd;
    }

    private sameLatLng(a: L.LatLng, b: L.LatLng): boolean {
        return a.lat === b.lat && a.lng === b.lng;
    }

    private setHandleMeta(marker: L.CircleMarker, meta: HandleMeta): void {
        (marker as any)._anvilHandleMeta = meta;
    }

    private hitTestHandle(latlng: L.LatLng): (
        { kind: 'vertex'; group: VertexGroup; marker: L.CircleMarker }
        | { kind: 'circle'; circle: L.Circle; marker: L.CircleMarker }
        | { kind: 'ghost'; segment: SegmentGroup; marker: L.CircleMarker }
    ) | null {
        const mousePoint = this.map.latLngToContainerPoint(latlng);
        let bestMatch: (
            { kind: 'vertex'; group: VertexGroup; marker: L.CircleMarker }
            | { kind: 'circle'; circle: L.Circle; marker: L.CircleMarker }
            | { kind: 'ghost'; segment: SegmentGroup; marker: L.CircleMarker }
        ) | null = null;
        let bestDistance = 12;

        const considerMarker = (marker: L.CircleMarker, meta: HandleMeta | { kind: 'ghost'; segment: SegmentGroup }) => {
            const point = this.map.latLngToContainerPoint(marker.getLatLng());
            const distance = point.distanceTo(mousePoint);
            if (distance >= bestDistance) return;

            bestDistance = distance;
            if (meta.kind === 'ghost') {
                bestMatch = { kind: 'ghost', segment: meta.segment, marker };
                return;
            }

            if (meta.kind === 'circle') {
                bestMatch = { kind: 'circle', circle: meta.circle, marker };
                return;
            }

            bestMatch = { kind: 'vertex', group: meta.group, marker };
        };

        this.markers.forEach((marker) => {
            const meta = (marker as any)._anvilHandleMeta as HandleMeta | undefined;
            if (meta) considerMarker(marker, meta);
        });

        if (this.ghostMarker) {
            const segment = ((this.ghostMarker as any)._activeSeg as SegmentGroup | undefined);
            if (segment) considerMarker(this.ghostMarker, { kind: 'ghost', segment });
        }

        return bestMatch;
    }

    private createHandleRenderer(): L.Renderer | undefined {
        if (typeof document === 'undefined') return undefined;
        if (typeof navigator !== 'undefined' && /jsdom|node\.js/i.test(navigator.userAgent)) return undefined;

        try {
            const canvas = document.createElement('canvas');
            if (typeof canvas.getContext === 'function' && canvas.getContext('2d')) {
                return L.canvas({ padding: 0.5, pane: this.handlePaneName });
            }
        } catch {
            return undefined;
        }

        return L.svg({ padding: 0.5, pane: this.handlePaneName });
    }

    private ensureHandlePane(): void {
        const existingPane = this.map.getPane(this.handlePaneName);
        const pane = existingPane || this.map.createPane(this.handlePaneName);
        pane.style.zIndex = '650';
        pane.style.pointerEvents = 'none';
    }

    private stopLeafletEvent(e: L.LeafletEvent): void {
        L.DomEvent.stopPropagation(e);

        const originalEvent = (e as any)?.originalEvent;
        if (originalEvent) {
            L.DomEvent.preventDefault(originalEvent);
            L.DomEvent.stopPropagation(originalEvent);
        }
    }

    private blurActiveElement(): void {
        if (typeof document === 'undefined') return;

        const activeElement = document.activeElement as { blur?: () => void } | null;
        activeElement?.blur?.();
    }
}
