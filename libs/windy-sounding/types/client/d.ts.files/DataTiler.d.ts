import { MapCoordinates } from '@windy/dataSpecifications.d';

export interface TilePoint {
  x: number;
  y: number;
  z: number;
}

export interface ExtendedTileParams extends MapCoordinates {
  /**
   * => bounds.min.x of map.getPixelBounds();
   */
  pixelOriginX: number;

  /**
   * => bounds.min.y of map.getPixelBounds();
   */
  pixelOriginY: number;

  /**
   * Data zoom
   */
  dZoom: number;

  /**
   * Size of map in piels
   */
  width: number;

  /**
   * Size of map in pxels
   */
  height: number;

  /**
   * Coords of original unwrapped map tiles
   * basicaly map.getPixelBounds();
   */
  origTiles: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
}
