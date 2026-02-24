import * as L from 'leaflet';
import { LayerStore } from '../layers/layer-store';
import { AnvilOptions } from '../anvil';

export function getSnapLatLng(
    map: L.Map,
    latlng: L.LatLng,
    store: LayerStore,
    options: AnvilOptions,
    additionalPoints: L.LatLng[] = [],
    skipLayer?: L.Layer | L.Layer[],
): L.LatLng {
    if (!options.snapping) return latlng;

    const snapDistance = options.snapDistance || 10;
    const basePoint = map.latLngToContainerPoint(latlng);

    let closestPoint: L.LatLng | null = null;
    let minDistance = snapDistance;

    const skipLayers = Array.isArray(skipLayer) ? skipLayer : (skipLayer ? [skipLayer] : []);
    const bounds = map.getBounds().pad(0.1);

    store.getGroup().eachLayer((layer: any) => {
        if (skipLayers.includes(layer)) return;

        // Optimization: check layer bounds first
        if (layer.getBounds && !bounds.intersects(layer.getBounds())) return;

        const pointsToCheck: L.LatLng[] = [];

        if (layer instanceof L.Marker || layer instanceof L.CircleMarker || layer instanceof L.Circle) {
            pointsToCheck.push(layer.getLatLng());
        } else if (layer instanceof L.Polyline) {
            // Polyline or Polygon
            const latlngs = layer.getLatLngs();
            const flatten = (arr: any[]): L.LatLng[] => {
                let result: L.LatLng[] = [];
                arr.forEach(item => {
                    if (Array.isArray(item)) {
                        result = result.concat(flatten(item));
                    } else if (item instanceof L.LatLng) {
                        result.push(item);
                    }
                });
                return result;
            };
            pointsToCheck.push(...flatten(latlngs));
        }

        pointsToCheck.forEach(p => {
            const containerPoint = map.latLngToContainerPoint(p);
            const dist = basePoint.distanceTo(containerPoint);
            if (dist < minDistance) {
                minDistance = dist;
                closestPoint = p;
            }
        });
    });

    additionalPoints.forEach(p => {
        const containerPoint = map.latLngToContainerPoint(p);
        const dist = basePoint.distanceTo(containerPoint);
        if (dist < minDistance) {
            minDistance = dist;
            closestPoint = p;
        }
    });

    return closestPoint || latlng;
}
