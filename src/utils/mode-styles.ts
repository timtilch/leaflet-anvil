import * as L from 'leaflet';
import type { AnvilOptions } from '../anvil';
import { AnvilMode } from '../types';

export function getModePathOptions(
    options: AnvilOptions,
    mode: AnvilMode,
    defaults: L.PathOptions = {},
): L.PathOptions {
    return {
        ...defaults,
        ...(options.pathOptions || {}),
        ...(options.modeStyles?.[mode]?.pathOptions || {}),
    };
}

export function getModeGhostPathOptions(
    options: AnvilOptions,
    mode: AnvilMode,
    defaults: L.PathOptions = {},
): L.PathOptions {
    return {
        ...getModePathOptions(options, mode),
        ...defaults,
        ...(options.ghostPathOptions || {}),
        ...(options.modeStyles?.[mode]?.ghostPathOptions || {}),
    };
}

export function getModeVertexOptions(
    options: AnvilOptions,
    mode: AnvilMode,
    defaults: L.MarkerOptions = {},
): L.MarkerOptions {
    return {
        ...defaults,
        ...(options.vertexOptions || {}),
        ...(options.modeStyles?.[mode]?.vertexOptions || {}),
    };
}

export function getModeHandleOptions(
    options: AnvilOptions,
    mode: AnvilMode,
    defaults: L.CircleMarkerOptions = {},
): L.CircleMarkerOptions {
    const pathOptions = getModePathOptions(options, mode);

    return {
        radius: 5,
        color: (pathOptions.color as string | undefined) || '#3388ff',
        weight: 2,
        fillColor: '#fff',
        fillOpacity: 1,
        ...defaults,
        ...(options.modeStyles?.[mode]?.handleOptions || {}),
    };
}

export function getModeSelectionPathOptions(
    options: AnvilOptions,
    mode: AnvilMode,
    base: L.PathOptions = {},
    defaults: L.PathOptions = {},
): L.PathOptions {
    return {
        ...base,
        ...defaults,
        ...(options.modeStyles?.[mode]?.selectionPathOptions || {}),
    };
}
