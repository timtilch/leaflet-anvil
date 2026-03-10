import { describe, expect, it } from 'vitest';
import * as L from 'leaflet';
import { causesSelfIntersection, isSelfIntersecting, segmentsIntersect } from '../../utils/geometry';
import { createMap } from '../helpers/leaflet-mock';

describe('segmentsIntersect', () => {
    it('returns true for two clearly intersecting segments', () => {
        const a = L.point(0, 0);
        const b = L.point(2, 2);
        const c = L.point(0, 2);
        const d = L.point(2, 0);
        expect(segmentsIntersect(a, b, c, d)).toBe(true);
    });

    it('returns false for parallel segments', () => {
        const a = L.point(0, 0);
        const b = L.point(2, 0);
        const c = L.point(0, 1);
        const d = L.point(2, 1);
        expect(segmentsIntersect(a, b, c, d)).toBe(false);
    });

    it('returns false for non-intersecting segments', () => {
        const a = L.point(0, 0);
        const b = L.point(1, 0);
        const c = L.point(2, 0);
        const d = L.point(3, 0);
        expect(segmentsIntersect(a, b, c, d)).toBe(false);
    });
});

describe('causesSelfIntersection', () => {
    let map: L.Map;

    beforeEach(() => {
        map = createMap();
    });

    afterEach(() => {
        map.remove();
    });

    it('returns false if fewer than 2 points are present', () => {
        const points = [L.latLng(0, 0)];
        expect(causesSelfIntersection(map, points, L.latLng(1, 1))).toBe(false);
    });

    it('returns false for a simple non-crossing triangle', () => {
        const points = [L.latLng(0, 0), L.latLng(1, 0), L.latLng(1, 1)];
        expect(causesSelfIntersection(map, points, L.latLng(0, 1))).toBe(false);
    });

    it('returns true if the new segment intersects an existing segment', () => {
        // Z-Shape (partially self-intersecting if closed or new segment crosses)
        const p1 = L.latLng(0, 0);
        const p2 = L.latLng(2, 2);
        const p3 = L.latLng(0, 2);
        // New point at (2,0) would cross (0,0)-(2,2)
        const newPoint = L.latLng(2, 0);

        expect(causesSelfIntersection(map, [p1, p2, p3], newPoint)).toBe(true);
    });
});

describe('isSelfIntersecting', () => {
    let map: L.Map;

    beforeEach(() => {
        map = createMap();
    });

    afterEach(() => {
        map.remove();
    });

    it('returns false for simple shapes', () => {
        const square = [L.latLng(0, 0), L.latLng(1, 0), L.latLng(1, 1), L.latLng(0, 1)];
        expect(isSelfIntersecting(map, square)).toBe(false);
    });

    it('returns true for a figure-eight (bowtie) polygon', () => {
        const bowtie = [L.latLng(0, 0), L.latLng(1, 1), L.latLng(0, 1), L.latLng(1, 0)];
        expect(isSelfIntersecting(map, bowtie)).toBe(true);
    });
});
