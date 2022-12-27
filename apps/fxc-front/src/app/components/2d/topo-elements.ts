import { customElement } from 'lit/decorators.js';
// Warning: those are not the same at lit-element ones.
import { html } from 'lit/html.js';

import { getApiKey } from '../../apikey';
import { WMTSMapTypeElement } from './wmts-overlay';

@customElement('topo-eu')
export class TopoEu extends WMTSMapTypeElement {
  static mapTypeId = 'topo.eu';
  mapName = 'Europe';
  copyright = {
    html: html` <img src="/static/img/topo.eu.png" /> `,
    url: 'http://www.4umaps.eu/',
  };
  url = 'https://tileserver.4umaps.com/{zoom}/{x}/{y}.png';
  zoom = [6, 15];
  bounds = [[27.06, -33.74, 61.6, 36.58]];
}

@customElement('topo-spain')
export class TopoSpain extends WMTSMapTypeElement {
  static mapTypeId = 'topo.spain';
  mapName = 'Spain';
  copyright = {
    html: html` <img src="/static/img/topo.es.png" /> `,
    url: 'http://www.ign.es/',
  };
  url =
    'https://www.ign.es/wmts/mapa-raster?layer=MTN&style=default&tilematrixset=GoogleMapsCompatible&Service=WMTS&Request=GetTile&Version=1.0.0&Format=image/jpeg&TileMatrix={zoom}&TileCol={x}&TileRow={y}';
  zoom = [6, 18];
  bounds = [[44.0314, -21.3797, 27.141, 5.0789]];
}

@customElement('topo-france')
export class TopoFrance extends WMTSMapTypeElement {
  static mapTypeId = 'topo.france.classique';
  static mapTypeIdScan = 'topo.france.scan';
  mapName = 'France';
  copyright = {
    html: html` <img src="/static/img/topo.fr.png" /> `,
    url: 'http://www.ign.fr/',
  };
  get url(): string {
    return 'https://wxs.ign.fr/{API_KEY}/geoportail/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile&LAYER={layer}&STYLE=normal&FORMAT={FORMAT}&TILEMATRIXSET=PM&TILEMATRIX={zoom}&TILEROW={y}&TILECOL={x}'
      .replace('{layer}', this.layerName)
      .replace('{API_KEY}', this.layerName == 'GEOGRAPHICALGRIDSYSTEMS.MAPS' ? getApiKey('ignfr') : 'essentiels')
      .replace('{FORMAT}', this.layerName == 'GEOGRAPHICALGRIDSYSTEMS.MAPS' ? 'image/jpeg' : 'image/png');
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

  layerName = 'GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2';

  protected getScanMapType(): google.maps.ImageMapType {
    return new google.maps.ImageMapType({
      getTileUrl: (...args): string => this.getTileUrl(...args),
      tileSize: new google.maps.Size(256, 256),
      minZoom: 6,
      maxZoom: 17,
      name: 'France (scan)',
      alt: 'France (scan)',
    });
  }

  protected init(map: google.maps.Map): void {
    super.init(map);
    this.registerMapType(TopoFrance.mapTypeIdScan, this.getScanMapType());
  }

  protected visibilityHandler(mapTypeId: string): void {
    if (this.copyrightEl) {
      if (mapTypeId === TopoFrance.mapTypeId) {
        this.layerName = 'GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2';
        this.copyrightEl.hidden = false;
      } else if (mapTypeId === TopoFrance.mapTypeIdScan) {
        this.layerName = 'GEOGRAPHICALGRIDSYSTEMS.MAPS';
        this.copyrightEl.hidden = false;
      } else {
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
    html: html` <img src="/static/img/topo.otm.png" /> `,
    url: 'https://opentopomap.org/about',
  };
  url = 'https://b.tile.opentopomap.org/{zoom}/{x}/{y}.png';
  zoom = [5, 17];
  bounds = null;
}
