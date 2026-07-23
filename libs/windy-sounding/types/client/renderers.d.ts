import { Renderer } from '@windy/Renderer';
import { TileLayer } from '@windy/TileLayer';
import { TopoMap } from '@windy/TopoMap';
declare const renderers: {
  /**
   * All layers should be now supported by gl-tiles-render
   */
  tileLayer: TileLayer;
  noUserControl: TileLayer;
  radarPlus: Renderer;
  capAlerts: Renderer;
  avalancheDanger: Renderer;
  isolines: Renderer;
  particles: Renderer;
  /** Extreme forecast and intersucho layers */
  daySwitcher: TileLayer;
  accumulations: TileLayer;
  levelsRange: TileLayer;
  fireDanger: TileLayer;
  /** Seznam topographic Map */
  topoMap: TopoMap;
};
export default renderers;
