import * as L from 'leaflet';
import * as turf from '@turf/turf';

export interface CoverageSnapshot {
    target: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>;
}

type LayerFeature = {
    layer: L.Polygon;
    feature: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>;
    boundary: GeoJSON.Feature<GeoJSON.LineString | GeoJSON.MultiLineString>;
};

export function createCoverageSnapshot(layers: L.Polygon[]): CoverageSnapshot | null {
    const features = layers
        .map(layer => sanitizePolygonFeature(layer.toGeoJSON() as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>))
        .filter((feature): feature is GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon> => Boolean(feature));

    if (features.length === 0) return null;

    const target = unionPolygonFeatures(features);
    if (!target) return null;

    return { target };
}

export function hasSharedBoundaryCoverage(layers: L.Polygon[]): boolean {
    const features = layers
        .map(layer => sanitizePolygonFeature(layer.toGeoJSON() as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>))
        .filter((feature): feature is GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon> => Boolean(feature))
        .map(feature => ({
            feature,
            boundary: turf.polygonToLine(feature as any) as GeoJSON.Feature<GeoJSON.LineString | GeoJSON.MultiLineString>,
        }));

    for (let i = 0; i < features.length; i++) {
        for (let j = i + 1; j < features.length; j++) {
            if (getBoundaryContactLength(features[i].boundary, features[j].boundary) > 0) {
                return true;
            }

            try {
                const overlap = turf.intersect(
                    turf.featureCollection([features[i].feature as any, features[j].feature as any]),
                ) as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon> | null;

                if (overlap && turf.area(overlap as any) > 0) {
                    return true;
                }
            } catch {
                // ignore invalid intersections
            }
        }
    }

    return false;
}

export function repairPolygonCoverage(
    layers: L.Polygon[],
    snapshot: CoverageSnapshot,
): L.Polygon[] {
    const target = sanitizePolygonFeature(snapshot.target);
    if (!target) return [];

    const current = layers
        .map((layer): LayerFeature | null => {
            const feature = sanitizePolygonFeature(layer.toGeoJSON() as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>);
            if (!feature) return null;

            return {
                layer,
                feature,
                boundary: turf.polygonToLine(feature as any) as GeoJSON.Feature<GeoJSON.LineString | GeoJSON.MultiLineString>,
            };
        })
        .filter((entry): entry is LayerFeature => Boolean(entry));

    if (current.length < 2) return [];
    const currentUnion = unionPolygonFeatures(current.map(({ feature }) => feature));
    if (!currentUnion) return [];

    let missingCoverage: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon> | null = null;
    try {
        missingCoverage = turf.difference(
            turf.featureCollection([target as any, currentUnion as any]),
        ) as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon> | null;
    } catch {
        return [];
    }

    if (!missingCoverage) return [];

    const gaps: GeoJSON.Feature<GeoJSON.Polygon>[] = [];
    turf.flattenEach(missingCoverage as any, (feature) => {
        const sanitized = sanitizePolygonFeature(feature as GeoJSON.Feature<GeoJSON.Polygon>);
        if (sanitized && sanitized.geometry.type === 'Polygon') {
            gaps.push(sanitized);
        }
    });

    if (gaps.length === 0) return [];

    const assignments = new Map<L.Polygon, GeoJSON.Feature<GeoJSON.Polygon>[]>(current.map(({ layer }) => [layer, []]));

    gaps.forEach((gap) => {
        const owner = pickOwnerForCell(gap, current);
        if (!owner) return;

        assignments.get(owner.layer)?.push(gap);
    });

    const repaired: L.Polygon[] = [];

    assignments.forEach((cells, layer) => {
        if (cells.length === 0) return;

        const existing = current.find(entry => entry.layer === layer)?.feature;
        if (!existing) return;

        const merged = unionPolygonFeatures([existing, ...cells]);
        if (!merged) return;

        layer.setLatLngs(toLeafletLatLngs(merged.geometry) as any);
        layer.redraw();
        repaired.push(layer);
    });

    return repaired;
}

