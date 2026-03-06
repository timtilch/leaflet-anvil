import * as L from 'leaflet';
import { Anvil } from './anvil';
import { anvilControl } from './controls/anvil-control';

export * from './anvil';
export * from './events';
export * from './controls/anvil-control';

// Attach Factories for classic Leaflet usage
(L as any).anvil = (map: L.Map, options?: any) => new Anvil(map, options);
if ((L as any).control) {
    (L as any).control.anvil = (anvil: Anvil, options?: any) => anvilControl(anvil, options);
}
