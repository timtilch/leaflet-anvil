import * as L from 'leaflet';
import { Anvil } from './anvil';
import { anvilControl } from './controls/anvil-control';

export * from './anvil';
export * from './events';
export * from './controls/anvil-control';

// Attach Factories for classic Leaflet usage
const leaflet = L as any;
leaflet.Anvil = Anvil;
leaflet.anvil = (map: L.Map, options?: any) => new Anvil(map, options);

if (leaflet.Control) {
    leaflet.Control.Anvil = (anvil: Anvil, options?: any) => anvilControl(anvil, options);
    leaflet.control.anvil = (anvil: Anvil, options?: any) => anvilControl(anvil, options);
}
