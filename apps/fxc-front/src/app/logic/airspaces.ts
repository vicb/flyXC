import type { AirspaceString, AirspaceTyped, Class, LatLon, Point, Type } from '@flyxc/common';
import {
  AIRSPACE_TILE_SIZE,
  applyOverrides,
  getAirspaceCategory,
  getAirspaceColor,
  getAirspaceTileUrl,
  getPixelCoordinates,
  isAirspaceVisible,
  isInFeature,
  MAX_AIRSPACE_TILE_ZOOM,
  toTypedAirspace,
} from '@flyxc/common';
import { classifyRingsFlat, FeatureType, VectorTile } from 'mapbox-vector-tile';

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

/** Parameters of {@link getAirspaceList}. */
export interface AirspaceListQuery {
  latLon: LatLon;
  /** Map zoom, capped to `MAX_AIRSPACE_TILE_ZOOM` to pick the tile. Defaults to `MAX_AIRSPACE_TILE_ZOOM`. */
  zoom?: number;

  /**
   * Altitude to compare with the airspace limits. Airspaces whose floor is above it are always
   * ignored (they are not reachable from this altitude).
   */
  altitude: number;
  /**
   * Whether to also check the top of the airspaces: when `true`, airspaces whose top is below `altitude`
   * are ignored (i.e. only the airspaces that contain `altitude` are kept).
   * Defaults to `false`: airspaces are kept whatever their top.
   * - `false`: e.g. a click on a map without a track, show everything above the point.
   * - `true`: e.g. a point along a track, show only the airspaces the pilot is in.
   */
  checkTop?: boolean;
  /** Margin in meters added around the floor / top when comparing with `altitude`. Defaults to 0. */
  altitudeMargin?: number;
  /** Margin in tile pixels (0..255) around the polygon outer boundary. Defaults to 0. */
  marginPx?: number;
  /** Ground elevation at `latLon`, added to the floors / tops referenced to GND. Defaults to 0. */
  gndAltitude?: number;
  /** Airspaces with a floor above this altitude are ignored. Defaults to no limit. */
  maxFloorAltitude?: number;

  // --- Visibility ---
  /** ICAO classes to show. */
  visibleClasses: Class[];
  /** Airspace types to show. */
  visibleTypes: Type[];
  /** Date used to apply the airspace overrides (e.g. temporary activation). */
  date: Date;
}

/**
 * Returns the airspaces (at most 5) at the given location matching the query.
 */
export async function getAirspaceList({
  latLon,
  zoom = MAX_AIRSPACE_TILE_ZOOM,
  altitude,
  checkTop = false,
  altitudeMargin = 0,
  marginPx = 0,
  gndAltitude = 0,
  maxFloorAltitude = Infinity,
  visibleClasses,
  visibleTypes,
  date,
}: AirspaceListQuery): Promise<AirspaceTyped[]> {
  const tileZoom = Math.min(zoom, MAX_AIRSPACE_TILE_ZOOM);
  const { tile: tileCoords, px } = getPixelCoordinates(latLon, tileZoom, AIRSPACE_TILE_SIZE);

  const response = await fetch(
    getAirspaceTileUrl(tileCoords.x, tileCoords.y, tileZoom, import.meta.env.VITE_AIRSPACE_SERVER),
  );
  if (!response.ok) {
    return [];
  }

  const pbf = await response.arrayBuffer();
  if (!pbf) {
    return [];
  }

  const layer = new VectorTile(new Uint8Array(pbf)).getLayer<AirspaceString>('asp');

  if (layer == null) {
    return [];
  }

  const airspaces: AirspaceTyped[] = [];
  for (const f of layer) {
    if (f.type !== FeatureType.POLYGON || !isInFeature(px, f, marginPx)) {
      continue;
    }
    const airspace = applyOverrides(toTypedAirspace(f.properties, f.id), date);
    if (airspace.floorM > maxFloorAltitude) {
      continue;
    }
    const floor = airspace.floorM + (airspace.floorRefGnd ? gndAltitude : 0);
    if (altitude < floor - altitudeMargin) {
      continue;
    }
    if (checkTop) {
      const top = airspace.topM + (airspace.topRefGnd ? gndAltitude : 0);
      if (altitude > top + altitudeMargin) {
        continue;
      }
    }
    if (!isAirspaceVisible(airspace.icaoClass, visibleClasses, airspace.type, visibleTypes)) {
      continue;
    }
    if (airspaces.push(airspace) == 5) {
      break;
    }
  }

  return airspaces;
}

