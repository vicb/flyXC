import { loadCss, loadModules } from 'esri-loader';

// List of modules to load.
const moduleNames = [
  'esri/Basemap',
  'esri/Map',
  'esri/views/SceneView',
  'esri/layers/GraphicsLayer',
  'esri/layers/ElevationLayer',
  'esri/layers/BaseElevationLayer',
  'esri/layers/WebTileLayer',
  'esri/Graphic',
  'esri/Color',
  'esri/geometry/Point',
];

// Type of the modules.
export type Api = {
  Basemap: typeof import('esri/Basemap');
  Map: typeof import('esri/Map');
  SceneView: typeof import('esri/views/SceneView');
  GraphicsLayer: typeof import('esri/layers/GraphicsLayer');
  ElevationLayer: typeof import('esri/layers/ElevationLayer');
  BaseElevationLayer: typeof import('esri/layers/BaseElevationLayer');
  WebTileLayer: typeof import('esri/layers/WebTileLayer');
  Graphic: typeof import('esri/Graphic');
  Color: typeof import('esri/Color');
  Point: typeof import('esri/geometry/Point');
};

let apiPromise: Promise<Api> | undefined;

// Loading of the ArcGis API.
export function loadApi(): Promise<Api> {
  if (!apiPromise) {
    apiPromise = loadModules(moduleNames).then((modules) => {
      const api: any = {};
      modules.forEach((module, index) => {
        const fqName = moduleNames[index];
        const name = fqName.substring(fqName.lastIndexOf('/') + 1);
        api[name] = module;
      });
      return api;
    });

    loadCss();
  }
  return apiPromise;
}