export function collectTouchingPolygons(
    group: L.FeatureGroup,
    seedLayers: L.Polygon[],
): L.Polygon[] {
    const seeds = seedLayers
        .map(layer => ({
            layer,
            feature: sanitizePolygonFeature(layer.toGeoJSON() as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>),
        }))
        .filter((entry): entry is { layer: L.Polygon; feature: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon> } => Boolean(entry.feature));

    const related = new Set<L.Polygon>(seedLayers);

    group.eachLayer((layer) => {
        if (!(layer instanceof L.Polygon) || related.has(layer)) return;

        const feature = sanitizePolygonFeature(layer.toGeoJSON() as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>);
        if (!feature) return;

        const touchesSeed = seeds.some(seed => {
            try {
                return turf.booleanIntersects(seed.feature as any, feature as any);
            } catch {
                return false;
            }
        });

        if (touchesSeed) related.add(layer);
    });

    return Array.from(related);
}

function pickOwnerForCell(
    cell: GeoJSON.Feature<GeoJSON.Polygon>,
    current: LayerFeature[],
): LayerFeature | null {
    const point = turf.pointOnFeature(cell);

    const containing = current.filter(({ feature }) => {
        try {
            return turf.booleanPointInPolygon(point, feature as any) || turf.booleanWithin(point, feature as any);
        } catch {
            return false;
        }
    });

    if (containing.length === 1) return containing[0];
    if (containing.length > 1) return containing[0];

    const cellBoundary = turf.polygonToLine(cell as any) as GeoJSON.Feature<GeoJSON.LineString | GeoJSON.MultiLineString>;
    let best: { entry: LayerFeature; score: number } | null = null;

    current.forEach((entry) => {
        const score = getBoundaryContactLength(cellBoundary, entry.boundary);
        if (!best || score > best.score) {
            best = { entry, score };
        }
    });

    if (best && best.score > 0) return best.entry;

    let nearest: { entry: LayerFeature; distance: number } | null = null;

    current.forEach((entry) => {
        try {
            const distance = turf.pointToLineDistance(point as any, entry.boundary as any);
            if (!nearest || distance < nearest.distance) {
                nearest = { entry, distance };
            }
        } catch {
            // ignore invalid distance calculations
        }
    });

    return nearest?.entry ?? null;
}

export function getPolygonOverlapArea(
    first: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>,
    second: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>,
): number {
    try {
        const firstBbox = turf.bbox(first as any);
        const secondBbox = turf.bbox(second as any);
        if (
            firstBbox[2] < secondBbox[0]
            || secondBbox[2] < firstBbox[0]
            || firstBbox[3] < secondBbox[1]
            || secondBbox[3] < firstBbox[1]
        ) {
            return 0;
        }

        const intersection = turf.intersect(
            turf.featureCollection([first as any, second as any]),
        ) as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon> | null;

        return intersection ? turf.area(intersection as any) : 0;
    } catch {
        return 0;
    }
}

function getBoundaryContactLength(
    cellBoundary: GeoJSON.Feature<GeoJSON.LineString | GeoJSON.MultiLineString>,
    boundary: GeoJSON.Feature<GeoJSON.LineString | GeoJSON.MultiLineString>,
): number {
    try {
        const overlaps = turf.lineOverlap(cellBoundary as any, boundary as any, { tolerance: 1e-12 });
        return overlaps.features.reduce((sum, feature) => sum + turf.length(feature as any), 0);
    } catch {
        return 0;
    }
}

function unionPolygonFeatures(
    features: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>[],
): GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon> | null {
    if (features.length === 0) return null;

    let merged = sanitizePolygonFeature(features[0]);
    if (!merged) return null;

    for (const feature of features.slice(1)) {
        const next = sanitizePolygonFeature(feature);
        if (!next) continue;

        try {
            const unioned = turf.union(turf.featureCollection([merged as any, next as any]));
            if (!unioned) continue;

            const sanitizedUnion = sanitizePolygonFeature(unioned as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>);
            if (sanitizedUnion) merged = sanitizedUnion;
        } catch {
            return null;
        }
    }

    return merged;
}

