import * as L from 'leaflet';
import { Mode } from '../anvil';
import { ANVIL_EVENTS } from '../events';

export class ModeManager {
    private currentMode: Mode | null = null;
    private modes: Map<string, Mode> = new Map();

    constructor(private map: L.Map) {
    }

    addMode(name: string, mode: Mode): void {
        this.modes.set(name, mode);
    }

    enable(name: string): void {
        const mode = this.modes.get(name);
        if (!mode) {
            console.warn(`Anvil ModeManager: Mode "${name}" not found.`);
            return;
        }
        if (this.currentMode === mode) return;

        this.disable();
        this.currentMode = mode;
        this.currentMode.enable();
        this.map.fire(ANVIL_EVENTS.MODE_CHANGE, { mode: name });
    }

    disable(): void {
        if (this.currentMode) {
            this.currentMode.disable();
            this.currentMode = null;
            this.map.fire(ANVIL_EVENTS.MODE_CHANGE, { mode: null });
        }
    }
}


