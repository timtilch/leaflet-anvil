import * as L from 'leaflet';
import { AnvilOptions } from '../anvil';
import { LayerStore } from '../layers/layer-store';
import { AnvilMode } from '../types';
import { EditMode } from './edit-mode';

export class TopologyMode extends EditMode {
    constructor(
        map: L.Map,
        store: LayerStore,
        options: AnvilOptions = {},
    ) {
        super(map, store, options, {
            modeId: AnvilMode.Topology,
            autoSelectAll: true,
            allowLayerSelection: false,
            clearSelectionOnMapClick: false,
            defaultSelectionPathOptions: {
                color: '#0891b2',
                weight: 3,
                opacity: 0.95,
            },
            defaultHandleOptions: {
                radius: 5,
                color: '#0891b2',
                fillColor: '#ecfeff',
                fillOpacity: 1,
                weight: 2,
            },
            defaultGhostHandleOptions: {
                radius: 4,
                color: '#cffafe',
                fillColor: '#0891b2',
                fillOpacity: 0.9,
                weight: 2,
            },
        });
    }
}
