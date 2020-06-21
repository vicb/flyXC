import Protobuf from 'pbf';
import { VectorTile } from '@mapbox/vector-tile';

const TILE_SIZE = 256;
const RESTRICTED_COLOR = '#bfbf40';

// id -> layer
const layerMap = new Map();

// Returns html describing airspaces at the given point.
export function AspAt(
  map: google.maps.Map,
  latLng: google.maps.LatLng,
  altitudeKm: number,
  includeRestricted: boolean,
): string | null {
  const worldCoords = (map.getProjection() as google.maps.Projection).fromLatLngToPoint(latLng);
  const zoom = Math.min(map.getZoom(), 13);
  const scale = 1 << zoom;

  const tileCoords = new google.maps.Point(
    Math.floor((worldCoords.x * scale) / TILE_SIZE),
    Math.floor((worldCoords.y * scale) / TILE_SIZE),
  );

  const id = tileId(zoom, tileCoords.x, tileCoords.y);

  if (!layerMap.has(id)) {
    return null;
  }

  const pxCoords = new google.maps.Point(
    Math.floor(worldCoords.x * scale) - tileCoords.x * TILE_SIZE,
    Math.floor(worldCoords.y * scale) - tileCoords.y * TILE_SIZE,
  );

  const layer = layerMap.get(id);

  const info = [];
  for (let i = 0; i < layer.length; i++) {
    const f = layer.feature(i);
    if (
      f.properties.bottom_km < altitudeKm &&
      !(f.properties.color == RESTRICTED_COLOR && !includeRestricted) &&
      isInFeature(pxCoords, f)
    ) {
      info.push(
        `<b>[${f.properties.category}] ${f.properties.name}</b><br/>↧${f.properties.bottom} ↥${f.properties.top}`,
      );
      if (info.length == 5) {
        break;
      }
    }
  }

  return info.join('<br/>');
}

// Returns whether the point is inside the polygon feature.
function isInFeature(point: google.maps.Point, feature: any): boolean {
  const ratio = 256 / feature.extent;
  // Each ring could be one or more polygons.
  const rings = feature.loadGeometry();
  let isIn = false;
  // Whether the current ring includes the points.
  const include = true;
  for (let i = 0; i < rings.length; ++i) {
    // Get the current ring as an array of polygons.
    let ring = rings[i];
    if (!Array.isArray(ring[0])) {
      ring = [ring];
    }
    ring.forEach((polygon: any) => {
      if (isInPolygon(point, polygon, ratio)) {
        isIn = include;
      }
    });
    // Alternate inclusive and exclusive rings.
    include != include;
  }
  return isIn;
}

// Returns whether the point is in the polygon.
function isInPolygon(point: google.maps.Point, polygon: { x: number; y: number }[], ratio: number): boolean {
  const { x, y } = { x: point.x / ratio, y: point.y / ratio };

  let isIn = false;

  let [xa, ya] = [polygon[0].x, polygon[0].y];
  for (let j = 1; j < polygon.length; j++) {
    const [xb, yb] = [polygon[j].x, polygon[j].y];

    if (ya > y != yb > y && x < ((xb - xa) * (y - ya)) / (yb - ya) + xa) {
      isIn = !isIn;
    }
    [xa, ya] = [xb, yb];
  }

  return isIn;
}

// Airspaces MapType.
export class AspMapType {
  altitude = 1;
  minZoom = 0;
  maxZoom = 0;
  tileSize: google.maps.Size;
  showRestricted = true;

  constructor(altitude: number, maxZoom: number) {
    this.altitude = altitude || 1;
    this.minZoom = 4;
    this.maxZoom = maxZoom;
    this.tileSize = new google.maps.Size(TILE_SIZE, TILE_SIZE);
    layerMap.clear();
  }

  getTile(coord: google.maps.Point, zoom: number, doc: HTMLDocument): HTMLElement {
    return getTile(coord, zoom, doc, this.altitude, this.showRestricted);
  }

  releaseTile(canvas: HTMLElement): void {
    const id = Number(canvas.getAttribute('tile-id'));
    layerMap.delete(id);
  }

  setAltitude(altitudeKm: number): void {
    this.altitude = altitudeKm;
  }

  setShowRestricted(show: boolean): void {
    this.showRestricted = show;
  }
}

// Airspaces Map Type used when tiles are not available at the current zoom level.
// Tiles from a lower level are over zoomed.
export class AspZoomMapType extends AspMapType {
  baseZoom = 0;

  constructor(altitude: number, baseZoom: number, zoom: number) {
    super(altitude, zoom);
    this.minZoom = zoom;
    this.baseZoom = baseZoom;
    const overZoom = zoom - baseZoom;
    this.tileSize = new google.maps.Size(TILE_SIZE << overZoom, TILE_SIZE << overZoom);
  }

  getTile(coord: google.maps.Point, zoom: number, doc: HTMLDocument): HTMLElement {
    return getTile(coord, this.baseZoom, doc, this.altitude, this.showRestricted, this.minZoom);
  }
}

// Fetch a vector tile and returns a canvas.
function getTile(
  coord: google.maps.Point,
  baseZoom: number,
  doc: HTMLDocument,
  altitude: number,
  showRestricted: boolean,
  dstZoom: number = baseZoom,
): HTMLElement {
  const canvas = doc.createElement('canvas');
  const overZoom = dstZoom - baseZoom;

  const id = tileId(baseZoom, coord.x, coord.y);
  canvas.setAttribute('tile-id', `${id}`);

  fetch(`https://airspaces.storage.googleapis.com/tiles/${baseZoom}/${coord.x}/${coord.y}.pbf`)
    .then((r) => (r.ok ? r.arrayBuffer() : null))
    .then((buffer) => {
      if (buffer == null) {
        return;
      }

      const vTile = new VectorTile(new Protobuf(buffer));

      if (vTile.layers.asp) {
        const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
        canvas.height = canvas.width = TILE_SIZE << overZoom;
        canvas.style.imageRendering = 'pixelated';

        if (devicePixelRatio == 2) {
          canvas.style.width = `${canvas.width}px`;
          canvas.style.height = `${canvas.height}px`;
          canvas.width *= 2;
          canvas.height *= 2;
          ctx.scale(2, 2);
        }

        layerMap.set(id, vTile.layers.asp);

        for (let i = 0; i < vTile.layers.asp.length; i++) {
          const f = vTile.layers.asp.feature(i);
          const ratio = (TILE_SIZE << overZoom) / f.extent;
          if (
            f.type === 3 &&
            f.properties.bottom_km < altitude &&
            !(f.properties.color == RESTRICTED_COLOR && !showRestricted)
          ) {
            ctx.beginPath();
            f.loadGeometry().forEach((rings: any) => {
              if (!Array.isArray(rings[0])) {
                rings = [rings];
              }
              rings.forEach((ring: { x: number; y: number }[]) => {
                const coords = ring.map(({ x, y }: { x: number; y: number }) => ({
                  x: Math.round(x * ratio),
                  y: Math.round(y * ratio),
                }));
                ctx.fillStyle = f.properties.color + '70';
                ctx.moveTo(coords[0].x, coords[0].y);
                for (let j = 1; j < coords.length; j++) {
                  const p = coords[j];
                  ctx.lineTo(p.x, p.y);
                }
              });
            });
            ctx.closePath();
            ctx.fill('evenodd');
            ctx.strokeStyle = f.properties.color + '75';
            ctx.stroke();
          }
        }
      }
    });

  return canvas;
}

//

function tileId(z: number, x: number, y: number): number {
  return ((1 << z) * y + x) * 32 + z;
}
