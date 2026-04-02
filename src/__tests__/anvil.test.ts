import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as L from 'leaflet';
import { Anvil, AnvilMode } from '../anvil';
import { ANVIL_EVENTS } from '../events';
import { createMap, fireMapClick } from './helpers/leaflet-mock';

describe('Anvil', () => {
    let map: L.Map;
    let anvil: Anvil;

    function getToolbarButtons(): HTMLElement[] {
        return Array.from(document.querySelectorAll<HTMLElement>('.anvil-control-btn'));
    }

    beforeEach(() => {
        map = createMap();
        anvil = new Anvil(map);
    });

    afterEach(() => {
        anvil.disable();
        map.remove();
    });

    it('getLayerGroup() returns a FeatureGroup', () => {
        expect(anvil.getLayerGroup()).toBeInstanceOf(L.FeatureGroup);
    });

    it('enable() activates the specified mode', () => {
        // Should not throw
        expect(() => anvil.enable(AnvilMode.Marker)).not.toThrow();
    });

    it('disable() deactivates the active mode', () => {
        anvil.enable(AnvilMode.Marker);
        expect(() => anvil.disable()).not.toThrow();
    });

    it('MODE_CHANGE event is fired on mode change', () => {
        const handler = vi.fn();
        map.on(ANVIL_EVENTS.MODE_CHANGE, handler);

        anvil.enable(AnvilMode.Marker);

        expect(handler).toHaveBeenCalledOnce();
        expect(handler.mock.calls[0][0]).toMatchObject({ mode: AnvilMode.Marker });
    });

    it('CREATED event → Layer is automatically added to the store', () => {
        const marker = L.marker([51.5, -0.1]);
        map.fire(ANVIL_EVENTS.CREATED, { layer: marker });

        expect(anvil.getLayerGroup().hasLayer(marker)).toBe(true);
    });

    it('DELETED event → Layer is automatically removed from the store', () => {
        const marker = L.marker([51.5, -0.1]);
        map.fire(ANVIL_EVENTS.CREATED, { layer: marker });
        map.fire(ANVIL_EVENTS.DELETED, { layer: marker });

        expect(anvil.getLayerGroup().hasLayer(marker)).toBe(false);
    });

    it('all supported modes can be activated without error', () => {
        const modes: AnvilMode[] = Object.values(AnvilMode);

        for (const mode of modes) {
            expect(() => anvil.enable(mode)).not.toThrow();
        }
    });

    it('Marker drawing integration: Click → anvil:created → in store', () => {
        anvil.enable(AnvilMode.Marker);
        const handler = vi.fn();
        map.on(ANVIL_EVENTS.CREATED, handler);

        fireMapClick(map, 51.5, -0.1);

        expect(handler).toHaveBeenCalledOnce();
        const layer = handler.mock.calls[0][0].layer as L.Marker;
        expect(anvil.getLayerGroup().hasLayer(layer)).toBe(true);
    });

    it('uses built-in tooltips by default', () => {
        map.remove();
        map = createMap();
        anvil = new Anvil(map, {
            modes: [AnvilMode.Edit],
        });

        const [editButton, offButton] = getToolbarButtons();

        expect(editButton.title).toBe('Edit');
        expect(editButton.getAttribute('aria-label')).toBe('Edit');
        expect(offButton.title).toBe('Turn Off');
    });

    it('uses custom mode tooltips for toolbar buttons', () => {
        map.remove();
        map = createMap();
        anvil = new Anvil(map, {
            modes: [AnvilMode.Edit],
            modeTooltips: {
                [AnvilMode.Edit]: 'Edit geometry',
                [AnvilMode.Off]: 'Disable tools',
            },
        });

        const buttons = getToolbarButtons();

        expect(buttons[0].title).toBe('Edit geometry');
        expect(buttons[0].getAttribute('aria-label')).toBe('Edit geometry');
        expect(buttons[1].title).toBe('Disable tools');
    });

    it('falls back to built-in tooltips for modes not included in a custom tooltip map', () => {
        map.remove();
        map = createMap();
        anvil = new Anvil(map, {
            modes: [AnvilMode.Edit],
            modeTooltips: {
                [AnvilMode.Edit]: 'Edit geometry',
            },
        });

        const [editButton, offButton] = getToolbarButtons();

        expect(editButton.title).toBe('Edit geometry');
        expect(offButton.title).toBe('Turn Off');
    });

    it('passes the built-in tooltip to the resolver', () => {
        map.remove();
        map = createMap();

        const resolver = vi.fn((mode: AnvilMode, defaultTooltip: string) => `${mode}:${defaultTooltip}`);

        anvil = new Anvil(map, {
            modes: [AnvilMode.Edit],
            modeTooltips: resolver,
        });

        const [editButton, offButton] = getToolbarButtons();

        expect(resolver).toHaveBeenCalledWith(AnvilMode.Edit, 'Edit');
        expect(resolver).toHaveBeenCalledWith(AnvilMode.Off, 'Turn Off');
        expect(editButton.title).toBe('edit:Edit');
        expect(offButton.title).toBe('off:Turn Off');
    });

    it('falls back to built-in tooltips when the resolver returns nothing', () => {
        map.remove();
        map = createMap();

        anvil = new Anvil(map, {
            modes: [AnvilMode.Edit],
            modeTooltips: () => undefined,
        });

        const [editButton, offButton] = getToolbarButtons();

        expect(editButton.title).toBe('Edit');
        expect(offButton.title).toBe('Turn Off');
    });

    it('resolves mode tooltips lazily so language changes after init are picked up', () => {
        map.remove();
        map = createMap();

        let language = 'en';
        const translations = {
            en: { [AnvilMode.Edit]: 'Edit', [AnvilMode.Off]: 'Turn Off' },
            de: { [AnvilMode.Edit]: 'Bearbeiten', [AnvilMode.Off]: 'Ausschalten' },
        } satisfies Record<string, Partial<Record<AnvilMode, string>>>;

        anvil = new Anvil(map, {
            modes: [AnvilMode.Edit],
            modeTooltips: (mode) => translations[language][mode],
        });

        const [editButton, offButton] = getToolbarButtons();

        expect(editButton.title).toBe('Edit');
        expect(offButton.title).toBe('Turn Off');

        language = 'de';
        editButton.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        offButton.dispatchEvent(new FocusEvent('focus'));

        expect(editButton.title).toBe('Bearbeiten');
        expect(editButton.getAttribute('aria-label')).toBe('Bearbeiten');
        expect(offButton.title).toBe('Ausschalten');
    });
});
