import {
  AIRSPACE_TILE_SIZE,
  AirspaceString,
  AirspaceTyped,
  Class,
  LatLon,
  MAX_AIRSPACE_TILE_ZOOM,
  Point,
  Type,
  getAirspaceCategory,
  getAirspaceColor,
  getAirspaceTileUrl,
  isAirspaceVisible,
  isInFeature,
  pixelCoordinates,
  toTypedAirspace,
} from '@flyxc/common';
import { VectorTile } from 'mapbox-vector-tile';

const KEY_X_MULTIPLIER = 2 ** 25;
const MAX_RENDER_TILE_SIZE = 4 * AIRSPACE_TILE_SIZE;

// Information about a tile fetch.
// A single tile can render to multiple canvas when mapZoom > MAX_AIRSPACE_TILE_ZOOM
type FetchInfo = {
  abort: AbortController;
  // The key is the position of the 256*256 tile in the fetched tile.
  // Fetched tiles can cover more than 256*256 when mapZoom > tileZoom.
  // If mapZoom is 12 and tileZoom is 10 then x and y are in [0, 3]
  renderTo: Map<number, HTMLCanvasElement>;
};

// Returns html describing airspaces at the given point.
// altitude is expressed in meters.
// When the gndAltitude is != 0 we assume that we want the airspaces along a track,
// and we return only the airspaces where altitude is in [floor .. top].
// Otherwise we return any airspaces where altitude >= floor (i.e. clicking on a map w/o track).
export async function getAirspaceList(
  zoom: number,
  latLon: LatLon,
  altitude: number,
  gndAltitude: number,
  showClasses: Class[],
  showTypes: Type[],
): Promise<string> {
  const tileZoom = Math.min(zoom, MAX_AIRSPACE_TILE_ZOOM);
  const { tile: tileCoords, px } = pixelCoordinates(latLon, tileZoom, AIRSPACE_TILE_SIZE);

  const response = await fetch(
    getAirspaceTileUrl(tileCoords.x, tileCoords.y, tileZoom, import.meta.env.VITE_AIRSPACE_SERVER),
  );
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
    const airspace = toTypedAirspace(f.properties as AirspaceString);
    const floor = airspace.floorM + (airspace.floorRefGnd ? gndAltitude : 0);
    const top = airspace.topM + (airspace.topRefGnd ? gndAltitude : 0);
    const onlyConsiderFloor = gndAltitude == 0;
    const isBetweenTopAndBottom = altitude >= floor && (onlyConsiderFloor || altitude <= top);
    if (
      isBetweenTopAndBottom &&
      isAirspaceVisible(airspace.icaoClass, showClasses, airspace.type, showTypes) &&
      isInFeature(px, f)
    ) {
      if (info.push(getAirspaceHtmlDescription(airspace)) == 5) {
        break;
      }
    }
  }

  return info.join('<br>');
}

function getAirspaceHtmlDescription(airspace: AirspaceTyped): string {
  let category = getAirspaceCategory(airspace);
  if (category.length > 0) {
    category = `[${category}] `;
  }
  return `<b>${category}${airspace.name}</b><br>↧${airspace.floorLabel} ↥${airspace.topLabel}`;
}

// Airspaces MapType.
// altitude is expressed in meters.
export class AspMapType {
  altitude = 1000;
  minZoom = 0;
  maxZoom = 0;
  tileSize: google.maps.Size;
  classes: Class[] = [];
  types: Type[] = [];
  active_ = true;
  // FetchInfo indexed by fetch key.
  fetchInfoMap: Map<number, FetchInfo> = new Map();

  set active(value: boolean) {
    this.active_ = value;
    if (value == false) {
      for (const info of this.fetchInfoMap.values()) {
        info.abort.abort();
        info.renderTo.clear();
      }
      this.fetchInfoMap.clear();
    }
  }

  get active(): boolean {
    return this.active_;
  }

  // Use this layer to display tile up to maxZoom.
  constructor(altitude: number, maxZoom: number) {
    this.altitude = altitude || 1000;
    this.minZoom = 2;
    this.maxZoom = maxZoom;
    this.tileSize = new google.maps.Size(AIRSPACE_TILE_SIZE, AIRSPACE_TILE_SIZE);
  }

