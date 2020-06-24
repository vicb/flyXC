import Protobuf from 'pbf';

import { VectorTile } from '@mapbox/vector-tile';

import { tileCoordinates } from '../../../../common/proj';
import { LatLon, Point } from '../../../../common/track';

const TILE_SIZE = 256;

export const MAX_ASP_TILE_ZOOM = 12;

type Polygon = Point[];

// id -> layer
const aspTilesById = new Map();

// Flags of the airspaces.
const enum Flags {
  AIRSPACE_PROHIBITED = 1 << 0,
  AIRSPACE_RESTRICTED = 1 << 1,
  AIRSPACE_DANGER = 1 << 2,
  AIRSPACE_OTHER = 1 << 3,
  BOTTOM_REF_GND = 1 << 4,
  TOP_REF_GND = 1 << 5,
}

// Returns html describing airspaces at the given point.
// altitude is expressed in meters.
export function AspAt(zoom: number, latLon: LatLon, altitude: number, includeRestricted: boolean): string | null {
  const tileZoom = Math.min(zoom, MAX_ASP_TILE_ZOOM);
  const { tile, px } = tileCoordinates(latLon, tileZoom);

  // Retrieve the tile.
  const id = tileId(zoom, tile);
  if (!aspTilesById.has(id)) {
    return null;
  }
  const layer = aspTilesById.get(id);

  const info: string[] = [];
  for (let i = 0; i < layer.length; i++) {
    const f = layer.feature(i);
    if (
      f.properties.bottom < altitude &&
      !(f.properties.flags & Flags.AIRSPACE_RESTRICTED && !includeRestricted) &&
      isInFeature(px, f)
    ) {
      if (info.push(getAirspaceDescription(f)) == 5) {
        break;
      }
    }
  }

  return info.join('<br/>');
}

// Returns an HTML description for the airspace.
function getAirspaceDescription(feature: any): string {
  const p = feature.properties;
  return `<b>[${p.category}] ${p.name}</b><br/>↧${p.bottom_lbl} ↥${p.top_lbl}`;
}

// Returns whether the point is inside the polygon feature.
function isInFeature(point: Point, feature: any): boolean {
  const ratio = 256 / feature.extent;
  const polygons = classifyRings(feature.loadGeometry());
  for (const rings of polygons) {
    // The point must be in the outer ring.
    let isIn = isInPolygon(point, rings[0], ratio);
    if (isIn) {
      for (let i = 1; i < rings.length; ++i) {
        // The point must not be in any hole.
        isIn = isIn && !isInPolygon(point, rings[i], ratio);
      }
    }
    if (isIn) {
      return true;
    }
  }

  return false;
}

// Returns whether the point is in the polygon.
function isInPolygon(point: Point, polygon: Point[], ratio: number): boolean {
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
    aspTilesById.clear();
  }

  getTile(coord: google.maps.Point, zoom: number, doc: HTMLDocument): HTMLElement {
    return getTile(coord, zoom, zoom, doc, this.altitude, this.showRestricted, this.active);
  }

  releaseTile(el: HTMLElement): void {
    const id = Number(el.getAttribute('tile-id'));
    aspTilesById.delete(id);
  }

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

  getTile(coord: google.maps.Point, zoom: number, doc: HTMLDocument): HTMLElement {
    return getTile(coord, this.mapZoom, this.aspTileZoom, doc, this.altitude, this.showRestricted, this.active);
  }
}

