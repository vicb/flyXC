import { LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { connect } from 'pwa-helpers';

import VectorTileLayer from '@arcgis/core/layers/VectorTileLayer';
import type Map from '@arcgis/core/Map';

import type SceneView from '@arcgis/core/views/SceneView';
import type { LatLon } from '@flyxc/common';
import {
  ASP_COLOR_DANGER,
  ASP_COLOR_OTHER,
  ASP_COLOR_PROHIBITED,
  ASP_COLOR_RESTRICTED,
  Class,
  getAirspaceTilesUrlTemplate,
  MAX_AIRSPACE_TILE_ZOOM,
  Type,
} from '@flyxc/common';
import { getAirspaceList } from '../../logic/airspaces';
import type { RootState } from '../../redux/store';
import { store } from '../../redux/store';

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

  private layer?: VectorTileLayer;

  stateChanged(state: RootState): void {
    this.maxAltitude = state.airspace.maxAltitude;
    this.showAirspace = state.airspace.show;
    this.showClasses = state.airspace.showClasses;
    this.showTypes = state.airspace.showTypes;
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
    this.setupLayer();
  }

  public async handleClick(latLon: LatLon, view: SceneView) {
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
    );
    if (html) {
      view.popup.open({
        location: {
          latitude: latLon.lat,
          longitude: latLon.lon,
        } as any,
        title: 'Airspaces',
        content: `<div style="display: block;">${html}</div>`,
      });
    }
  }

  private removeLayer() {
    if (this.layer) {
      this.map.remove(this.layer);
      this.layer.destroy();
      this.layer == undefined;
    }
  }

  private setupLayer() {
    this.removeLayer();

    if (!this.showAirspace) {
      return;
    }

    const visibilityFilters: any[] = [];

    if (this.showTypes.indexOf(Type.Other) > -1) {
      // https://community.esri.com/t5/arcgis-javascript-maps-sdk-questions/bug-in-vectortilelayer-stlyling-mapbox-styles/m-p/1334083#M82365
      visibilityFilters.push(['boolean', true]);
    } else {
      for (const cl of this.showClasses) {
        visibilityFilters.push(['==', ['get', 'icaoClass'], cl]);
      }
      for (const type of this.showTypes) {
        visibilityFilters.push(['==', ['get', 'type'], type]);
      }
      if (this.showTypes.indexOf(Type.Restricted) > -1) {
        visibilityFilters.push(['==', ['get', 'type'], Type.LowAltitudeOverflightRestriction]);
      }
    }

    this.layer = new VectorTileLayer({
      style: {
        version: 8,
        sources: {
          asp: {
            type: 'vector',
            tiles: [getAirspaceTilesUrlTemplate(import.meta.env.VITE_AIRSPACE_SERVER)],
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
                'case',
                // Class
                ['==', ['get', 'icaoClass'], Class.A],
                ASP_COLOR_PROHIBITED,
                ['==', ['get', 'icaoClass'], Class.B],
                ASP_COLOR_PROHIBITED,
                ['==', ['get', 'icaoClass'], Class.C],
                ASP_COLOR_PROHIBITED,
                ['==', ['get', 'icaoClass'], Class.D],
                ASP_COLOR_PROHIBITED,
                ['==', ['get', 'icaoClass'], Class.E],
                ASP_COLOR_RESTRICTED,
                ['==', ['get', 'icaoClass'], Class.F],
                ASP_COLOR_RESTRICTED,
                ['==', ['get', 'icaoClass'], Class.G],
                ASP_COLOR_RESTRICTED,
                // Type
                ['==', ['get', 'type'], Type.CTR],
                ASP_COLOR_PROHIBITED,
                ['==', ['get', 'type'], Type.TMA],
                ASP_COLOR_PROHIBITED,
                ['==', ['get', 'type'], Type.ATZ],
                ASP_COLOR_PROHIBITED,
                ['==', ['get', 'type'], Type.CTA],
                ASP_COLOR_PROHIBITED,
                ['==', ['get', 'type'], Type.Prohibited],
                ASP_COLOR_PROHIBITED,
                ['==', ['get', 'type'], Type.RMZ],
                ASP_COLOR_PROHIBITED,
                ['==', ['get', 'type'], Type.TMZ],
                ASP_COLOR_RESTRICTED,
                ['==', ['get', 'type'], Type.GlidingSector],
                ASP_COLOR_RESTRICTED,
                ['==', ['get', 'type'], Type.Restricted],
                ASP_COLOR_RESTRICTED,
                ['==', ['get', 'type'], Type.LowAltitudeOverflightRestriction],
                ASP_COLOR_RESTRICTED,
                ['==', ['get', 'type'], Type.Danger],
                ASP_COLOR_DANGER,
                // Unmatched airspaces.
                ASP_COLOR_OTHER,
              ],
              'fill-opacity': 0.7,
              'fill-outline-color': '#aaaaaa',
            },
            filter: ['all', ['any', ...visibilityFilters], ['<=', ['get', 'floorM'], this.maxAltitude]],
          },
        ],
      },
    });
    this.map.add(this.layer);
  }

  createRenderRoot(): HTMLElement {
    return this;
  }
}
