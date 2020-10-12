import {
  CSSResult,
  customElement,
  html,
  internalProperty,
  LitElement,
  property,
  PropertyValues,
  TemplateResult,
} from 'lit-element';
import { connect } from 'pwa-helpers';

import { linearInterpolate } from '../../logic/math';
import { formatUnit, Units } from '../../logic/units';
import { setDisplayLiveNames } from '../../redux/app-slice';
import { RootState, store } from '../../redux/store';
import { controlStyle } from '../control-style';

// Anchors and label origins for markers.
let ANCHOR_POSITION: google.maps.Point | undefined;
let ANCHOR_ARROW: google.maps.Point | undefined;
let ORIGIN_ARROW: google.maps.Point | undefined;
let ANCHOR_MSG: google.maps.Point | undefined;
let ORIGIN_MSG: google.maps.Point | undefined;

const positionSvg = (color: string, opacity: number): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" height="9" width="9">` +
  `<circle r="3" cx="4" cy="4" style="fill:${color};stroke:black;stroke-width:1" opacity="${opacity}"/>` +
  `</svg>`;

const arrowSvg = (angle: number, color: string, opacity: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" height="19" width="19">` +
  `<path d='M9 3 l-5 13 l5 -3 l5 3z' style="fill:${color};stroke:black;stroke-width:1"` +
  ` transform="rotate(${angle}, 9, 9)"  opacity="${opacity}"/>` +
  `</svg>`;

const msgSvg = (color: string, opacity: number): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" height="16" width="16">` +
  `<path style="fill:${color};stroke:black;stroke-width:1" opacity="${opacity}"` +
  ` d="M2.5 2C1.7 2 1 2.7 1 3.5 l 0 8 c0 .8.7 1.5 1.5 1.5 H4 l 0 2.4 L 7.7 13 l 4.8 0 c.8 0 1.5 -.7 1.5 -1.5 l 0 -8 c 0 -.8 -.7 -1.5 -1.5 -1.5 z"/>` +
  `</svg>`;

@customElement('tracking-element')
export class TrackingElement extends connect(store)(LitElement) {
  // Actual type: google.maps.Map.
  @property()
  map: any;

  private get gMap(): google.maps.Map {
    return this.map;
  }

  @internalProperty()
  private isVisible = false;

  @internalProperty()
  private displayNames = true;

  private units?: Units;
  private info?: google.maps.InfoWindow;
  // Name of the pilot shown in the info window.
  private currentName?: string;
  private features: any[] = [];
  private fetchTimer?: number;

  connectedCallback(): void {
    super.connectedCallback();
    // At this point the api has been loaded.
    ANCHOR_POSITION = new google.maps.Point(4, 4);
    ANCHOR_ARROW = new google.maps.Point(9, 9);
    ORIGIN_ARROW = new google.maps.Point(9, 22);
    ANCHOR_MSG = new google.maps.Point(7, 9);
    ORIGIN_MSG = new google.maps.Point(0, 22);
    this.setMapStyle(this.gMap);
    this.setupInfoWindow(this.gMap);
  }

  shouldUpdate(changedProps: PropertyValues): boolean {
    if (changedProps.has('isVisible')) {
      if (this.isVisible) {
        if (this.fetchTimer == null) {
          this.fetchTrackers();
          this.fetchTimer = window.setInterval(() => this.fetchTrackers(), 2 * 60 * 1000);
        }
      } else {
        if (this.fetchTimer != null) {
          clearInterval(this.fetchTimer);
          this.fetchTimer = undefined;
        }
      }
      changedProps.delete('isVisible');
    }
    return super.shouldUpdate(changedProps);
  }

  stateChanged(state: RootState): void {
    this.units = state.units;
    this.displayNames = state.app.displayLiveNames;
    this.isVisible = state.browser.isVisible;
  }

  static get styles(): CSSResult {
    return controlStyle;
  }

  private fetchTrackers(): void {
    fetch('_trackers.geojson')
      .then((r) => (r.ok ? r.json() : null))
      .then((geoJson) => {
        if (geoJson != null) {
          const features = this.features;
          this.features = this.gMap.data.addGeoJson(geoJson) || [];
          features.forEach((f) => this.gMap.data.remove(f));
        }
      });
  }

  private setupInfoWindow(map: google.maps.Map): void {
    const hasPointFeature = (event: any): boolean => event.feature?.getGeometry().getType() == 'Point';
    this.info = new google.maps.InfoWindow();
    this.info.close();
    this.info.addListener('closeclick', () => {
      this.currentName = undefined;
      this.setMapStyle(this.gMap);
    });

    map.data.addListener('click', (event: any) => {
      if (hasPointFeature(event)) {
        const feat = event.feature as any;
        const latLng: google.maps.LatLng = feat.getGeometry().get();
        const date = new Date(feat.getProperty('ts'));
        const content: string[] = [
          `<strong>${feat.getProperty('name')}</strong>`,
          `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`,
          `${formatUnit(feat.getProperty('alt'), this.units?.altitude)} ${
            feat.getProperty('speed') != null ? formatUnit(feat.getProperty('speed'), this.units?.speed) : ''
          }`,
          `<a href=${`https://www.google.com/maps/dir//${latLng.lat()},${latLng.lng()}`} target="_blank">Directions</a>`,
        ];
        if (feat.getProperty('msg')) {
          content.push(feat.getProperty('msg'));
        }
        if (feat.getProperty('emergency')) {
          content.push('<strong>Emergency</strong>');
        }
        if (feat.getProperty('valid') === false) {
          content.push(
            '<strong>WARNING:',
            'The GPS fix is reported as invalid.',
            'The actual location might be different.</strong>',
          );
        }

        if (this.info) {
          this.info.setContent(content.join('<br>'));
          this.info.setPosition(event.latLng);
          this.info.open(map);
          this.currentName = feat.getProperty('name');
          this.setMapStyle(this.gMap);
        }
      }
    });
  }

  private setMapStyle(map: google.maps.Map): void {
    map.data.setStyle(
      (feature: google.maps.Data.Feature): google.maps.Data.StyleOptions => {
        switch (feature.getGeometry().getType()) {
          case 'Point':
            return this.getFixStyle(feature);
          case 'LineString':
            return this.getTrackStyle(feature);
          default:
            return {};
        }
      },
    );
  }

  // Using data-url with icon is much faster than using symbols.
  private getFixStyle(feature: google.maps.Data.Feature): google.maps.Data.StyleOptions {
    const now = Date.now();
    const ts = feature.getProperty('ts');
    const minutesOld = Math.round((now - ts) / (60 * 1000));
    const s = Math.max(0, Math.round(linearInterpolate(0, 100, 5 * 60, 0, minutesOld)));
    let color = `hsl(111, ${s}%, 53%)`;
    let opacity = minutesOld > 12 * 60 ? 0.3 : 0.9;
    let labelColor = 'black';
    let svg: string | undefined;
    let labelOrigin: google.maps.Point | undefined;
    let anchor: google.maps.Point | undefined;
    let zIndex = 10;

    if (feature.getProperty('name') === this.currentName) {
      opacity = 0.9;
      color = 'darkred';
      labelColor = 'darkred';
      zIndex = 50;
    }

    // Display an arrow when we have a bearing (most recent point).
    if (feature.getProperty('bearing') != null) {
      anchor = ANCHOR_ARROW;
      labelOrigin = ORIGIN_ARROW;
      svg = arrowSvg(Number(feature.getProperty('bearing')), color, opacity);
    }

    // Display speech bubble for messages and emergency.
    if (feature.getProperty('msg')) {
      anchor = ANCHOR_MSG;
      labelOrigin = ORIGIN_MSG;
      svg = msgSvg('yellow', opacity);
      zIndex = 20;
    }

    if (feature.getProperty('emergency')) {
      anchor = ANCHOR_MSG;
      labelOrigin = ORIGIN_MSG;
      svg = msgSvg('red', 1);
      zIndex = 30;
    }

    // Simple dots for every other positions.
    if (svg == null) {
      svg = positionSvg(color, opacity);
      anchor = ANCHOR_POSITION;
    }

    // Display the pilot name.
    let label: google.maps.MarkerLabel | undefined;
    if (feature.getProperty('is_last_fix') === true) {
      if (this.displayNames) {
        const age =
          minutesOld < 60
            ? `${minutesOld}min`
            : `${Math.floor(minutesOld / 60)}h${String(minutesOld % 60).padStart(2, '0')}`;
        label = {
          color: labelColor,
          text: feature.getProperty('name') + ' · ' + age,
          fontSize: '14.001px',
        };
      }
    }

    return {
      label,
      zIndex,
      cursor: 'zoom-in',
      icon: {
        url: `data:image/svg+xml,${svg}`,
        anchor,
        labelOrigin,
      },
    } as google.maps.Data.StyleOptions;
  }

  private getTrackStyle(feature: google.maps.Data.Feature): google.maps.Data.StyleOptions {
    const now = Date.now();
    const ts = feature.getProperty('first_ts');
    const minutesOld = Math.round((now - ts) / (60 * 1000));
    let opacity = minutesOld > 12 * 60 ? 0.3 : 0.9;
    let strokeColor = '#555';
    let strokeWeight = 1;

    if (feature.getProperty('name') && feature.getProperty('name') === this.currentName) {
      strokeWeight = 3;
      opacity = 0.9;
      strokeColor = '#c55';
    }

    return {
      strokeColor,
      strokeWeight,
      strokeOpacity: opacity,
      fillOpacity: opacity,
      zIndex: 10,
    };
  }

  protected render(): TemplateResult {
    return html`
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/line-awesome@1/dist/line-awesome/css/line-awesome.min.css"
      />
      <label
        ><input type="checkbox" ?checked=${this.displayNames} @change=${this.handleDisplayNames} /><i
          class="la la-user-tag la-2x"
        ></i
      ></label>
      <i
        class="la la-satellite-dish la-2x"
        style="cursor: pointer"
        @click=${(): void => void (document.location.href = '/devices.html')}
      ></i>
    `;
  }

  private handleDisplayNames(e: Event): void {
    store.dispatch(setDisplayLiveNames((e.target as HTMLInputElement).checked));
    // The style depends on displayNames.
    this.setMapStyle(this.gMap);
  }
}
