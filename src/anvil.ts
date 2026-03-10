import * as L from 'leaflet';
import { ModeManager } from './modes/mode-manager';
import { DrawPolygonMode } from './modes/draw-polygon-mode';
import { DrawPolylineMode } from './modes/draw-polyline-mode';
import { DrawMarkerMode } from './modes/draw-marker-mode';
import { DrawRectangleMode } from './modes/draw-rectangle-mode';
import { DrawSquareMode } from './modes/draw-square-mode';
import { DrawTriangleMode } from './modes/draw-triangle-mode';
import { DrawCircleMode } from './modes/draw-circle-mode';
import { FreehandMode } from './modes/freehand-mode';
import { CutMode } from './modes/cut-mode';
import { SplitMode } from './modes/split-mode';
import { DragMode } from './modes/drag-mode';
import { ScaleMode } from './modes/scale-mode';
import { RotateMode } from './modes/rotate-mode';
import { UnionMode } from './modes/union-mode';
import { SubtractMode } from './modes/subtract-mode';
import { EditMode } from './modes/edit-mode';
import { DeleteMode } from './modes/delete-mode';
import { LayerStore } from './layers/layer-store';
import { ANVIL_EVENTS } from './events';

export interface Mode {
    enable(): void;

    disable(): void;
}

export interface AnvilOptions {
    layerGroup?: L.FeatureGroup;
    snapping?: boolean;
    snapDistance?: number;
    magnetic?: boolean;
    freehandTolerance?: number;
    preventSelfIntersection?: boolean;
    pathOptions?: L.PathOptions;
    ghostPathOptions?: L.PathOptions;
    vertexOptions?: L.MarkerOptions;
}

export class Anvil {
    private modeManager: ModeManager;
    private store: LayerStore;
    private options: AnvilOptions;

    constructor(private map: L.Map, options?: AnvilOptions) {
        this.options = { snapping: false, snapDistance: 10, preventSelfIntersection: false, ...options };
        this.store = new LayerStore(map, this.options.layerGroup);
        this.modeManager = new ModeManager(map);

        this.modeManager.addMode('draw:polygon', new DrawPolygonMode(this.map, this.options, this.store));
        this.modeManager.addMode('draw:polyline', new DrawPolylineMode(this.map, this.options, this.store));
        this.modeManager.addMode('draw:marker', new DrawMarkerMode(this.map, this.options, this.store));
        this.modeManager.addMode('draw:rectangle', new DrawRectangleMode(this.map, this.options, this.store));
        this.modeManager.addMode('draw:square', new DrawSquareMode(this.map, this.options, this.store));
        this.modeManager.addMode('draw:triangle', new DrawTriangleMode(this.map, this.options, this.store));
        this.modeManager.addMode('draw:circle', new DrawCircleMode(this.map, this.options, this.store));
        this.modeManager.addMode('draw:freehand', new FreehandMode(this.map, this.store, this.options));
        this.modeManager.addMode('cut', new CutMode(map, this.store, this.options));
        this.modeManager.addMode('split', new SplitMode(map, this.store, this.options));
        this.modeManager.addMode('union', new UnionMode(map, this.store, this.options));
        this.modeManager.addMode('subtract', new SubtractMode(map, this.store, this.options));
        this.modeManager.addMode('drag', new DragMode(map, this.store, this.options));
        this.modeManager.addMode('scale', new ScaleMode(map, this.store, this.options));
        this.modeManager.addMode('rotate', new RotateMode(map, this.store, this.options));
        this.modeManager.addMode('edit', new EditMode(this.map, this.store, this.options));
        this.modeManager.addMode('delete', new DeleteMode(map, this.store));

        this.map.on(ANVIL_EVENTS.CREATED, (e: any) => {
            this.store.addLayer(e.layer);
        });

        this.map.on(ANVIL_EVENTS.DELETED, (e: any) => {
            this.store.removeLayer(e.layer);
        });
    }

    enable(mode: 'draw:polygon' | 'draw:polyline' | 'draw:marker' | 'draw:rectangle' | 'draw:square' | 'draw:triangle' | 'draw:circle' | 'draw:freehand' | 'cut' | 'split' | 'union' | 'subtract' | 'drag' | 'scale' | 'rotate' | 'edit' | 'delete'): void {
        this.modeManager.enable(mode);
    }

    disable(): void {
        this.modeManager.disable();
    }

    getLayerGroup(): L.FeatureGroup {
        return this.store.getGroup();
    }
}
