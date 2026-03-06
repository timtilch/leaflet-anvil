import * as L from 'leaflet';

/**
 * Checks if two line segments (A-B and C-D) intersect.
 * @param a Start point of segment 1
 * @param b End point of segment 1
 * @param c Start point of segment 2
 * @param d End point of segment 2
 * @returns true if segments intersect
 */
export function segmentsIntersect(a: L.Point, b: L.Point, c: L.Point, d: L.Point): boolean {
    // Segments are A-B and C-D
    // Simple line intersection check using cross products
    const crossProduct = (p1: L.Point, p2: L.Point, p3: L.Point) => {
        return (p2.y - p1.y) * (p3.x - p2.x) - (p2.x - p1.x) * (p3.y - p2.y);
    };

    const cp1 = crossProduct(a, b, c);
    const cp2 = crossProduct(a, b, d);
    const cp3 = crossProduct(c, d, a);
    const cp4 = crossProduct(c, d, b);

    // General case: segments intersect if endpoints of one segment are on opposite sides of the other segment
    if (((cp1 > 0 && cp2 < 0) || (cp1 < 0 && cp2 > 0)) &&
        ((cp3 > 0 && cp4 < 0) || (cp3 < 0 && cp4 > 0))) {
        return true;
    }

    // Special cases for collinear segments (we might want to ignore these if they only touch at endpoints)
    // For drawing/editing, we usually only care about proper intersections.
    // However, touching an existing vertex might be allowed (shared endpoints).

    return false;
}

/**
 * Checks if a new point would cause a self-intersection in a sequence of points.
 * @param map Leaflet map (for projection)
 * @param points Existing points
 * @param nextPoint The point to be added
 * @param isClosing Whether this is the closing segment of a polygon
 * @returns true if adding the point causes a self-intersection
 */
export function causesSelfIntersection(
    map: L.Map,
    points: L.LatLng[],
    nextPoint: L.LatLng,
    isClosing: boolean = false,
): boolean {
    if (points.length < 2) return false;

    const p2 = map.latLngToLayerPoint(nextPoint);
    const p1 = map.latLngToLayerPoint(points[points.length - 1]);

    // Check against all previous segments
    // A segment is defined by points[i] and points[i+1]
    // We skip the last segment connected to p1 to avoid false positives at the shared vertex.
    const limit = points.length - 2;

    for (let i = 0; i < limit; i++) {
        const a = map.latLngToLayerPoint(points[i]);
        const b = map.latLngToLayerPoint(points[i + 1]);

        if (segmentsIntersect(p1, p2, a, b)) {
            // Check if it's just touching a vertex or a real intersection
            // For now, we return true for any intersection
            return true;
        }
    }

    if (isClosing) {
        // If closing, we also check the segment from nextPoint to points[0]
        // But in our current logic, we usually call this before actually adding the point.
        // Wait, if isClosing is true, nextPoint IS points[0].
        // So we are checking the segment (points[last], points[0]).
        // This is already covered by the loop above if nextPoint = points[0]?
        // Not quite.
    }

    return false;
}

/**
 * Checks if a polyline/polygon has any self-intersections.
 */
export function isSelfIntersecting(map: L.Map, latlngs: L.LatLng[] | L.LatLng[][] | L.LatLng[][][], isPolygon: boolean): boolean {
    // Flatten latlngs if nested
    const flatten = (arr: any): L.LatLng[] => {
        if (!Array.isArray(arr)) return [];
        if (arr[0] instanceof L.LatLng) return arr as L.LatLng[];
        return arr.reduce((acc: L.LatLng[], val: any) => acc.concat(flatten(val)), []);
    };

    const points = flatten(latlngs);
    if (points.length < 4) return false; // Need at least 4 points for intersection (3 for polygon + 1 to cross)

    const projectedPoints = points.map(p => map.latLngToLayerPoint(p));
    const len = projectedPoints.length;

    for (let i = 0; i < len; i++) {
        const a = projectedPoints[i];
        const b = projectedPoints[(i + 1) % len];

        // Only check closing segment for polygons
        if (!isPolygon && i === len - 1) break;

        for (let j = i + 2; j < len; j++) {
            // Avoid adjacent segments (they share a vertex)
            if (isPolygon && (j + 1) % len === i) continue;
            if (!isPolygon && j === len - 1) break;

            const c = projectedPoints[j];
            const d = projectedPoints[(j + 1) % len];

            if (segmentsIntersect(a, b, c, d)) return true;
        }
    }

    return false;
}

