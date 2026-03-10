import { describe, expect, it } from 'vitest';
import * as L from 'leaflet';
import { causesSelfIntersection, isSelfIntersecting, segmentsIntersect } from '../../utils/geometry';
import { createMap } from '../helpers/leaflet-mock';

describe('segmentsIntersect', () => {
    it('gibt true für zwei klar schneidende Segmente zurück', () => {
        const a = L.point(0, 0);
        const b = L.point(2, 2);
        const c = L.point(0, 2);
        const d = L.point(2, 0);
        expect(segmentsIntersect(a, b, c, d)).toBe(true);
    });

    it('gibt false für parallele Segmente zurück', () => {
        const a = L.point(0, 0);
        const b = L.point(2, 0);
        const c = L.point(0, 1);
        const d = L.point(2, 1);
        expect(segmentsIntersect(a, b, c, d)).toBe(false);
    });

    it('gibt false für nicht-schneidende Segmente zurück', () => {
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

    it('gibt false zurück wenn weniger als 2 Punkte vorhanden sind', () => {
        const points = [L.latLng(0, 0)];
        expect(causesSelfIntersection(map, points, L.latLng(1, 1))).toBe(false);
    });

    it('gibt false zurück für ein einfaches nicht-kreuzendes Dreieck', () => {
        const points = [L.latLng(0, 0), L.latLng(1, 0), L.latLng(1, 1)];
        expect(causesSelfIntersection(map, points, L.latLng(0, 1))).toBe(false);
    });

    it('gibt true zurück wenn das neue Segment ein bestehendes kreuzt', () => {
        // Punkte bilden eine Zick-Zack-Form, die sich beim 4. Punkt kreuzt
        const points = [
            L.latLng(0, 0),  // (0,0)
            L.latLng(2, 2),  // (200,200)
            L.latLng(0, 2),  // (0, 200)
        ];
        // Nächster Punkt bei (2,0) → das Segment (0,200)→(200,0) schneidet (0,0)→(200,200)
        const nextPoint = L.latLng(2, 0);
        expect(causesSelfIntersection(map, points, nextPoint)).toBe(true);
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

    it('gibt false zurück für weniger als 4 Punkte', () => {
        const points = [L.latLng(0, 0), L.latLng(1, 0), L.latLng(1, 1)];
        expect(isSelfIntersecting(map, points, true)).toBe(false);
    });

    it('gibt false zurück für ein einfaches konvexes Polygon', () => {
        const square = [
            L.latLng(0, 0),
            L.latLng(0, 1),
            L.latLng(1, 1),
            L.latLng(1, 0),
        ];
        expect(isSelfIntersecting(map, square, true)).toBe(false);
    });

    it('gibt true zurück für ein selbstschneidendes (Schmetterlings-)Polygon', () => {
        // Schmetterlings-Form: (0,0)→(1,1)→(0,1)→(1,0) → kreuzt sich
        const butterfly = [
            L.latLng(0, 0),
            L.latLng(1, 1),
            L.latLng(0, 1),
            L.latLng(1, 0),
        ];
        expect(isSelfIntersecting(map, butterfly, true)).toBe(true);
    });
});