  getTile(coord: google.maps.Point, zoom: number, doc: Document): HTMLElement {
    return getTile(coord, zoom, zoom, doc, this.altitude, this.classes, this.types, this.active, this.fetchInfoMap);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  // @ts-ignore
  releaseTile(el: HTMLElement): void {
    const fetchKey = el.dataset.fetchKey;
    if (fetchKey == null) {
      // Only canvas have keys.
      // Tiles without airspaces (div) have none.
      return;
    }
    const fetchInfo = this.fetchInfoMap.get(Number(fetchKey));
    if (fetchInfo == null) {
      // All the tiles for this fetch have been rendered
      return;
    }
    const renderKey = el.dataset.renderKey;
    if (renderKey != null && fetchInfo.renderTo.get(Number(renderKey)) == el) {
      // There is a bug in Google Maps where a tile is fetched multiple times and then released.
      // Only the tile from the last fetch should be release.
      // We detect that by comparing the element passed to the one rendered to.
      fetchInfo.renderTo.delete(Number(renderKey));
      if (fetchInfo.renderTo.size == 0) {
        // No more tile to render for this fetch, aborting.
        fetchInfo.abort.abort();
        this.fetchInfoMap.delete(Number(fetchKey));
      }
    }
  }

  setAltitude(altitude: number): void {
    this.altitude = altitude;
  }

  showClasses(classes: Class[]): void {
    this.classes = classes;
  }

  showTypes(types: Type[]): void {
    this.types = types;
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
  tileZoom = 0;
  // Zoom level of the map.
  mapZoom = 0;

  constructor(altitude: number, tileZoom: number, mapZoom: number) {
    super(altitude, mapZoom);
    this.mapZoom = this.minZoom = mapZoom;
    this.tileZoom = tileZoom;
    const { renderSize } = getTileSize(mapZoom, tileZoom);
    this.tileSize = new google.maps.Size(renderSize, renderSize);
  }

  // @ts-ignore
  getTile(coord: google.maps.Point, zoom: number, doc: Document): HTMLElement {
    return getTile(
      coord,
      this.mapZoom,
      this.tileZoom,
      doc,
      this.altitude,
      this.classes,
      this.types,
      this.active,
      this.fetchInfoMap,
    );
  }
}

// Fetch a vector tile and returns a canvas.
// altitude is expressed in meters.
function getTile(
  coord: Point,
  mapZoom: number,
  tileZoom: number,
  doc: Document,
  altitude: number,
  showClasses: Class[],
  showTypes: Type[],
  active: boolean,
  fetchInfoMap: Map<number, FetchInfo>,
): HTMLElement {
  if (!active) {
    return doc.createElement('div');
  }

  const { renderSize, fetchSize } = getTileSize(mapZoom, tileZoom);
  const renderZoom = fetchSize / renderSize;
  // Coordinates of the tile to fetch.
  const fetchX = Math.floor(coord.x / renderZoom);
  const fetchY = Math.floor(coord.y / renderZoom);
  const fetchKey = getCoordKey(coord.x, coord.y);
  // Coordinates of the tile to render from the fetched tile.
  const renderKey = getCoordKey((coord.x % renderZoom) * renderSize, (coord.y % renderZoom) * renderSize);

  const canvas = doc.createElement('canvas');
  canvas.dataset.fetchKey = String(fetchKey);
  canvas.dataset.renderKey = String(renderKey);

  const fetchInfo = fetchInfoMap.get(fetchKey);

  if (fetchInfo != null) {
    // There is a bug in Google Maps where the same tile is fetched again before being released.
    // This seems to be linked to fractional zoom.
    // In this case we only update the target canvas and keep the ongoing request.
    fetchInfo.renderTo.set(renderKey, canvas);
    return canvas;
  }

  const abort = new AbortController();

  fetchInfoMap.set(fetchKey, {
    abort,
    renderTo: new Map([[renderKey, canvas]]),
  });

  fetch(getAirspaceTileUrl(fetchX, fetchY, tileZoom, import.meta.env.VITE_AIRSPACE_SERVER), { signal: abort.signal })
    .then((r) => (r.ok ? r.arrayBuffer() : null))
    .then((buffer) => {
      if (buffer == null) {
        return;
      }
      const vectorTile = new VectorTile(new Uint8Array(buffer));
      renderTiles(fetchKey, fetchInfoMap, vectorTile, altitude, showClasses, showTypes, mapZoom, tileZoom);
    })
    .catch((e) => {
      // AbortError are expected when aborting a request.
      if (e.name !== 'AbortError') {
        throw e;
      }
    });

  return canvas;
}

/**
 * Render tiles after a fetch.
 *
 * When the tileZoom is less than the mapZoom, the same tile can be rendered to multiple canvas.
 */
function renderTiles(
  fetchKey: number,
  fetchInfoMap: Map<number, FetchInfo>,
  vectorTile: VectorTile,
  altitude: number,
  showClasses: Class[],
  showTypes: Type[],
  mapZoom: number,
  tileZoom: number,
) {
  const fetchInfo = fetchInfoMap.get(fetchKey);
  if (fetchInfo == null) {
    // The tiles have already been released.
    return;
  }
  fetchInfoMap.delete(fetchKey);

  if (!vectorTile.layers.asp) {
    return;
  }

  const { renderSize, fetchSize } = getTileSize(mapZoom, tileZoom);

  const renderZoom = fetchSize / renderSize;

  for (const [renderKey, canvas] of fetchInfo.renderTo) {
    const [renderX, renderZ] = getXYFromCoordKey(renderKey);
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    canvas.height = canvas.width = renderSize;
    canvas.style.imageRendering = 'crisp-edges';

    if (devicePixelRatio == 2) {
      canvas.style.width = `${canvas.width}px`;
      canvas.style.height = `${canvas.height}px`;
      canvas.width *= 2;
      canvas.height *= 2;
      ctx.scale(2, 2);
    }

    for (let i = 0; i < vectorTile.layers.asp.length; i++) {
      const f = vectorTile.layers.asp.feature(i);
      const airspace = toTypedAirspace(f.properties as any);
      const ratio = renderSize / f.extent;
      if (
        f.type === 3 &&
        airspace.floorM < altitude &&
        isAirspaceVisible(airspace.icaoClass, showClasses, airspace.type, showTypes)
      ) {
        const polygons = f.asPolygons() ?? [];
        polygons.forEach((polygon) => {
          ctx.beginPath();
          polygon.forEach((ring: Point[]) => {
            const coords = ring.map(({ x, y }: { x: number; y: number }) => ({
              x: Math.round(x * ratio * renderZoom) - renderX,
              y: Math.round(y * ratio * renderZoom) - renderZ,
            }));
            ctx.fillStyle = getAirspaceColor(airspace, 70);
            ctx.moveTo(coords[0].x, coords[0].y);
            for (let j = 1; j < coords.length; j++) {
              const p = coords[j];
              ctx.lineTo(p.x, p.y);
            }
          });
          ctx.closePath();
          ctx.fill('evenodd');
          ctx.strokeStyle = getAirspaceColor(airspace, 75);
          ctx.stroke();
        });
      }
    }
  }
}

// Computes a key from x and y.
function getCoordKey(x: number, y: number): number {
  return x * KEY_X_MULTIPLIER + y;
}

// Computes x and y from a key.
function getXYFromCoordKey(key: number): [x: number, y: number] {
  return [Math.floor(key / KEY_X_MULTIPLIER), key % KEY_X_MULTIPLIER];
}

// Return the tile sizes.
//
// fetchSize is the size of of a fetched tile.
// renderSize is the size of a rendered tile.
//
// One fetched tile could be rendered with multiple tiles
function getTileSize(mapZoom: number, tileZoom: number): { renderSize: number; fetchSize: number } {
  const fetchSize = 2 ** (mapZoom - tileZoom) * AIRSPACE_TILE_SIZE;
  const renderSize = Math.min(fetchSize, MAX_RENDER_TILE_SIZE);
  return { renderSize, fetchSize };
}
