import * as L from 'leaflet';
import { Anvil } from '../anvil';
import { ANVIL_EVENTS } from '../events';

const SVG_ATTRS = 'xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

const ICONS: { [key: string]: string } = {
    // Marker: Map-Pin mit Punkt in der Mitte
    'draw:marker': `<svg ${SVG_ATTRS}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`,
    // Polyline: Kurvige Route mit Endpunkten
    'draw:polyline': `<svg ${SVG_ATTRS}><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/><circle cx="6" cy="19" r="3"/></svg>`,
    // Polygon: Klassische unregelmäßige 5-Eck-Form
    'draw:polygon': `<svg ${SVG_ATTRS}><path d="m12 2 10 7-3 12H5l-3-12Z"/></svg>`,
    // Rectangle: Horizontales Rechteck
    'draw:rectangle': `<svg ${SVG_ATTRS}><rect width="20" height="12" x="2" y="6" rx="2"/></svg>`,
    // Square: Quadratisches Rechteck (1:1)
    'draw:square': `<svg ${SVG_ATTRS}><rect width="18" height="18" x="3" y="3" rx="2"/></svg>`,
    // Triangle: Gleichschenkliges Dreieck
    'draw:triangle': `<svg ${SVG_ATTRS}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/></svg>`,
    // Circle: Klassischer Kreis
    'draw:circle': `<svg ${SVG_ATTRS}><circle cx="12" cy="12" r="10"/></svg>`,
    // Freehand: Geschwungene Signatur-Linie
    'draw:freehand': `<svg ${SVG_ATTRS}><path d="m3 16 2 2 16-16"/><path d="M7 21h14"/><path d="M3 11c0 2 2 2 2 2z"/></svg>`,
    // Cut: Offene Schere
    'cut': `<svg ${SVG_ATTRS}><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.12 15.88"/><path d="M14.47 14.48 20 20"/><path d="M8.12 8.12 12 12"/></svg>`,
    // Split: Linie, die eine Form teilt
    'split': `<svg ${SVG_ATTRS}><path d="M3 12h18"/><path d="M8 3v18"/><path d="M16 3v18"/><rect width="18" height="18" x="3" y="3" rx="2" stroke-dasharray="4 4" opacity="0.5"/></svg>`,
    // Union: Zwei verschmolzene Rechtecke
    'union': `<svg ${SVG_ATTRS}><path d="M8 4H4v4"/><path d="M4 12v4a2 2 0 0 0 2 2h4"/><path d="M14 18h4v-4"/><path d="M20 10V6a2 2 0 0 0-2-2h-4"/><path d="M14 10h-4v4" stroke-dasharray="2 2"/></svg>`,
    // Subtract: Hauptform mit "ausgeschnittenem" Bereich (Minus-Metapher)
    'subtract': `<svg ${SVG_ATTRS}><path d="M4 4h16v16H4z"/><path d="M10 10h10v10H10z" stroke-dasharray="2 2" opacity="0.7"/><path d="M15 6h-6"/></svg>`,
    // Drag: Vier-Wege-Pfeil (Move-Metapher)
    'drag': `<svg ${SVG_ATTRS}><path d="m5 9-3 3 3 3"/><path d="m9 5 3-3 3 3"/><path d="m15 19 3 3 3-3"/><path d="m19 9 3 3-3 3"/><path d="M2 12h20"/><path d="M12 2v20"/></svg>`,
    // Scale: Diagonal-Pfeile (Maximize-Metapher)
    'scale': `<svg ${SVG_ATTRS}><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3 14 10"/><path d="M3 21l7-7"/></svg>`,
    // Rotate: Kreispfeil mit Ziel-Icon
    'rotate': `<svg ${SVG_ATTRS}><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>`,
    // Edit: Stift, der über einen Pfad zeichnet
    'edit': `<svg ${SVG_ATTRS}><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`,
    // Delete: Mülleimer mit Deckel und Schlitzen
    'delete': `<svg ${SVG_ATTRS}><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>`,
    // Off: Durchgestrichener Kreis (Power-Off/Disable Metapher)
    'off': `<svg ${SVG_ATTRS}><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>`,
};

export interface AnvilControlOptions extends L.ControlOptions {
    position?: L.ControlPosition;
}

export class AnvilControl extends L.Control {
    private _btns: { [key: string]: HTMLElement } = {};
    private _anvil: Anvil;

    constructor(anvil: Anvil, options?: L.ControlOptions) {
        super(L.Util.extend({ position: 'topleft' }, options));
        this._anvil = anvil;
    }

    onAdd(map: L.Map): HTMLElement {
        console.log('AnvilControl: triggering onAdd');
        const container = L.DomUtil.create('div', 'leaflet-bar anvil-toolbar');
        container.style.backgroundColor = 'white';
        // container.style.border = '2px solid rgba(0,0,0,0.5)'; // Leaflet already has a border
        container.style.display = 'flex';
        container.style.flexDirection = 'column';

        const modes = [
            { id: 'draw:marker', title: 'Marker' },
            { id: 'draw:polyline', title: 'Line' },
            { id: 'draw:polygon', title: 'Polygon' },
            { id: 'draw:rectangle', title: 'Rectangle' },
            { id: 'draw:square', title: 'Square' },
            { id: 'draw:triangle', title: 'Triangle' },
            { id: 'draw:circle', title: 'Circle' },
            { id: 'draw:freehand', title: 'Freehand' },
            { id: 'cut', title: 'Cut' },
            { id: 'split', title: 'Split' },
            { id: 'union', title: 'Union' },
            { id: 'subtract', title: 'Subtract' },
            { id: 'drag', title: 'Drag' },
            { id: 'scale', title: 'Scale' },
            { id: 'rotate', title: 'Rotate' },
            { id: 'edit', title: 'Edit' },
            { id: 'delete', title: 'Delete' },
            { id: 'off', title: 'Turn Off' },
        ];

        modes.forEach(mode => {
            const btn = L.DomUtil.create('a', 'anvil-control-btn', container);
            btn.innerHTML = ICONS[mode.id] || mode.title;
            btn.href = '#';
            btn.title = mode.title;
            btn.style.display = 'flex';
            btn.style.alignItems = 'center';
            btn.style.justifyContent = 'center';
            btn.style.width = '30px';
            btn.style.height = '30px';
            btn.style.color = '#333';
            btn.style.cursor = 'pointer';

            L.DomEvent.disableClickPropagation(btn);
            L.DomEvent.on(btn, 'click', (e) => {
                L.DomEvent.preventDefault(e);
                if (mode.id === 'off') {
                    this._anvil.disable();
                } else {
                    this._anvil.enable(mode.id as any);
                }
            });

            this._btns[mode.id] = btn;
        });

        const updateFn = (m: string | null) => {
            for (const id in this._btns) {
                const active = (id === m) || (id === 'off' && !m);
                this._btns[id].style.backgroundColor = active ? '#eee' : '#fff';
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
