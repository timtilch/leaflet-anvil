import * as L from 'leaflet';
import {
    Circle,
    Hand,
    MapPin,
    Move,
    Pentagon,
    Power,
    RectangleHorizontal,
    RotateCw,
    Scaling,
    Scissors,
    Split,
    Square,
    SquarePen,
    SquaresSubtract,
    SquaresUnite,
    Trash2,
    Triangle,
    Waypoints,
    createElement,
    type IconNode,
} from 'lucide';
import { AnvilMode } from '../types';
import { Anvil } from '../anvil';
import { ANVIL_EVENTS } from '../events';

const ANVIL_TOOLBAR_STYLE_ID = 'anvil-toolbar-styles';

const MODE_CONFIGS: Array<{ id: AnvilMode; title: string; icon: IconNode }> = [
    { id: AnvilMode.Marker, title: 'Marker', icon: MapPin },
    { id: AnvilMode.Polyline, title: 'Line', icon: Waypoints },
    { id: AnvilMode.Polygon, title: 'Polygon', icon: Pentagon },
    { id: AnvilMode.Rectangle, title: 'Rectangle', icon: RectangleHorizontal },
    { id: AnvilMode.Square, title: 'Square', icon: Square },
    { id: AnvilMode.Triangle, title: 'Triangle', icon: Triangle },
    { id: AnvilMode.Circle, title: 'Circle', icon: Circle },
    { id: AnvilMode.Freehand, title: 'Freehand', icon: Hand },
    { id: AnvilMode.Cut, title: 'Cut', icon: Scissors },
    { id: AnvilMode.Split, title: 'Split', icon: Split },
    { id: AnvilMode.Union, title: 'Union', icon: SquaresUnite },
    { id: AnvilMode.Subtract, title: 'Subtract', icon: SquaresSubtract },
    { id: AnvilMode.Drag, title: 'Drag', icon: Move },
    { id: AnvilMode.Scale, title: 'Scale', icon: Scaling },
    { id: AnvilMode.Rotate, title: 'Rotate', icon: RotateCw },
    { id: AnvilMode.Edit, title: 'Edit', icon: SquarePen },
    { id: AnvilMode.Delete, title: 'Delete', icon: Trash2 },
    { id: AnvilMode.Off, title: 'Turn Off', icon: Power },
];

function ensureToolbarStyles(): void {
    if (typeof document === 'undefined' || document.getElementById(ANVIL_TOOLBAR_STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = ANVIL_TOOLBAR_STYLE_ID;
    style.textContent = `
        .anvil-toolbar-container {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .anvil-toolbar-group {
            overflow: hidden;
        }

        .anvil-toolbar-group .anvil-control-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 30px;
            height: 30px;
            color: #2f3b52;
            transition: background-color 140ms ease, color 140ms ease, box-shadow 140ms ease;
        }

        .anvil-toolbar-group .anvil-control-btn svg {
            width: 16px;
            height: 16px;
            stroke-width: 2.1;
        }

        .anvil-toolbar-group .anvil-control-btn:hover,
        .anvil-toolbar-group .anvil-control-btn:focus-visible {
            background-color: #f3f6fb;
            color: #0f172a;
        }

        .anvil-toolbar-group .anvil-control-btn:focus-visible {
            outline: none;
            box-shadow: inset 0 0 0 1px rgba(37, 99, 235, 0.35);
        }

        .anvil-toolbar-group .anvil-control-btn.is-active {
            background-color: #2563eb;
            color: #fff;
            box-shadow: inset 0 0 0 1px rgba(29, 78, 216, 0.45), 0 1px 3px rgba(37, 99, 235, 0.25);
        }

        .anvil-toolbar-group .anvil-control-btn.is-active:hover,
        .anvil-toolbar-group .anvil-control-btn.is-active:focus-visible {
            background-color: #1d4ed8;
            color: #fff;
        }
    `;

    document.head.appendChild(style);
}

function setButtonState(button: HTMLElement, active: boolean): void {
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
}

function buildIcon(iconNode: IconNode): SVGElement {
    return createElement(iconNode, {
        width: 16,
        height: 16,
        'stroke-width': 2.1,
        'aria-hidden': 'true',
        focusable: 'false',
    });
}

export interface AnvilControlOptions extends L.ControlOptions {
    position?: L.ControlPosition;
    modes?: (AnvilMode | AnvilMode[])[];
}

export class AnvilControl extends L.Control {
    private _btns: { [key: string]: HTMLElement } = {};
    private _anvil: Anvil;
    private _options: AnvilControlOptions;

    constructor(anvil: Anvil, options?: AnvilControlOptions) {
        super(L.Util.extend({ position: 'topleft' }, options));
        this._anvil = anvil;
        this._options = { ...options };
    }

    onAdd(map: L.Map): HTMLElement {
        ensureToolbarStyles();

        const container = L.DomUtil.create('div', 'anvil-toolbar-container');
        const modesInput = this._options.modes || MODE_CONFIGS.filter(({ id }) => id !== AnvilMode.Off).map(({ id }) => id);
        const blocks = Array.isArray(modesInput[0])
            ? modesInput as AnvilMode[][]
            : [modesInput as AnvilMode[]];

        const createButton = (group: HTMLElement, config: { id: AnvilMode; title: string; icon: IconNode }): void => {
            const btn = L.DomUtil.create('a', 'anvil-control-btn', group);
            btn.href = '#';
            btn.title = config.title;
            btn.setAttribute('role', 'button');
            btn.setAttribute('aria-label', config.title);
            btn.appendChild(buildIcon(config.icon));

            L.DomEvent.disableClickPropagation(btn);
            L.DomEvent.on(btn, 'click', (e) => {
                L.DomEvent.preventDefault(e);
                if (config.id === AnvilMode.Off) {
                    this._anvil.disable();
                } else {
                    this._anvil.enable(config.id);
                }
            });

            this._btns[config.id] = btn;
        };

        blocks.forEach((block, index) => {
            const group = L.DomUtil.create('div', 'leaflet-bar anvil-toolbar-group', container);

            block.forEach(modeId => {
                const config = MODE_CONFIGS.find(({ id }) => id === modeId);
                if (!config) return;

                createButton(group, config);
            });

            if (index === blocks.length - 1 && !this._btns[AnvilMode.Off]) {
                createButton(group, MODE_CONFIGS.find(({ id }) => id === AnvilMode.Off)!);
            }
        });

        const updateFn = (mode: string | null) => {
            for (const id in this._btns) {
                const active = (id === mode) || (id === AnvilMode.Off && !mode);
                setButtonState(this._btns[id], active);
            }
        };

        updateFn(null);
        map.on(ANVIL_EVENTS.MODE_CHANGE, (e: any) => updateFn(e.mode), this);

        return container;
    }
}

export function anvilControl(anvil: Anvil, options?: AnvilControlOptions): AnvilControl {
    return new AnvilControl(anvil, options);
}
