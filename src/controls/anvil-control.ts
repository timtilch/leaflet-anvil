import * as L from 'leaflet';
import { Anvil } from '../anvil';
import { ANVIL_EVENTS } from '../events';

const ICONS: { [key: string]: string } = {
    'draw:marker': '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>',
    'draw:polyline': '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m19 5-14 14"/><circle cx="19" cy="5" r="2"/><circle cx="5" cy="19" r="2"/></svg>',
    'draw:polygon': '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 2 10 7.5V22H2V9.5z"/></svg>',
    'draw:rectangle': '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="12" x="2" y="6" rx="2"/></svg>',
    'draw:square': '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/></svg>',
    'draw:triangle': '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/></svg>',
    'draw:circle': '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>',
    'draw:freehand': '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>',
    'cut': '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.8" y1="14.8" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>',
    'split': '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" stroke-dasharray="4 2"/><path d="M12 3v18"/></svg>',
    'union': '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4H14V10H20V20H10V14H4Z"/></svg>',
    'subtract': '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4H14V10H10V14H4Z"/><rect x="10" y="10" width="10" height="10" stroke-dasharray="2 2"/></svg>',
    'drag': '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18-3-3 3-3"/><path d="m15 12 3 3-3 3"/><path d="m12 9-3-3 3-3"/><path d="m9 6 3-3 3 3"/><path d="M6 15h12"/><path d="M12 3v18"/></svg>',
    'scale': '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M14 15H9v-5"/><path d="M16 3h5v5"/><path d="M21 3 9 15"/></svg>',
    'rotate': '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>',
    'edit': '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 2 8 12H4Z"/><circle cx="12" cy="2" r="2" fill="currentColor"/><circle cx="20" cy="14" r="2" fill="currentColor"/><circle cx="4" cy="14" r="2" fill="currentColor"/></svg>',
    'delete': '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>',
    'off': '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/></svg>',
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
