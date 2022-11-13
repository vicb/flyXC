import { airspaceColor, Flags, getAspTileUrl, isInFeature } from 'flyxc/common/src/airspaces';
import { pixelCoordinates } from 'flyxc/common/src/proj';
import { LatLon, Point } from 'flyxc/common/src/runtime-track';
import { VectorTile } from 'mapbox-vector-tile';

const TILE_SIZE = 256;

export const MAX_ASP_TILE_ZOOM = 12;

// Returns html describing airspaces at the given point.
// altitude is expressed in meters.
export async function getAirspaceList(
  zoom: number,
  latLon: LatLon,
  altitude: number,
  includeRestricted: boolean,
): Promise<string> {
  const tileZoom = Math.min(zoom, MAX_ASP_TILE_ZOOM);
  const { tile: tileCoords, px } = pixelCoordinates(latLon, tileZoom);

  const response = await fetch(getAspTileUrl(tileCoords.x, tileCoords.y, zoom));
  if (!response.ok) {
    return '';
  }

  const pbf = await response.arrayBuffer();
  if (!pbf) {
    return '';
  }

  const layer = new VectorTile(new Uint8Array(pbf)).layers.asp;

  if (layer == null) {
    return '';
  }

  const info: string[] = [];
  for (let i = 0; i < layer.length; i++) {
    const f = layer.feature(i);
    const p = f.properties;
    if (
      (p.bottom ?? 0) < altitude &&
      !(Number(p.flags ?? 0) & Flags.AirspaceRestricted && !includeRestricted) &&
      isInFeature(px, f)
    ) {
      if (info.push(getAirspaceDescription(f)) == 5) {
        break;
      }
    }
  }

  return info.join('<br>');
}

// Returns an HTML description for the airspace.
function getAirspaceDescription(feature: any): string {
  const p = feature.properties;
  return `<b>[${p.category}] ${p.name}</b><br>↧${p.bottom_lbl} ↥${p.top_lbl}`;
}

// Airspaces MapType.
// altitude is expressed in meters.
export class AspMapType {
  altitude = 1000;
  minZoom = 0;
  maxZoom = 0;
  tileSize: google.maps.Size;
  showRestricted = true;
  active = true;

  // Use this layer to display tile up to maxZoom.
  constructor(altitude: number, maxZoom: number) {
    this.altitude = altitude || 1000;
    this.minZoom = 2;
    this.maxZoom = maxZoom;
    this.tileSize = new google.maps.Size(TILE_SIZE, TILE_SIZE);
  }

  getTile(coord: google.maps.Point, zoom: number, doc: Document): HTMLElement {
    return getTile(coord, zoom, zoom, doc, this.altitude, this.showRestricted, this.active);
  }

  releaseTile(el: HTMLElement): void {}

  setAltitude(altitude: number): void {
    this.altitude = altitude;
  }

  setShowRestricted(show: boolean): void {
    this.showRestricted = show;
  }

  // minZoom and maxZoom are not taken into account by the Google Maps API for overlay map types.
  // We need to manually activate the layers for the current zoom level.
  setCurrentZoom(zoom: number): void {
    this.active = zoom >= this.minZoom && zoom <= this.maxZoom;
  }
}

// Airspaces Map Type used when tiles are not available at the current zoom level.
// Tiles from a lower level are over zoomed.
// altitude is expressed in meters.
export class AspZoomMapType extends AspMapType {
  // Zoom level of the tiles.
  aspTileZoom = 0;
  mapZoom = 0;

  constructor(altitude: number, aspTileZoom: number, mapZoom: number) {
    super(altitude, mapZoom);
    this.mapZoom = this.minZoom = mapZoom;
    this.aspTileZoom = aspTileZoom;
    const tileSize = TILE_SIZE << (mapZoom - aspTileZoom);
    this.tileSize = new google.maps.Size(tileSize, tileSize);
  }

  getTile(coord: google.maps.Point, zoom: number, doc: Document): HTMLElement {
    return getTile(coord, this.mapZoom, this.aspTileZoom, doc, this.altitude, this.showRestricted, this.active);
  }
}

// Fetch a vector tile and returns a canvas.
// altitude is expressed in meters.
function getTile(
  coord: Point,
  zoom: number,
  aspTileZoom: number,
  doc: Document,
  altitude: number,
  showRestricted: boolean,
  active: boolean,
): HTMLElement {
  if (!active) {
    return doc.createElement('div');
  }

  const canvas = doc.createElement('canvas');
  const mapTileSize = TILE_SIZE << (zoom - aspTileZoom);

  fetch(getAspTileUrl(coord.x, coord.y, aspTileZoom))
    .then((r) => (r.ok ? r.arrayBuffer() : null))
    .then((buffer) => {
      if (buffer == null) {
        return;
      }

      const vTile = new VectorTile(new Uint8Array(buffer));

      if (vTile.layers.asp) {
        const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
        canvas.height = canvas.width = mapTileSize;
        canvas.style.imageRendering = 'pixelated';

        if (devicePixelRatio == 2) {
          canvas.style.width = `${canvas.width}px`;
          canvas.style.height = `${canvas.height}px`;
          canvas.width *= 2;
          canvas.height *= 2;
          ctx.scale(2, 2);
        }

        for (let i = 0; i < vTile.layers.asp.length; i++) {
          const f = vTile.layers.asp.feature(i);
          const props = f.properties;
          const ratio = mapTileSize / f.extent;
          const flags = props.flags as number;
          if (
            f.type === 3 &&
            (props.bottom as number) < altitude &&
            !(flags & Flags.AirspaceRestricted && !showRestricted)
          ) {
            const polygons = f.asPolygons() ?? [];
            polygons.forEach((polygon) => {
              ctx.beginPath();
              polygon.forEach((ring: Point[]) => {
                const coords = ring.map(({ x, y }: { x: number; y: number }) => ({
                  x: Math.round(x * ratio),
                  y: Math.round(y * ratio),
                }));
                ctx.fillStyle = airspaceColor(flags, 70);
                ctx.moveTo(coords[0].x, coords[0].y);
                for (let j = 1; j < coords.length; j++) {
                  const p = coords[j];
                  ctx.lineTo(p.x, p.y);
                }
              });
              ctx.closePath();
              ctx.fill('evenodd');
              ctx.strokeStyle = airspaceColor(flags, 75);
              ctx.stroke();
            });
          }
        }
      }
    });

  return canvas;
}
