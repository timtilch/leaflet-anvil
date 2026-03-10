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

    it('enable() calls enable() on the registered mode', () => {
        const mode = makeMockMode();
        manager.addMode('test', mode);
        manager.enable('test');
        expect(mode.enableCalled).toBe(true);
    });

    it('enable() fires anvil:modechange event with the mode name', () => {
        const mode = makeMockMode();
        manager.addMode('test', mode);
        const handler = vi.fn();
        map.on(ANVIL_EVENTS.MODE_CHANGE, handler);
        manager.enable('test');
        expect(handler).toHaveBeenCalledOnce();
        expect(handler.mock.calls[0][0]).toMatchObject({ mode: 'test' });
    });

    it('enable() deactivates the previous mode before activating the new one', () => {
        const m1 = makeMockMode();
        const m2 = makeMockMode();
        manager.addMode('m1', m1);
        manager.addMode('m2', m2);

        manager.enable('m1');
        manager.enable('m2');

        expect(m1.disableCalled).toBe(true);
        expect(m2.enableCalled).toBe(true);
    });

    it('enable() does nothing if the mode is already active', () => {
        const m1 = makeMockMode();
        manager.addMode('m1', m1);

        manager.enable('m1');
        m1.enableCalled = false; // Reset flag for next call

        manager.enable('m1');
        expect(m1.enableCalled).toBe(false);
    });

    it('disable() deactivates the active mode', () => {
        const mode = makeMockMode();
        manager.addMode('test', mode);
        manager.enable('test');
        manager.disable();
        expect(mode.disableCalled).toBe(true);
    });

    it('disable() fires anvil:modechange event with null', () => {
        const mode = makeMockMode();
        manager.addMode('test', mode);
        manager.enable('test');

        const handler = vi.fn();
        map.on(ANVIL_EVENTS.MODE_CHANGE, handler);

        manager.disable();

        expect(handler).toHaveBeenCalledOnce();
        expect(handler.mock.calls[0][0]).toMatchObject({ mode: null });
    });

    it('disable() does nothing if no mode is active', () => {
        const handler = vi.fn();
        map.on(ANVIL_EVENTS.MODE_CHANGE, handler);

        manager.disable();
        expect(handler).not.toHaveBeenCalled();
    });

    it('enable() prints warning for non-existent mode', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
        });
        manager.enable('notfound');
        expect(warnSpy).toHaveBeenCalledOnce();
        expect(warnSpy.mock.calls[0][0]).toContain('Mode "notfound" not found');
        warnSpy.mockRestore();
    });
});
