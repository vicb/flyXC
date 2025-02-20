import { Overlay } from '@windy/Overlay';
import {
  AwpOverlay,
  CloudsOverlay,
  CurrentOverlay,
  FwiOverlay,
  RainPtypeOverlay,
  WaveOverlay,
} from '@windy/OverlayClasses';
declare const overlays: {
  wind: Overlay<
    'wind',
    import('../weatherClasses/MetricClasses').NumberedMetric,
    import('../weatherClasses/Layer').Layer<import('../weatherClasses/MetricClasses').NumberedMetric>
  >;
  temp: Overlay<
    'temp',
    import('../weatherClasses/MetricClasses').NumberedMetric,
    import('../weatherClasses/Layer').Layer<import('../weatherClasses/MetricClasses').NumberedMetric>
  >;
  wetbulbtemp: Overlay<
    'temp',
    import('../weatherClasses/MetricClasses').NumberedMetric,
    import('../weatherClasses/Layer').Layer<import('../weatherClasses/MetricClasses').NumberedMetric>
  >;
  solarpower: Overlay<
    'solarpower',
    import('../weatherClasses/MetricClasses').NumberedMetric,
    import('../weatherClasses/Layer').Layer<import('../weatherClasses/MetricClasses').NumberedMetric>
  >;
  uvindex: Overlay<
    'uvindex',
    import('../weatherClasses/MetricClasses').UVIndexMetric,
    import('../weatherClasses/Layer').Layer<import('../weatherClasses/MetricClasses').UVIndexMetric>
  >;
  dewpoint: Overlay<
    'dewpoint',
    import('../weatherClasses/MetricClasses').NumberedMetric,
    import('../weatherClasses/Layer').Layer<import('../weatherClasses/MetricClasses').NumberedMetric>
  >;
  gust: Overlay<
    'gust',
    import('../weatherClasses/MetricClasses').NumberedMetric,
    import('../weatherClasses/Layer').Layer<import('../weatherClasses/MetricClasses').NumberedMetric>
  >;
  gustAccu: Overlay<
    'gustAccu',
    import('../weatherClasses/MetricClasses').NumberedMetric,
    import('../weatherClasses/Layer').Layer<import('../weatherClasses/MetricClasses').NumberedMetric>
  >;
  turbulence: Overlay<
    'turbulence',
    import('../weatherClasses/MetricClasses').NumberedMetric,
    import('../weatherClasses/Layer').Layer<import('../weatherClasses/MetricClasses').NumberedMetric>
  >;
  icing: Overlay<
    'icing',
    import('../weatherClasses/MetricClasses').NumberedMetric,
    import('../weatherClasses/Layer').Layer<import('../weatherClasses/MetricClasses').NumberedMetric>
  >;
  rh: Overlay<
    'rh',
    import('../weatherClasses/MetricClasses').NumberedMetric,
    import('../weatherClasses/Layer').Layer<import('../weatherClasses/MetricClasses').NumberedMetric>
  >;
  pressure: Overlay<
    'pressure',
    import('../weatherClasses/MetricClasses').NumberedMetric,
    import('../weatherClasses/Layer').Layer<import('../weatherClasses/MetricClasses').NumberedMetric>
  >;
  rain: RainPtypeOverlay<'rain'>;
  clouds: CloudsOverlay<'clouds'>;
  lclouds: CloudsOverlay<'lclouds'>;
  mclouds: CloudsOverlay<'mclouds'>;
  hclouds: CloudsOverlay<'hclouds'>;
  cape: Overlay<
    'cape',
    import('../weatherClasses/MetricClasses').NumberedMetric,
    import('../weatherClasses/Layer').Layer<import('../weatherClasses/MetricClasses').NumberedMetric>
  >;
  cbase: Overlay<
    'cbase',
    import('../weatherClasses/MetricClasses').NumberedMetric,
    import('../weatherClasses/Layer').Layer<import('../weatherClasses/MetricClasses').NumberedMetric>
  >;
  snowAccu: Overlay<
    'snowAccu',
    import('../weatherClasses/MetricClasses').NumberedMetric,
    import('../weatherClasses/Layer').Layer<import('../weatherClasses/MetricClasses').NumberedMetric>
  >;
  rainAccu: Overlay<
    'rainAccu',
    import('../weatherClasses/MetricClasses').NumberedMetric,
    import('../weatherClasses/Layer').Layer<import('../weatherClasses/MetricClasses').NumberedMetric>
  >;
  waves: WaveOverlay<'waves'>;
  wwaves: WaveOverlay<'wwaves'>;
  swell1: WaveOverlay<'swell1'>;
  swell2: WaveOverlay<'swell2'>;
  swell3: WaveOverlay<'swell3'>;
  swell: WaveOverlay<'swell1'>;
  currents: CurrentOverlay<'currents'>;
  currentsTide: CurrentOverlay<'currentsTide'>;
  sst: Overlay<
    'sst',
    import('../weatherClasses/MetricClasses').NumberedMetric,
    import('../weatherClasses/Layer').Layer<import('../weatherClasses/MetricClasses').NumberedMetric>
  >;
  visibility: Overlay<
    'visibility',
    import('../weatherClasses/MetricClasses').NumberedMetric,
    import('../weatherClasses/Layer').Layer<import('../weatherClasses/MetricClasses').NumberedMetric>
  >;
  fog: Overlay<
    'fog',
    import('../weatherClasses/MetricClasses').NumberedMetric,
    import('../weatherClasses/Layer').Layer<import('../weatherClasses/MetricClasses').NumberedMetric>
  >;
  thunder: Overlay<
    'thunder',
    import('../weatherClasses/MetricClasses').NumberedMetric,
    import('../weatherClasses/Layer').Layer<import('../weatherClasses/MetricClasses').NumberedMetric>
  >;
  snowcover: Overlay<
    'snowcover',
    import('../weatherClasses/MetricClasses').NumberedMetric,
    import('../weatherClasses/Layer').Layer<import('../weatherClasses/MetricClasses').NumberedMetric>
  >;
  cloudtop: Overlay<
    'cloudtop',
    import('../weatherClasses/MetricClasses').NumberedMetric,
    import('../weatherClasses/Layer').Layer<import('../weatherClasses/MetricClasses').NumberedMetric>
  >;
  deg0: Overlay<
    'deg0',
    import('../weatherClasses/MetricClasses').NumberedMetric,
    import('../weatherClasses/Layer').Layer<import('../weatherClasses/MetricClasses').NumberedMetric>
  >;
  gtco3: Overlay<
    'gtco3',
    import('../weatherClasses/MetricClasses').NumberedMetric,
    import('../weatherClasses/Layer').Layer<import('../weatherClasses/MetricClasses').NumberedMetric>
  >;
  pm2p5: Overlay<
    'pm2p5',
    import('../weatherClasses/MetricClasses').NumberedMetric,
    import('../weatherClasses/Layer').Layer<import('../weatherClasses/MetricClasses').NumberedMetric>
  >;
  no2: Overlay<
    'no2',
    import('../weatherClasses/MetricClasses').NumberedMetric,
    import('../weatherClasses/Layer').Layer<import('../weatherClasses/MetricClasses').NumberedMetric>
  >;
  aod550: Overlay<
    'aod550',
    import('../weatherClasses/MetricClasses').NumberedMetric,
    import('../weatherClasses/Layer').Layer<import('../weatherClasses/MetricClasses').NumberedMetric>
  >;
  tcso2: Overlay<
    'tcso2',
    import('../weatherClasses/MetricClasses').NumberedMetric,
    import('../weatherClasses/Layer').Layer<import('../weatherClasses/MetricClasses').NumberedMetric>
  >;
  go3: Overlay<
    'go3',
    import('../weatherClasses/MetricClasses').NumberedMetric,
    import('../weatherClasses/Layer').Layer<import('../weatherClasses/MetricClasses').NumberedMetric>
  >;
  cosc: Overlay<
    'cosc',
    import('../weatherClasses/MetricClasses').NumberedMetric,
    import('../weatherClasses/Layer').Layer<import('../weatherClasses/MetricClasses').NumberedMetric>
  >;
  dustsm: Overlay<
    'dustsm',
    import('../weatherClasses/MetricClasses').NumberedMetric,
    import('../weatherClasses/Layer').Layer<import('../weatherClasses/MetricClasses').NumberedMetric>
  >;
  ptype: RainPtypeOverlay<'ptype'>;
  ccl: Overlay<
    'ccl',
    import('../weatherClasses/MetricClasses').NumberedMetric,
    import('../weatherClasses/Layer').Layer<import('../weatherClasses/MetricClasses').NumberedMetric>
  >;
  radar: Overlay<
    'radar',
    import('../weatherClasses/MetricClasses').NumberedMetric,
    import('../weatherClasses/Layer').Layer<import('../weatherClasses/MetricClasses').NumberedMetric>
  >;
  satellite: Overlay<
    'satellite',
    import('../weatherClasses/MetricClasses').NumberedMetric,
    import('../weatherClasses/Layer').Layer<import('../weatherClasses/MetricClasses').NumberedMetric>
  >;
  radarPlus: Overlay<
    'radarPlus',
    import('../weatherClasses/MetricClasses').NumberedMetric,
    import('../weatherClasses/Layer').Layer<import('../weatherClasses/MetricClasses').NumberedMetric>
  >;
  satelliteIRBT: Overlay<
    'satellite',
    import('../weatherClasses/MetricClasses').NumberedMetric,
    import('../weatherClasses/Layer').Layer<import('../weatherClasses/MetricClasses').NumberedMetric>
  >;
  capAlerts: Overlay<'capAlerts', undefined, import('../weatherClasses/Layer').Layer<undefined>>;
  efiWind: Overlay<
    'efiWind',
    import('../weatherClasses/MetricClasses').NumberedMetric,
    import('../weatherClasses/Layer').Layer<import('../weatherClasses/MetricClasses').NumberedMetric>
  >;
  efiTemp: Overlay<
    'efiTemp',
    import('../weatherClasses/MetricClasses').NumberedMetric,
    import('../weatherClasses/Layer').Layer<import('../weatherClasses/MetricClasses').NumberedMetric>
  >;
  efiRain: Overlay<
    'efiRain',
    import('../weatherClasses/MetricClasses').NumberedMetric,
    import('../weatherClasses/Layer').Layer<import('../weatherClasses/MetricClasses').NumberedMetric>
  >;
  moistureAnom40: Overlay<
    'moistureAnom40',
    import('../weatherClasses/MetricClasses').PrecipMetric,
    import('../weatherClasses/Layer').Layer<import('../weatherClasses/MetricClasses').PrecipMetric>
  >;
  moistureAnom100: Overlay<
    'moistureAnom100',
    import('../weatherClasses/MetricClasses').PrecipMetric,
    import('../weatherClasses/Layer').Layer<import('../weatherClasses/MetricClasses').PrecipMetric>
  >;
  drought40: AwpOverlay<'drought40'>;
  drought100: AwpOverlay<'drought100'>;
  soilMoisture40: Overlay<
    'soilMoisture40',
    import('../weatherClasses/MetricClasses').NumberedMetric,
    import('../weatherClasses/Layer').Layer<import('../weatherClasses/MetricClasses').NumberedMetric>
  >;
  soilMoisture100: Overlay<
    'soilMoisture100',
    import('../weatherClasses/MetricClasses').NumberedMetric,
    import('../weatherClasses/Layer').Layer<import('../weatherClasses/MetricClasses').NumberedMetric>
  >;
  fwi: FwiOverlay<'fwi'>;
  dfm10h: Overlay<
    'dfm10h',
    import('../weatherClasses/MetricClasses').NumberedMetric,
    import('../weatherClasses/Layer').Layer<import('../weatherClasses/MetricClasses').NumberedMetric>
  >;
  heatmaps: Overlay<'heatmaps', undefined, undefined>;
  topoMap: Overlay<'topoMap', undefined, import('../weatherClasses/Layer').Layer<undefined>>;
  hurricanes: Overlay<'hurricanes', undefined, undefined>;
};
export default overlays;
