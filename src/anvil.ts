import * as L from 'leaflet';
import { AnvilMode } from './types';
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
import { TopologyMode } from './modes/topology-mode';
import { DeleteMode } from './modes/delete-mode';
import { LayerStore } from './layers/layer-store';
import { ANVIL_EVENTS } from './events';
import { anvilControl } from './controls/anvil-control';

export { AnvilMode } from './types';

export interface Mode {
    enable(): void;

    disable(): void;
}

export type AnvilModeTooltips = Partial<Record<AnvilMode, string>>;
export type AnvilModeTooltipResolver = (
    mode: AnvilMode,
    defaultTooltip: string,
) => string | null | undefined;

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
    modeStyles?: AnvilModeStyles;
    controlPosition?: L.ControlPosition;
    modes?: (AnvilMode | AnvilMode[])[];
    modeTooltips?: AnvilModeTooltips | AnvilModeTooltipResolver;
}

export interface AnvilModeStyleOptions {
    pathOptions?: L.PathOptions;
    ghostPathOptions?: L.PathOptions;
    vertexOptions?: L.MarkerOptions;
    handleOptions?: L.CircleMarkerOptions;
    selectionPathOptions?: L.PathOptions;
}

export type AnvilModeStyles = Partial<Record<AnvilMode, AnvilModeStyleOptions>>;

const ANVIL_INTERACTION_STYLE_ID = 'anvil-interaction-styles';

function ensureInteractionStyles(): void {
    if (typeof document === 'undefined' || document.getElementById(ANVIL_INTERACTION_STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = ANVIL_INTERACTION_STYLE_ID;
    style.textContent = `
        .leaflet-container .leaflet-pane .leaflet-interactive:focus,
        .leaflet-container .leaflet-pane .leaflet-interactive:focus-visible,
        .leaflet-container .leaflet-pane svg path:focus,
        .leaflet-container .leaflet-pane svg path:focus-visible {
            outline: none !important;
        }
    `;

    document.head.appendChild(style);
}

export class Anvil {
    private modeManager: ModeManager;
    private store: LayerStore;
    private options: AnvilOptions;
    private control?: L.Control;

    constructor(private map: L.Map, options?: AnvilOptions) {
        ensureInteractionStyles();

        this.options = {
            snapping: false,
            snapDistance: 10,
            preventSelfIntersection: false,
            controlPosition: 'topleft',
            ...options,
        };
        this.store = new LayerStore(map, this.options.layerGroup);
        this.modeManager = new ModeManager(map);

        const modesFromOptions = this.options.modes || (Object.values(AnvilMode) as AnvilMode[]);
        const flattenedModes = modesFromOptions.flat() as AnvilMode[];

        if (flattenedModes.includes(AnvilMode.Polygon)) {
            this.modeManager.addMode(AnvilMode.Polygon, new DrawPolygonMode(this.map, this.options, this.store));
        }
        if (flattenedModes.includes(AnvilMode.Polyline)) {
            this.modeManager.addMode(AnvilMode.Polyline, new DrawPolylineMode(this.map, this.options, this.store));
        }
        if (flattenedModes.includes(AnvilMode.Marker)) {
            this.modeManager.addMode(AnvilMode.Marker, new DrawMarkerMode(this.map, this.options, this.store));
        }
        if (flattenedModes.includes(AnvilMode.Rectangle)) {
            this.modeManager.addMode(AnvilMode.Rectangle, new DrawRectangleMode(this.map, this.options, this.store));
        }
        if (flattenedModes.includes(AnvilMode.Square)) {
            this.modeManager.addMode(AnvilMode.Square, new DrawSquareMode(this.map, this.options, this.store));
        }
        if (flattenedModes.includes(AnvilMode.Triangle)) {
            this.modeManager.addMode(AnvilMode.Triangle, new DrawTriangleMode(this.map, this.options, this.store));
        }
        if (flattenedModes.includes(AnvilMode.Circle)) {
            this.modeManager.addMode(AnvilMode.Circle, new DrawCircleMode(this.map, this.options, this.store));
        }
        if (flattenedModes.includes(AnvilMode.Freehand)) {
            this.modeManager.addMode(AnvilMode.Freehand, new FreehandMode(this.map, this.store, this.options));
        }
        if (flattenedModes.includes(AnvilMode.Cut)) {
            this.modeManager.addMode(AnvilMode.Cut, new CutMode(map, this.store, this.options));
        }
        if (flattenedModes.includes(AnvilMode.Split)) {
            this.modeManager.addMode(AnvilMode.Split, new SplitMode(map, this.store, this.options));
        }
        if (flattenedModes.includes(AnvilMode.Union)) {
            this.modeManager.addMode(AnvilMode.Union, new UnionMode(map, this.store, this.options));
        }
        if (flattenedModes.includes(AnvilMode.Subtract)) {
            this.modeManager.addMode(AnvilMode.Subtract, new SubtractMode(map, this.store, this.options));
        }
        if (flattenedModes.includes(AnvilMode.Drag)) {
            this.modeManager.addMode(AnvilMode.Drag, new DragMode(map, this.store, this.options));
        }
        if (flattenedModes.includes(AnvilMode.Scale)) {
            this.modeManager.addMode(AnvilMode.Scale, new ScaleMode(map, this.store, this.options));
        }
        if (flattenedModes.includes(AnvilMode.Rotate)) {
            this.modeManager.addMode(AnvilMode.Rotate, new RotateMode(map, this.store, this.options));
        }
        if (flattenedModes.includes(AnvilMode.Edit)) {
            this.modeManager.addMode(AnvilMode.Edit, new EditMode(this.map, this.store, this.options));
        }
        if (flattenedModes.includes(AnvilMode.Topology)) {
            this.modeManager.addMode(AnvilMode.Topology, new TopologyMode(this.map, this.store, this.options));
        }
        if (flattenedModes.includes(AnvilMode.Delete)) {
            this.modeManager.addMode(AnvilMode.Delete, new DeleteMode(map, this.store));
        }

        this.map.on(ANVIL_EVENTS.CREATED, (e: any) => {
            this.store.addLayer(e.layer);
        });

        this.map.on(ANVIL_EVENTS.DELETED, (e: any) => {
            this.store.removeLayer(e.layer);
        });

        this.control = anvilControl(this, {
            position: this.options.controlPosition,
            modes: modesFromOptions,
            modeTooltips: this.options.modeTooltips,
        });
        this.control?.addTo(this.map);
    }

    enable(mode: AnvilMode): void {
        this.modeManager.enable(mode);
    }

    disable(): void {
        this.modeManager.disable();
    }

    getLayerGroup(): L.FeatureGroup {
        return this.store.getGroup();
    }
}
