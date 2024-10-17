import { customElement } from 'lit/decorators.js';

import { WMTSMapTypeElement } from './wmts-overlay';

@customElement('topo-spain')
export class TopoSpain extends WMTSMapTypeElement {
  static mapTypeId = 'topo.spain';
  mapName = 'Spain';
  copyright = {
    html: `<img src="/static/img/topo.es.png" />`,
    url: 'http://www.ign.es/',
  };
  url =
    'https://www.ign.es/wmts/mapa-raster?layer=MTN&style=default&tilematrixset=GoogleMapsCompatible&Service=WMTS&Request=GetTile&Version=1.0.0&Format=image/jpeg&TileMatrix={zoom}&TileCol={x}&TileRow={y}';
  zoom = [6, 18];
  bounds = [[44.0314, -21.3797, 27.141, 5.0789]];
}

const IGNFR_PLAN = 'GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2';
const IGNFR_SCAN = 'GEOGRAPHICALGRIDSYSTEMS.MAPS';
const IGNFR_SCAN_OACI = 'GEOGRAPHICALGRIDSYSTEMS.MAPS.SCAN-OACI';

@customElement('topo-france')
export class TopoFrance extends WMTSMapTypeElement {
  static mapTypeId = 'topo.france.classique';
  static mapTypeIdScan = 'topo.france.scan';
  static mapTypeIdScanOACI = 'topo.france.scan-oaci';

  mapName = 'France';
  copyright = {
    html: `<img src="/static/img/topo.fr.png" />`,
    url: 'http://www.ign.fr/',
  };
  get url(): string {
    // https://geoservices.ign.fr/actualites/2023-11-20-acces-donnesnonlibres-gpf
    if (this.layerName == IGNFR_PLAN) {
      return `https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&LAYER=${this.layerName}&STYLE=normal&FORMAT=image/png&TILEMATRIXSET=PM&TILEMATRIX={zoom}&TILEROW={y}&TILECOL={x}`;
    }
    return `https://data.geopf.fr/private/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile&apikey=ign_scan_ws&LAYER=${this.layerName}&STYLE=normal&FORMAT=image/jpeg&TILEMATRIXSET=PM&TILEMATRIX={zoom}&TILEROW={y}&TILECOL={x}`;
  }
  zoom = [6, 17];
  bounds = [
    [42.3058, -0.7618, 46.4181, 7.9109], // FXX
    [11.7, -64, 18.18, -59], // ANF
    [-40, 76, -36, 79], // ASP
    [-68.62, 132.56, -64.03, 144.54], // ATF
    [-48, 47, -44, 55], // CRZ
    [15.75, -63.2, 17.5, -60], // GLP
    [-4.3, -62.1, 11.5, -46], // GUF
    [-53, 62, -45, 76], // KER
    [11.7, -64, 15.7, -59], // MTQ
    [-17.5, 40, 3, 56], //MYT
    [-24.3, 160, -17.1, 170], // NCL
    [-28.2, -160, 11, -108], // PYF
    [-26.2, 37.5, -17.75, 60], // REU
    [17.75, -63, 17.99, -62.7], // SBA
    [18, -63.19, 18.18, -62.9], // SMA
    [43.5, -60, 52, -50], // SPM
    [-14.6, -178.5, -12.8, -175.8], // WLF
  ];

  layerName = IGNFR_PLAN;

  protected getScanMapType(): google.maps.ImageMapType {
    return new google.maps.ImageMapType({
      getTileUrl: (...args): string => this.getTileUrl(...args),
      tileSize: new google.maps.Size(256, 256),
      minZoom: 6,
      maxZoom: 17,
      name: 'France (scan)',
      alt: 'France',
    });
  }

  protected getScanOACIMapType(): google.maps.ImageMapType {
    return new google.maps.ImageMapType({
      getTileUrl: (...args): string => this.getTileUrl(...args),
      tileSize: new google.maps.Size(256, 256),
      minZoom: 6,
      maxZoom: 11,
      name: 'OACI (France)',
      alt: 'OACI ',
    });
  }

  protected init(map: google.maps.Map): void {
    super.init(map);
    this.registerMapType(TopoFrance.mapTypeIdScan, this.getScanMapType());
    this.registerMapType(TopoFrance.mapTypeIdScanOACI, this.getScanOACIMapType());
  }

  protected visibilityHandler(mapTypeId: string): void {
    if (this.copyrightEl) {
      this.copyrightEl.hidden = false;
      switch (mapTypeId) {
        case TopoFrance.mapTypeIdScanOACI:
          this.layerName = IGNFR_SCAN_OACI;
          break;
        case TopoFrance.mapTypeIdScan:
          this.layerName = IGNFR_SCAN;
          break;
        case TopoFrance.mapTypeId:
          this.layerName = IGNFR_PLAN;
          break;
        default:
          this.copyrightEl.hidden = true;
      }
    }
    super.visibilityHandler(mapTypeId);
  }
}

@customElement('topo-otm')
export class TopoOtm extends WMTSMapTypeElement {
  static mapTypeId = 'topo.otm';
  mapName = 'OpenTopoMap';
  copyright = {
    html: `<img src="/static/img/topo.otm.png" />`,
    url: 'https://opentopomap.org/about',
  };
  url = 'https://b.tile.opentopomap.org/{zoom}/{x}/{y}.png';
  zoom = [5, 17];
  bounds = null;
}
