import { LitElement } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { connect } from 'pwa-helpers';

import VectorTileLayer from '@arcgis/core/layers/VectorTileLayer';
import Map from '@arcgis/core/Map';

import { RootState, store } from '../../redux/store';
import {
  ASP_COLOR_DANGER,
  ASP_COLOR_OTHER,
  ASP_COLOR_PROHIBITED,
  ASP_COLOR_RESTRICTED,
  ASP_TILE_URL,
  Flags,
} from 'flyxc/common/src/airspaces';
import { getAirspaceList, MAX_ASP_TILE_ZOOM } from '../../logic/airspaces';
import { LatLon } from 'flyxc/common/src/runtime-track';
import SceneView from '@arcgis/core/views/SceneView';

@customElement('airspace3d-element')
export class Airspace3dElement extends connect(store)(LitElement) {
  @property({ attribute: false })
  map!: Map;

  @state()
  private maxAltitude = 1000;
  @state()
  private showAirspace = false;
  @state()
  private showRestricted = true;

  private layer?: VectorTileLayer;

  stateChanged(state: RootState): void {
    this.maxAltitude = state.airspace.maxAltitude;
    this.showAirspace = state.airspace.show;
    this.showRestricted = state.airspace.showRestricted;
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
    const html = await getAirspaceList(MAX_ASP_TILE_ZOOM, latLon, this.maxAltitude, this.showRestricted);
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

    this.layer = new VectorTileLayer({
      style: {
        version: 8,
        sources: {
          asp: {
            type: 'vector',
            tiles: [ASP_TILE_URL],
            minzoom: 0,
            maxzoom: MAX_ASP_TILE_ZOOM,
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
                ['>=', ['%', ['get', 'flags'], Flags.AirspaceProhibited * 2], Flags.AirspaceProhibited],
                ASP_COLOR_PROHIBITED,
                ['>=', ['%', ['get', 'flags'], Flags.AirspaceRestricted * 2], Flags.AirspaceRestricted],
                ASP_COLOR_RESTRICTED,
                ['>=', ['%', ['get', 'flags'], Flags.AirspaceDanger * 2], Flags.AirspaceDanger],
                ASP_COLOR_DANGER,
                ASP_COLOR_OTHER,
              ],
              'fill-opacity': 0.7,
              'fill-outline-color': '#aaaaaa',
            },
            filter: this.showRestricted
              ? ['<=', ['get', 'bottom'], this.maxAltitude]
              : [
                  'all',
                  ['<', ['%', ['get', 'flags'], Flags.AirspaceRestricted * 2], Flags.AirspaceRestricted],
                  ['<=', ['get', 'bottom'], this.maxAltitude],
                ],
          },
        ],
      },
    });
    this.map.add(this.layer);
  }

  createRenderRoot(): Element {
    return this;
  }
}