// Fetch a vector tile and returns a canvas.
// altitude is expressed in meters.
function getTile(
  coord: Point,
  zoom: number,
  aspTileZoom: number,
  doc: HTMLDocument,
  altitude: number,
  showRestricted: boolean,
  active: boolean,
): HTMLElement {
  if (!active) {
    return doc.createElement('div');
  }

  const canvas = doc.createElement('canvas');
  const id = tileId(zoom, coord);
  canvas.setAttribute('tile-id', String(id));

  const mapTileSize = TILE_SIZE << (zoom - aspTileZoom);

  fetch(`https://airspaces.storage.googleapis.com/tiles/20200714/${aspTileZoom}/${coord.x}/${coord.y}.pbf`)
    .then((r) => (r.ok ? r.arrayBuffer() : null))
    .then((buffer) => {
      if (buffer == null) {
        return;
      }

      const vTile = new VectorTile(new Protobuf(buffer));

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

        aspTilesById.set(id, vTile.layers.asp);

        for (let i = 0; i < vTile.layers.asp.length; i++) {
          const f = vTile.layers.asp.feature(i);
          const props = f.properties;
          const ratio = mapTileSize / f.extent;
          if (
            f.type === 3 &&
            props.bottom < altitude &&
            !(props.flags & Flags.AIRSPACE_RESTRICTED && !showRestricted)
          ) {
            const polygons = classifyRings(f.loadGeometry());
            polygons.forEach((polygon) => {
              ctx.beginPath();
              polygon.forEach((ring: Point[]) => {
                const coords = ring.map(({ x, y }: { x: number; y: number }) => ({
                  x: Math.round(x * ratio),
                  y: Math.round(y * ratio),
                }));
                ctx.fillStyle = airspaceColor(props.flags, 70);
                ctx.moveTo(coords[0].x, coords[0].y);
                for (let j = 1; j < coords.length; j++) {
                  const p = coords[j];
                  ctx.lineTo(p.x, p.y);
                }
              });
              ctx.closePath();
              ctx.fill('evenodd');
              ctx.strokeStyle = airspaceColor(props.flags, 75);
              ctx.stroke();
            });
          }
        }
      }
    });

  return canvas;
}

// Returns a unique tile id for a given (x, y, zoom).
function tileId(zoom: number, point: Point): number {
  return ((1 << zoom) * point.y + point.x) * 32 + zoom;
}

// Code adapted from https://github.com/mapbox/vector-tile-js

// Returns an array of polygons.
// Each polygon is an array ring.
// The first ring in this array is the outer ring. Following rings are holes.
function classifyRings(rings: Point[][]): Polygon[][] {
  const len = rings.length;

  if (len <= 1) {
    return [rings];
  }

  const polygons: Polygon[][] = [];
  let polygon: Polygon[] | null = null;
  let ccw: boolean | null = null;

  for (let i = 0; i < len; i++) {
    const area = signedArea(rings[i]);
    if (area === 0) {
      continue;
    }

    if (ccw == null) {
      ccw = area < 0;
    }

    if (ccw === area < 0) {
      // Create a new polygon when the winding is the same as the first polygon.
      if (polygon) {
        polygons.push(polygon);
      }
      polygon = [rings[i]];
    } else {
      // Pushes holes in the current polygon.
      polygon?.push(rings[i]);
    }
  }
  if (polygon) {
    polygons.push(polygon);
  }

  return polygons;
}

// Computes the area of a polygon.
// See https://en.wikipedia.org/wiki/Shoelace_formula.
function signedArea(polygon: Polygon): number {
  let sum = 0;
  const len = polygon.length;
  for (let i = 0, j = len - 1; i < len; j = i++) {
    const p1 = polygon[i];
    const p2 = polygon[j];
    sum += (p2.x - p1.x) * (p1.y + p2.y);
  }
  return sum;
}

// Return the color of an airspace given the flags property.
// `alpha` should be in the range 00-ff
function airspaceColor(flags: number, alpha: number): string {
  const alphaStr = String(alpha).padStart(2, '0');
  if (flags & Flags.AIRSPACE_PROHIBITED) {
    return `#bf4040${alphaStr}`;
  }
  if (flags & Flags.AIRSPACE_RESTRICTED) {
    return `#bfbf40${alphaStr}`;
  }
  if (flags & Flags.AIRSPACE_DANGER) {
    return `#bf8040${alphaStr}`;
  }
  return `#808080${alphaStr}`;
}
