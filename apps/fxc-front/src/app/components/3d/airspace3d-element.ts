import Point from '@arcgis/core/geometry/Point';
import VectorTileLayer from '@arcgis/core/layers/VectorTileLayer';
import type Map from '@arcgis/core/Map';
import type { ArcgisScene } from '@arcgis/map-components/components/arcgis-scene';
import type { AirspaceServer, LatLon, RuntimeTrack } from '@flyxc/common';
import {
  ASP_COLOR_DANGER,
  ASP_COLOR_OTHER,
  ASP_COLOR_PROHIBITED,
  ASP_COLOR_RESTRICTED,
  Class,
  getAirspaceOverrides,
  getAirspaceTilesUrlTemplate,
  MAX_AIRSPACE_TILE_ZOOM,
  Type,
} from '@flyxc/common';
import { LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { connect } from 'pwa-helpers';

import { getAirspaceList } from '../../logic/airspaces';
import * as airspaces from '../../redux/airspace-slice';
import * as app from '../../redux/app-slice';
import type { RootState } from '../../redux/store';
import { store } from '../../redux/store';
import { selectCurrentTrack } from '../../redux/track-slice';
import { createPopupContent } from './popup-content';

@customElement('airspace3d-element')
export class Airspace3dElement extends connect(store)(LitElement) {
  @property({ attribute: false })
  map!: Map;

  @state()
  private maxAltitude = 1000;
  @state()
  private showAirspace = false;
  @state()
  private showClasses: Class[] = [];
  @state()
  private showTypes: Type[] = [];
  @state()
  private opacity = 70;
  @state()
  private track?: RuntimeTrack;

  private layer?: VectorTileLayer;

  stateChanged(state: RootState): void {
    this.maxAltitude = airspaces.selectMaxAltitude(state);
    this.showAirspace = airspaces.selectShowAirspaces(state);
    this.showClasses = airspaces.selectShowClasses(state);
    this.showTypes = airspaces.selectShowTypes(state);
    this.opacity = airspaces.selectOpacity(state);
    this.track = selectCurrentTrack(state);
  }

  private getEffectiveDate(): Date {
    return this.track ? new Date(app.selectTimeSec(store.getState()) * 1000) : new Date();
  }

  protected shouldUpdate(): boolean {
    this.setupLayer();
    return false;
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeLayer();
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.requestUpdate();
  }

  public async handleClick(latLon: LatLon, scene: ArcgisScene) {
    if (!this.showAirspace) {
      return;
    }
    const html = await getAirspaceList(
      MAX_AIRSPACE_TILE_ZOOM,
      latLon,
      this.maxAltitude,
      0,
      this.showClasses,
      this.showTypes,
      this.getEffectiveDate(),
    );
    if (html) {
      await scene.openPopup({
        location: new Point({
          latitude: latLon.lat,
          longitude: latLon.lon,
        }),
        title: 'Airspaces',
        content: createPopupContent(html),
      });
    }
  }

  private removeLayer() {
    if (this.layer) {
      this.map?.remove(this.layer);
      this.layer.destroy();
      this.layer = undefined;
    }
  }

  private setupLayer() {
    this.removeLayer();

    if (!this.map || !this.showAirspace) {
      return;
    }

    this.layer = new VectorTileLayer({
      style: buildAirspaceVectorTileStyle({
        maxAltitude: this.maxAltitude,
        showClasses: this.showClasses,
        showTypes: this.showTypes,
        opacity: this.opacity,
        date: this.getEffectiveDate(),
        tileServer: import.meta.env.VITE_AIRSPACE_SERVER,
      }),
    });
    this.map.add(this.layer);
  }

  createRenderRoot(): HTMLElement {
    return this;
  }
}

/**
 * Builds the Mapbox v8 style specification for the 3D airspace VectorTileLayer.
 *
 * Bakes date-specific `icaoClass` and `type` overrides (by airspace `name`) into
 * Mapbox `match` expressions so that visibility filtering (alongside `floorM < maxAltitude`)
 * and fill colors reflect the active date.
 */
export function buildAirspaceVectorTileStyle({
  maxAltitude,
  showClasses,
  showTypes,
  opacity,
  date,
  tileServer,
}: {
  maxAltitude: number;
  showClasses: Class[];
  showTypes: Type[];
  opacity: number;
  date: Date;
  tileServer: AirspaceServer;
}) {
  const overrides = [...getAirspaceOverrides(date)];
  const classOverrides = overrides.flatMap(([name, o]) => (o.icaoClass !== undefined ? [name, o.icaoClass] : []));
  const icaoClassExpr: any =
    classOverrides.length > 0
      ? ['match', ['get', 'name'], ...classOverrides, ['get', 'icaoClass']]
      : ['get', 'icaoClass'];
  const typeOverrides = overrides.flatMap(([name, o]) => (o.type !== undefined ? [name, o.type] : []));
  const typeExpr: any =
    typeOverrides.length > 0 ? ['match', ['get', 'name'], ...typeOverrides, ['get', 'type']] : ['get', 'type'];

  const visibilityFilters: any[] = [];
  if (showTypes.includes(Type.Other)) {
    // https://community.esri.com/t5/arcgis-javascript-maps-sdk-questions/bug-in-vectortilelayer-stlyling-mapbox-styles/m-p/1334083#M82365
    visibilityFilters.push(['boolean', true]);
  } else {
    for (const cl of showClasses) {
      visibilityFilters.push(['==', icaoClassExpr, cl]);
    }
    for (const type of showTypes) {
      visibilityFilters.push(['==', typeExpr, type]);
    }
    if (showTypes.includes(Type.Restricted)) {
      visibilityFilters.push(['==', typeExpr, Type.LowAltitudeOverflightRestriction]);
    }
  }

  return {
    version: 8,
    sources: {
      asp: {
        type: 'vector',
        tiles: [getAirspaceTilesUrlTemplate(tileServer)],
        minzoom: 0,
        maxzoom: MAX_AIRSPACE_TILE_ZOOM,
      },
    },
    layers: [
      {
        id: 'asp',
        source: 'asp',
        'source-layer': 'asp',
        type: 'fill',
        paint: {
          'fill-color': [
            'match',
            icaoClassExpr,
            [Class.A, Class.B, Class.C, Class.D],
            ASP_COLOR_PROHIBITED,
            [Class.E, Class.F, Class.G],
            ASP_COLOR_RESTRICTED,
            [
              'match',
              typeExpr,
              [Type.CTR, Type.TMA, Type.ATZ, Type.CTA, Type.Prohibited, Type.RMZ],
              ASP_COLOR_PROHIBITED,
              [Type.TMZ, Type.GlidingSector, Type.Restricted, Type.LowAltitudeOverflightRestriction],
              ASP_COLOR_RESTRICTED,
              Type.Danger,
              ASP_COLOR_DANGER,
              ASP_COLOR_OTHER,
            ],
          ],
          'fill-opacity': opacity / 100,
          'fill-outline-color': '#aaaaaa',
        },
        filter: ['all', ['any', ...visibilityFilters], ['<=', ['get', 'floorM'], maxAltitude]],
      },
    ],
  };
}