function sanitizeLineStringFeature(
    feature: GeoJSON.Feature<GeoJSON.LineString>,
): GeoJSON.Feature<GeoJSON.LineString> | null {
    let cleaned: GeoJSON.Feature<GeoJSON.LineString>;
    try {
        cleaned = turf.cleanCoords(feature as any, { mutate: false }) as GeoJSON.Feature<GeoJSON.LineString>;
    } catch {
        cleaned = {
            ...feature,
            geometry: {
                ...feature.geometry,
                coordinates: feature.geometry.coordinates.map(coord => [...coord]),
            },
        };
    }

    if (cleaned.geometry.type !== 'LineString') return null;

    const coordinates = removeSequentialDuplicateCoords(cleaned.geometry.coordinates);
    const uniqueCoords = new Set(coordinates.map(coord => coordKey(coord)));
    if (coordinates.length < 2 || uniqueCoords.size < 2) return null;

    return turf.lineString(coordinates, cleaned.properties || {}, {
        bbox: cleaned.bbox,
        id: cleaned.id,
    });
}

export function sanitizePolygonFeature<T extends GeoJSON.Polygon | GeoJSON.MultiPolygon>(
    feature: GeoJSON.Feature<T>,
): GeoJSON.Feature<T> | null {
    let cleaned: GeoJSON.Feature<T>;
    try {
        cleaned = turf.cleanCoords(feature as any, { mutate: false }) as GeoJSON.Feature<T>;
    } catch {
        cleaned = {
            ...feature,
            geometry: clonePolygonGeometry(feature.geometry) as T,
        };
    }

    if (cleaned.geometry.type === 'Polygon') {
        const rings = cleaned.geometry.coordinates
            .map(ring => normalizeRing(ring))
            .filter(ring => isValidRing(ring));

        if (rings.length === 0) return null;

        return turf.polygon(rings, cleaned.properties || {}, {
            bbox: cleaned.bbox,
            id: cleaned.id,
        }) as GeoJSON.Feature<T>;
    }

    const polygons = cleaned.geometry.coordinates
        .map(polygon => polygon
            .map(ring => normalizeRing(ring))
            .filter(ring => isValidRing(ring)))
        .filter(polygon => polygon.length > 0);

    if (polygons.length === 0) return null;

    return turf.multiPolygon(polygons, cleaned.properties || {}, {
        bbox: cleaned.bbox,
        id: cleaned.id,
    }) as GeoJSON.Feature<T>;
}

function clonePolygonGeometry(
    geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon,
): GeoJSON.Polygon | GeoJSON.MultiPolygon {
    if (geometry.type === 'Polygon') {
        return {
            type: 'Polygon',
            coordinates: geometry.coordinates.map(ring => ring.map(coord => [...coord])),
        };
    }

    return {
        type: 'MultiPolygon',
        coordinates: geometry.coordinates.map(
            polygon => polygon.map(ring => ring.map(coord => [...coord])),
        ),
    };
}

function normalizeRing(ring: GeoJSON.Position[]): GeoJSON.Position[] {
    const deduped = removeSequentialDuplicateCoords(ring);
    if (deduped.length === 0) return deduped;

    const first = deduped[0];
    const last = deduped[deduped.length - 1];
    if (coordKey(first) !== coordKey(last)) {
        deduped.push([...first]);
    }

    return deduped;
}

function removeSequentialDuplicateCoords(coords: GeoJSON.Position[]): GeoJSON.Position[] {
    const result: GeoJSON.Position[] = [];

    coords.forEach((coord) => {
        if (result.length === 0 || coordKey(result[result.length - 1]) !== coordKey(coord)) {
            result.push([...coord]);
        }
    });

    return result;
}

function isValidRing(ring: GeoJSON.Position[]): boolean {
    if (ring.length < 4) return false;
    if (coordKey(ring[0]) !== coordKey(ring[ring.length - 1])) return false;

    const uniqueCoords = new Set(ring.slice(0, -1).map(coord => coordKey(coord)));
    return uniqueCoords.size >= 3;
}

function coordKey(coord: GeoJSON.Position): string {
    return `${coord[0].toFixed(12)},${coord[1].toFixed(12)}`;
}

function toLeafletLatLngs(
    geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon,
): L.LatLngExpression[] | L.LatLngExpression[][] | L.LatLngExpression[][][] {
    const levelsDeep = geometry.type === 'Polygon' ? 1 : 2;
    return L.GeoJSON.coordsToLatLngs(geometry.coordinates as any, levelsDeep) as any;
}