/**
 * Formats a list of airspaces as an HTML snippet for map popups.
 */
export function getAirspaceListHtml(airspaces: AirspaceTyped[]): string {
  return airspaces.map(getAirspaceHtmlDescription).join('<br>');
}

/**
 * Formats an airspace summary as an HTML snippet for map popups.
 *
 * @param airspace Typed airspace metadata to format.
 * @returns HTML string describing category, name, floor, and ceiling.
 */
export function getAirspaceHtmlDescription(airspace: AirspaceTyped): string {
  const category = getAirspaceCategory(airspace);
  const prefix = category ? `[${category}] ` : '';
  return `<b>${prefix}${airspace.name}</b><br>↧${airspace.floorLabel} ↥${airspace.topLabel}`;
}

// Airspaces MapType.
// altitude is expressed in meters.
export class AspMapType {
  altitude = 1000;
  opacity = 70;
  minZoom = 0;
  maxZoom = 0;
  tileSize: google.maps.Size;
  classes: Class[] = [];
  types: Type[] = [];
  active_ = true;
  date = new Date();

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
    return getTile(
      coord,
      zoom,
      zoom,
      doc,
      this.altitude,
      this.classes,
      this.types,
      this.active,
      this.fetchInfoMap,
      this.date,
      this.opacity,
    );
  }

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

  setOpacity(opacity: number): void {
    this.opacity = opacity;
  }

  showClasses(classes: Class[]): void {
    this.classes = classes;
  }

  showTypes(types: Type[]): void {
    this.types = types;
  }

  setDate(date: Date): void {
    this.date = date;
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
      this.date,
      this.opacity,
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
  date: Date,
  opacity: number,
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
      renderTiles(
        fetchKey,
        fetchInfoMap,
        vectorTile,
        altitude,
        showClasses,
        showTypes,
        mapZoom,
        tileZoom,
        date,
        opacity,
      );
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
export function renderTiles(
  fetchKey: number,
  fetchInfoMap: Map<number, FetchInfo>,
  vectorTile: VectorTile,
  altitude: number,
  showClasses: Class[],
  showTypes: Type[],
  mapZoom: number,
  tileZoom: number,
  date: Date,
  opacity: number,
) {
  const fetchInfo = fetchInfoMap.get(fetchKey);
  if (fetchInfo == null) {
    // The tiles have already been released.
    return;
  }
  fetchInfoMap.delete(fetchKey);

  const layer = vectorTile.getLayer<AirspaceString>('asp');
  if (!layer) {
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

    for (const f of layer) {
      if (f.type !== FeatureType.POLYGON) {
        continue;
      }
      const ratio = renderSize / f.extent;
      const scale = ratio * renderZoom;
      const [minX, minY, maxX, maxY] = f.bbox();
      if (
        maxX * scale < renderX - 1 ||
        minX * scale > renderX + renderSize + 1 ||
        maxY * scale < renderZ - 1 ||
        minY * scale > renderZ + renderSize + 1
      ) {
        continue;
      }

      const airspace = applyOverrides(toTypedAirspace(f.properties, f.id), date);
      if (
        airspace.floorM >= altitude ||
        !isAirspaceVisible(airspace.icaoClass, showClasses, airspace.type, showTypes)
      ) {
        continue;
      }

      ctx.fillStyle = getAirspaceColor(airspace, opacity);
      ctx.strokeStyle = getAirspaceColor(airspace, opacity + 5);

      const { coords, ends } = f.loadFlatGeometry();
      const polygonEnds = classifyRingsFlat(coords, ends);

      let ringIdx = 0;
      let coordIdx = 0;
      for (let p = 0; p < polygonEnds.length; p++) {
        const polyEnd = polygonEnds[p];
        ctx.beginPath();
        while (ringIdx < polyEnd) {
          const ringEnd = ends[ringIdx++];
          ctx.moveTo(
            Math.round(coords[coordIdx] * scale) - renderX,
            Math.round(coords[coordIdx + 1] * scale) - renderZ,
          );
          for (let i = coordIdx + 2; i < ringEnd; i += 2) {
            ctx.lineTo(Math.round(coords[i] * scale) - renderX, Math.round(coords[i + 1] * scale) - renderZ);
          }
          coordIdx = ringEnd;
        }
        ctx.closePath();
        ctx.fill('evenodd');
        ctx.stroke();
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
