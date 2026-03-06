import * as L from 'leaflet';
import * as turf from '@turf/turf';
import { AnvilOptions, Mode } from '../anvil';
import { LayerStore } from '../layers/layer-store';
import { ANVIL_EVENTS } from '../events';
import { getSnapLatLng } from '../utils/snapping';

export class SplitMode implements Mode {
    private points: L.LatLng[] = [];
    private markers: L.Marker[] = [];
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
            this.ghostLine = L.polyline([lastPoint, snapLatLng], {
                dashArray: '5, 5',
                color: '#ff3300',
                weight: 2,
            }).addTo(this.map);
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
            this.polyline = L.polyline(this.points, { color: '#ff3300', weight: 3 }).addTo(this.map);
        }

        // Add/move finish marker on the last point
        const lastPoint = this.points[this.points.length - 1];
        if (this.markers.length === 0) {
            const marker = L.marker(lastPoint, {
                icon: L.divIcon({
                    className: 'anvil-split-finish',
                    html: '<div style="width: 10px; height: 10px; background: #ff3300; border: 2px solid white; border-radius: 50%;"></div>',
                    iconSize: [10, 10],
                    iconAnchor: [5, 5],
                }),
            }).addTo(this.map);
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
        const coords = turf.getCoords(lineGeo) as number[][];
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

        // Prepare the "blade" from the first and last points of the line
        const p1 = coords[0];
        const p2 = coords[coords.length - 1];

        const dx = p2[0] - p1[0];
        const dy = p2[1] - p1[1];
        const factor = 1000;
        const start = [p1[0] - dx * factor, p1[1] - dy * factor];
        const end = [p2[0] + dx * factor, p2[1] + dy * factor];
        const angle = Math.atan2(dy, dx);
        const perp = angle + Math.PI / 2;
        const width = 1000;

        const blade = turf.polygon([[
            start,
            end,
            [end[0] + Math.cos(perp) * width, end[1] + Math.sin(perp) * width],
            [start[0] + Math.cos(perp) * width, start[1] + Math.sin(perp) * width],
            start,
        ]]);

        layersToSplit.forEach(polygon => {
            const polyGeo = polygon.toGeoJSON();

            if (this.options.magnetic) {
                const intersections = turf.lineIntersect(lineGeo as any, polyGeo as any);
                this.insertVerticesIntoNeighbors(intersections, polygon);
            }

            const part1 = turf.difference(turf.featureCollection([polyGeo as any, blade as any]));
            const part2 = turf.intersect(turf.featureCollection([polyGeo as any, blade as any]));

            if (part1 && part2) {
                const processResult = (result: any) => {
                    const flattened = turf.flatten(result);
                    flattened.features.forEach(f => {
                        const l = L.geoJSON(f).getLayers()[0] as L.Polygon;
                        l.addTo(this.map);
                        this.map.fire(ANVIL_EVENTS.CREATED, { layer: l });
                    });
                };

                this.map.fire(ANVIL_EVENTS.DELETED, { layer: polygon });
                this.map.removeLayer(polygon);

                processResult(part1);
                processResult(part2);
            }
        });

        this.resetDrawing();
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
