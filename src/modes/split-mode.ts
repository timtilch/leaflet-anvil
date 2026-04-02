import * as L from 'leaflet';
import * as turf from '@turf/turf';
import { AnvilOptions, Mode } from '../anvil';
import { LayerStore } from '../layers/layer-store';
import { ANVIL_EVENTS } from '../events';
import { AnvilMode } from '../types';
import { getModeGhostPathOptions, getModeHandleOptions, getModePathOptions } from '../utils/mode-styles';
import { getSnapLatLng } from '../utils/snapping';

export class SplitMode implements Mode {
    private points: L.LatLng[] = [];
    private markers: L.CircleMarker[] = [];
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
        this.map.getContainer().style.cursor = '';
        this.resetDrawing();
    }

    private onMapClick(e: L.LeafletMouseEvent): void {
        const latlng = getSnapLatLng(this.map, e.latlng, this.store, this.options, this.points);

        // Check if clicked near the last point to finish
        if (this.points.length > 0) {
            const lastPoint = this.points[this.points.length - 1];
            const p = this.map.latLngToContainerPoint(latlng);
            const lp = this.map.latLngToContainerPoint(lastPoint);
            if (p.distanceTo(lp) < 15 && this.points.length >= 2) {
                this.finish();
                return;
            }
        }

        this.points.push(latlng);
        this.updateDrawing();
    }

    private onMouseMove(e: L.LeafletMouseEvent): void {
        if (this.points.length === 0) return;

        const snapLatLng = getSnapLatLng(this.map, e.latlng, this.store, this.options, this.points);
        const lastPoint = this.points[this.points.length - 1];
        if (!this.ghostLine) {
            this.ghostLine = L.polyline(
                [lastPoint, snapLatLng],
                getModeGhostPathOptions(this.options, AnvilMode.Split, {
                    dashArray: '5, 5',
                    color: '#ff3300',
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
                getModePathOptions(this.options, AnvilMode.Split, {
                    color: '#ff3300',
                    weight: 3,
                }),
            ).addTo(this.map);
        }

        // Add/move finish marker on the last point
        const lastPoint = this.points[this.points.length - 1];
        if (this.markers.length === 0) {
            const marker = L.circleMarker(
                lastPoint,
                getModeHandleOptions(this.options, AnvilMode.Split, {
                    radius: 5,
                    color: '#ff3300',
                }),
            ).addTo(this.map);
            marker.on('click', (e) => {
                L.DomEvent.stopPropagation(e);
                this.finish();
            });
            this.markers.push(marker);
        } else {
            this.markers[0].setLatLng(lastPoint);
        }
    }

    private finish(): void {
        if (this.points.length < 2) {
            this.resetDrawing();
            return;
        }

        const lineGeo = L.polyline(this.points).toGeoJSON();
        const layersToSplit: L.Polygon[] = [];

        // Find all polygons that intersect with our line
        this.store.getGroup().eachLayer((layer) => {
            if (layer instanceof L.Polygon) {
                const polyGeo = layer.toGeoJSON();
                const intersections = turf.lineIntersect(lineGeo as any, polyGeo as any);
                if (intersections.features.length >= 2) {
                    layersToSplit.push(layer);
                }
            }
        });

        if (layersToSplit.length === 0) {
            this.resetDrawing();
            return;
        }

        layersToSplit.forEach(polygon => {
            const polyGeo = polygon.toGeoJSON();

            const intersections = turf.lineIntersect(lineGeo as any, polyGeo as any);
            this.insertVerticesIntoNeighbors(intersections, polygon);
            const parts = this.splitPolygonAlongLine(polyGeo as any, lineGeo as any);

            if (parts.length >= 2) {
                this.map.fire(ANVIL_EVENTS.DELETED, { layer: polygon });
                this.map.removeLayer(polygon);
                parts.forEach((feature) => {
                    const l = L.geoJSON(feature as any, {
                        style: getModePathOptions(this.options, AnvilMode.Split),
                    }).getLayers()[0] as L.Polygon;
                    l.addTo(this.map);
                    this.map.fire(ANVIL_EVENTS.CREATED, { layer: l });
                });
            }
        });

        this.resetDrawing();
    }

    private splitPolygonAlongLine(
        polygon: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>,
        line: GeoJSON.Feature<GeoJSON.LineString>,
    ): GeoJSON.Feature<GeoJSON.Polygon>[] {
        const sanitizedPolygon = this.sanitizePolygonFeature(polygon);
        const sanitizedLine = this.sanitizeLineStringFeature(line);
        if (!sanitizedPolygon || !sanitizedLine) return [];

        const boundaryLines = this.getBoundaryLines(sanitizedPolygon);
        if (boundaryLines.length === 0) return [];

        const intersectionCoords = this.getIntersectionCoords(sanitizedLine, boundaryLines);
        if (intersectionCoords.length < 2) return [];

        const splitter = turf.multiPoint(intersectionCoords);
        const splitBoundary: GeoJSON.Feature<GeoJSON.LineString>[] = [];

        boundaryLines.forEach((boundaryLine) => {
            turf.lineSplit(boundaryLine as any, splitter as any).features.forEach((segment) => {
                const sanitizedSegment = this.sanitizeLineStringFeature(segment as GeoJSON.Feature<GeoJSON.LineString>);
                if (sanitizedSegment) splitBoundary.push(sanitizedSegment);
            });
        });

        const splitLine = turf.lineSplit(sanitizedLine as any, splitter as any);
        const innerSegments = splitLine.features
            .map(segment => this.sanitizeLineStringFeature(segment as GeoJSON.Feature<GeoJSON.LineString>))
            .filter((segment): segment is GeoJSON.Feature<GeoJSON.LineString> => Boolean(segment))
            .filter(segment => this.isSegmentInsidePolygon(segment, sanitizedPolygon));

        if (innerSegments.length === 0) return [];

        try {
            const polygonized = turf.polygonize(
                turf.featureCollection([
                    ...splitBoundary,
                    ...innerSegments,
                ]),
            );

            return polygonized.features
                .map(feature => this.sanitizePolygonFeature(feature as GeoJSON.Feature<GeoJSON.Polygon>))
                .filter((feature): feature is GeoJSON.Feature<GeoJSON.Polygon> => Boolean(feature) && feature.geometry.type === 'Polygon')
                .filter(feature => this.isPolygonInsideOriginal(feature, sanitizedPolygon));
        } catch {
            return [];
        }
    }

    private isSegmentInsidePolygon(
        segment: GeoJSON.Feature<GeoJSON.LineString>,
        polygon: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>,
    ): boolean {
        const coords = segment.geometry.coordinates;
        if (coords.length < 2) return false;

        const midpoint = turf.midpoint(
            turf.point(coords[0]),
            turf.point(coords[coords.length - 1]),
        );

        return turf.booleanWithin(midpoint, polygon as any) || turf.booleanPointInPolygon(midpoint, polygon as any);
    }

    private isPolygonInsideOriginal(
        candidate: GeoJSON.Feature<GeoJSON.Polygon>,
        original: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>,
    ): boolean {
        const point = turf.pointOnFeature(candidate);
        return turf.booleanWithin(point, original as any) || turf.booleanPointInPolygon(point, original as any);
    }

    private getBoundaryLines(
        polygon: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>,
    ): GeoJSON.Feature<GeoJSON.LineString>[] {
        const boundary = turf.polygonToLine(polygon as any);
        const lines: GeoJSON.Feature<GeoJSON.LineString>[] = [];

        turf.flattenEach(boundary as any, (feature) => {
            const sanitized = this.sanitizeLineStringFeature(feature as GeoJSON.Feature<GeoJSON.LineString>);
            if (sanitized) lines.push(sanitized);
        });

        return lines;
    }

    private getIntersectionCoords(
        line: GeoJSON.Feature<GeoJSON.LineString>,
        boundaryLines: GeoJSON.Feature<GeoJSON.LineString>[],
    ): GeoJSON.Position[] {
        const intersections = new Map<string, GeoJSON.Position>();

        boundaryLines.forEach((boundaryLine) => {
            turf.lineIntersect(line as any, boundaryLine as any).features.forEach((feature) => {
                const coord = turf.getCoord(feature);
                intersections.set(this.coordKey(coord), coord);
            });
        });

        return Array.from(intersections.values());
    }

    private sanitizeLineStringFeature(
        feature: GeoJSON.Feature<GeoJSON.LineString>,
    ): GeoJSON.Feature<GeoJSON.LineString> | null {
        const cleaned = turf.cleanCoords(feature as any, { mutate: false }) as GeoJSON.Feature<GeoJSON.LineString>;
        if (cleaned.geometry.type !== 'LineString') return null;

        const coordinates = this.removeSequentialDuplicateCoords(cleaned.geometry.coordinates);
        const uniqueCoords = new Set(coordinates.map(coord => this.coordKey(coord)));
        if (coordinates.length < 2 || uniqueCoords.size < 2) return null;

        return turf.lineString(coordinates, cleaned.properties || {}, {
            bbox: cleaned.bbox,
            id: cleaned.id,
        });
    }

    private sanitizePolygonFeature<T extends GeoJSON.Polygon | GeoJSON.MultiPolygon>(
        feature: GeoJSON.Feature<T>,
    ): GeoJSON.Feature<T> | null {
        const cleaned = turf.cleanCoords(feature as any, { mutate: false }) as GeoJSON.Feature<T>;

        if (cleaned.geometry.type === 'Polygon') {
            const rings = cleaned.geometry.coordinates
                .map(ring => this.normalizeRing(ring))
                .filter(ring => this.isValidRing(ring));

            if (rings.length === 0) return null;

            return turf.polygon(rings, cleaned.properties || {}, {
                bbox: cleaned.bbox,
                id: cleaned.id,
            }) as GeoJSON.Feature<T>;
        }

        const polygons = cleaned.geometry.coordinates
            .map(polygon => polygon
                .map(ring => this.normalizeRing(ring))
                .filter(ring => this.isValidRing(ring)))
            .filter(polygon => polygon.length > 0);

        if (polygons.length === 0) return null;

        return turf.multiPolygon(polygons, cleaned.properties || {}, {
            bbox: cleaned.bbox,
            id: cleaned.id,
        }) as GeoJSON.Feature<T>;
    }

    private normalizeRing(ring: GeoJSON.Position[]): GeoJSON.Position[] {
        const deduped = this.removeSequentialDuplicateCoords(ring);
        if (deduped.length === 0) return deduped;

        const first = deduped[0];
        const last = deduped[deduped.length - 1];
        if (this.coordKey(first) !== this.coordKey(last)) {
            deduped.push([...first]);
        }

        return deduped;
    }

    private removeSequentialDuplicateCoords(coords: GeoJSON.Position[]): GeoJSON.Position[] {
        const result: GeoJSON.Position[] = [];

        coords.forEach((coord) => {
            if (result.length === 0 || this.coordKey(result[result.length - 1]) !== this.coordKey(coord)) {
                result.push([...coord]);
            }
        });

        return result;
    }

    private isValidRing(ring: GeoJSON.Position[]): boolean {
        if (ring.length < 4) return false;
        if (this.coordKey(ring[0]) !== this.coordKey(ring[ring.length - 1])) return false;

        const uniqueCoords = new Set(ring.slice(0, -1).map(coord => this.coordKey(coord)));
        return uniqueCoords.size >= 3;
    }

    private coordKey(coord: GeoJSON.Position): string {
        return `${coord[0].toFixed(12)},${coord[1].toFixed(12)}`;
    }

    private insertVerticesIntoNeighbors(intersections: any, activePolygon: L.Polygon): void {
        const intersectionCoords = intersections.features.map((f: any) => turf.getCoord(f));
        const layers = this.store.getGroup().getLayers();

        layers.forEach(layer => {
            if (!(layer instanceof L.Polyline) || layer === activePolygon) return;

            const latlngs = layer.getLatLngs();
            let changed = false;

            // Simple recursive function to process all rings/parts
            const processArr = (arr: any[]) => {
                if (arr.length === 0) return;
                if (arr[0] instanceof L.LatLng || typeof arr[0].lat === 'number') {
                    // This is a ring (array of LatLngs)
                    const ring = arr as L.LatLng[];
                    const isPolygon = (layer as any) instanceof L.Polygon;
                    const ringLen = ring.length;

                    // Work backwards to not invalidate indices when splicing
                    for (let i = ringLen - 1; i >= 0; i--) {
                        if (i === ringLen - 1 && !isPolygon) continue;

                        const p1 = ring[i];
                        const p2 = ring[(i + 1) % ringLen];

                        const a = this.map.latLngToContainerPoint(p1);
                        const b = this.map.latLngToContainerPoint(p2);

                        intersectionCoords.forEach((coord: number[]) => {
                            const intersectLL = L.latLng(coord[1], coord[0]);
                            const p = this.map.latLngToContainerPoint(intersectLL);

                            const closest = L.LineUtil.closestPointOnSegment(p, a, b);
                            if (p.distanceTo(closest) < 1) { // 1px threshold
                                // Check if point already exists at this location to avoid duplicates
                                const alreadyExists = ring.some(ll =>
                                    this.map.latLngToContainerPoint(ll).distanceTo(p) < 1,
                                );

                                if (!alreadyExists) {
                                    ring.splice(i + 1, 0, intersectLL);
                                    changed = true;
                                }
                            }
                        });
                    }
                } else {
                    arr.forEach(item => processArr(item));
                }
            };

            processArr(latlngs);

            if (changed) {
                layer.setLatLngs(latlngs);
                if (layer.redraw) layer.redraw();
                this.map.fire(ANVIL_EVENTS.EDITED, { layer });
            }
        });
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
