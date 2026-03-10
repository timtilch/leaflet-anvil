import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as L from 'leaflet';
import { ModeManager } from '../modes/mode-manager';
import { ANVIL_EVENTS } from '../events';
import { Mode } from '../anvil';
import { createMap } from './helpers/leaflet-mock';

function makeMockMode(): Mode & { enableCalled: boolean; disableCalled: boolean } {
    return {
        enableCalled: false,
        disableCalled: false,
        enable() {
            this.enableCalled = true;
        },
        disable() {
            this.disableCalled = true;
        },
    };
}

describe('ModeManager', () => {
    let map: L.Map;
    let manager: ModeManager;

    beforeEach(() => {
        map = createMap();
        manager = new ModeManager(map);
    });

    afterEach(() => {
        map.remove();
    });

    it('enable() ruft enable() des registrierten Modus auf', () => {
        const mode = makeMockMode();
        manager.addMode('test', mode);
        manager.enable('test');
        expect(mode.enableCalled).toBe(true);
    });

    it('enable() feuert anvil:modechange-Event mit dem Modus-Namen', () => {
        const mode = makeMockMode();
        manager.addMode('test', mode);
        const handler = vi.fn();
        map.on(ANVIL_EVENTS.MODE_CHANGE, handler);
        manager.enable('test');
        expect(handler).toHaveBeenCalledOnce();
        expect(handler.mock.calls[0][0]).toMatchObject({ mode: 'test' });
    });

    it('enable() auf einen unbekannten Modus loggt eine Warnung und tut nichts', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {
        });
        manager.enable('unknown');
        expect(warn).toHaveBeenCalledOnce();
    });

    it('disable() ruft disable() des aktiven Modus auf', () => {
        const mode = makeMockMode();
        manager.addMode('test', mode);
        manager.enable('test');
        manager.disable();
        expect(mode.disableCalled).toBe(true);
    });

    it('disable() feuert anvil:modechange-Event mit null', () => {
        const mode = makeMockMode();
        manager.addMode('test', mode);
        manager.enable('test');
        const handler = vi.fn();
        map.on(ANVIL_EVENTS.MODE_CHANGE, handler);
        manager.disable();
        expect(handler.mock.calls[0][0]).toMatchObject({ mode: null });
    });

    it('disable() tut nichts wenn kein Modus aktiv ist', () => {
        // Kein Fehler erwartet
        expect(() => manager.disable()).not.toThrow();
    });

    it('wechsel zwischen zwei Modi: alter Modus wird deaktiviert', () => {
        const modeA = makeMockMode();
        const modeB = makeMockMode();
        manager.addMode('a', modeA);
        manager.addMode('b', modeB);

        manager.enable('a');
        manager.enable('b');

        expect(modeA.disableCalled).toBe(true);
        expect(modeB.enableCalled).toBe(true);
    });

    it('nochmaliges enable() desselben Modus hat keinen Effekt', () => {
        const mode = makeMockMode();
        manager.addMode('test', mode);
        manager.enable('test');
        // Zurücksetzen
        mode.enableCalled = false;
        manager.enable('test');
        expect(mode.enableCalled).toBe(false);
    });
});

