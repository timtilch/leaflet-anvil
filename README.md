# Leaflet Anvil 🛠️

Ein minimalistisches, leistungsstarkes Toolkit zum Zeichnen und Editieren von Geometrien in [Leaflet](https://leafletjs.com/). Fokus liegt
auf einer sauberen API, modernen TypeScript-Features und Unterstützung für komplexe geometrische Operationen wie Union und Subtract.

## Features

- **Zeichen-Modi**: Marker, Polylines, Polygone, Rechtecke, Quadrate, Dreiecke, Kreise und Freehand-Drawing.
- **Editier-Tools**: Drag, Scale, Rotate und Vertex-Editing.
- **Geometrische Operationen**:
    - `Union`: Verschmelzen von zwei Polygonen.
    - `Subtract`: Abziehen eines Polygons von einem anderen.
    - `Cut` & `Split`: Zerschneiden von Linien oder Flächen.
- **Smart Helpers**: Snapping (Einrasten) an vorhandenen Punkten und Magnetic-Modus.
- **Event-basiert**: Einfache Integration durch ein konsistentes Event-System.

## Installation

```bash
npm install leaflet-anvil
```

*Hinweis: Leaflet ist eine Peer-Dependency und muss ebenfalls installiert sein.*

## Schnellstart

```typescript
import L from 'leaflet';
import { Anvil } from 'leaflet-anvil';

const map = L.map('map').setView([51.505, -0.09], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

// Anvil initialisieren
const anvil = new Anvil(map, {
    snapping: true,
    snapDistance: 15
});

// Einen Modus aktivieren
anvil.enable('draw:polygon');

// Auf Events reagieren
map.on('anvil:created', (e) => {
    console.log('Neuer Layer erstellt:', e.layer);
});
```

## Verfügbare Modi

Aktivierung über `anvil.enable(modeName)`:

| Modus            | Beschreibung                            |
|:-----------------|:----------------------------------------|
| `draw:marker`    | Setzt einen Marker                      |
| `draw:polyline`  | Zeichnet eine Linie                     |
| `draw:polygon`   | Zeichnet eine geschlossene Fläche       |
| `draw:rectangle` | Zeichnet ein Rechteck                   |
| `draw:circle`    | Zeichnet einen Kreis                    |
| `draw:freehand`  | Freihandzeichnen (Klicken und Ziehen)   |
| `edit`           | Bearbeiten von Eckpunkten (Vertices)    |
| `drag`           | Verschieben von ganzen Layern           |
| `rotate`         | Rotieren von Geometrien                 |
| `scale`          | Skalieren von Geometrien                |
| `union`          | Verschmelzen zweier Polygone            |
| `subtract`       | Abziehen des zweiten vom ersten Polygon |
| `delete`         | Layer per Klick entfernen               |

## API Referenz

### Anvil Options

| Option                    | Typ             | Standard | Beschreibung                        |
|:--------------------------|:----------------|:---------|:------------------------------------|
| `snapping`                | `boolean`       | `false`  | Aktiviert Snapping an Eckpunkten    |
| `snapDistance`            | `number`        | `10`     | Distanz in Pixeln für Snapping      |
| `preventSelfIntersection` | `boolean`       | `false`  | Verhindert Selbstüberschneidungen   |
| `pathOptions`             | `L.PathOptions` | `{}`     | Standard-Styles für neue Geometrien |

### Events (`ANVIL_EVENTS`)

Alle Events werden auf der Leaflet-Map gefeuert:

- `anvil:created`: Wenn ein neuer Layer fertiggestellt wurde.
- `anvil:edited`: Wenn ein Layer verändert wurde (drag/rotate/edit/scale).
- `anvil:deleted`: Wenn ein Layer entfernt wurde.
- `anvil:modechange`: Wenn der aktive Modus wechselt.

## Entwicklung

```bash
# Abhängigkeiten installieren
npm install

# Entwicklungsserver (Vite)
npm run dev

# Tests ausführen
npm test

# Build erstellen
npm run build
```

## Lizenz

MIT

