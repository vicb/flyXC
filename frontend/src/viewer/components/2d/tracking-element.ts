import { LiveTrack } from 'flyxc/common/protos/live-track';
import { getFixMessage, isEmergencyFix, isEmergencyTrack } from 'flyxc/common/src/live-track';
import { customElement, LitElement, property, PropertyValues, state } from 'lit-element';
import { connect } from 'pwa-helpers';

import { popupContent } from '../../logic/live-track-popup';
import { formatDurationMin, Units } from '../../logic/units';
import { liveTrackSelectors, setCurrentLiveId } from '../../redux/live-track-slice';
import * as sel from '../../redux/selectors';
import { RootState, store } from '../../redux/store';
import { getUniqueColor } from '../../styles/track';

// Anchors and label origins for markers.
let ANCHOR_POSITION: google.maps.Point | undefined;
let ANCHOR_ARROW: google.maps.Point | undefined;
let ORIGIN_ARROW: google.maps.Point | undefined;
let ANCHOR_MSG: google.maps.Point | undefined;
let ORIGIN_MSG: google.maps.Point | undefined;

// A track is considered recent if ended less than timeout ago.
const RECENT_TIMEOUT_MIN = 2 * 60;
// Old tracks.
const OLD_TIMEOUT_MIN = 12 * 60;

// Only the last track uses a solid line.
// Former tracks use a dashed line.
const dashedLineIcons: google.maps.IconSequence[] = [
  {
    icon: {
      path: 'M 0,-1 0,1',
      strokeOpacity: 1,
    },
    offset: '0',
    repeat: '5px',
  },
];

const positionSvg = (color: string, opacity: number): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" height="9" width="9">` +
  `<circle r="3" cx="4" cy="4" fill="${color}" stroke="black" stroke-width="1" opacity="${opacity}"/>` +
  `</svg>`;

const arrowSvg = (angle: number, color: string, opacity: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" height="19" width="19">` +
  `<path d='M9 3 l-5 13 l5 -3 l5 3z' fill="${color}" stroke="black" stroke-width="1"` +
  ` transform="rotate(${angle}, 9, 9)"  opacity="${opacity}"/>` +
  `</svg>`;

const msgSvg = (color: string, opacity: number): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" height="16" width="16">` +
  `<path fill="${color}" stroke="black" stroke-width="1" opacity="${opacity}"` +
  ` d="M2.5 2C1.7 2 1 2.7 1 3.5 l 0 8 c0 .8.7 1.5 1.5 1.5 H4 l 0 2.4 L 7.7 13 l 4.8 0 c.8 0 1.5 -.7 1.5 -1.5 l 0 -8 c 0 -.8 -.7 -1.5 -1.5 -1.5 z"/>` +
  `</svg>`;

@customElement('tracking-element')
export class TrackingElement extends connect(store)(LitElement) {
  // Actual type: google.maps.Map.
  @property({ attribute: false })
  map!: google.maps.Map;

  @state()
  private displayLabels = true;
  @state()
  private geojson: any;
  // Id of the selected pilot.
  @state()
  private currentId?: number;
  @state()
  private numTracks = 0;

  private units?: Units;
  private info?: google.maps.InfoWindow;

  private features: google.maps.Data.Feature[] = [];

  connectedCallback(): void {
    super.connectedCallback();
    // At this point the api has been loaded.
    ANCHOR_POSITION = new google.maps.Point(4, 4);
    ANCHOR_ARROW = new google.maps.Point(9, 9);
    ORIGIN_ARROW = new google.maps.Point(9, 36);
    ANCHOR_MSG = new google.maps.Point(7, 9);
    ORIGIN_MSG = new google.maps.Point(0, 22);
    this.setMapStyle(this.map);
    this.setupInfoWindow(this.map);
  }

  shouldUpdate(changedProps: PropertyValues): boolean {
    if (changedProps.has('geojson')) {
      const features = this.features;
      this.features = this.map.data.addGeoJson(this.geojson) || [];
      features.forEach((f) => this.map.data.remove(f));
      changedProps.delete('geojson');
    }
    // Update the style when related props change.
    if (changedProps.has('displayLabels') || changedProps.has('currentId') || changedProps.has('numTracks')) {
      this.setMapStyle(this.map);
    }
    return super.shouldUpdate(changedProps);
  }

  stateChanged(state: RootState): void {
    this.units = state.units;
    this.displayLabels = state.liveTrack.displayLabels;
    this.geojson = state.liveTrack.geojson;
    this.currentId = state.liveTrack.currentLiveId;
    this.numTracks = sel.numTracks(state);
  }

  private setupInfoWindow(map: google.maps.Map): void {
    this.info = new google.maps.InfoWindow();
    this.info.close();
    this.info.addListener('closeclick', () => {
      store.dispatch(setCurrentLiveId(undefined));
      this.setMapStyle(this.map);
    });

    map.data.addListener('click', (event) => {
      const feature: google.maps.Data.Feature | undefined = event.feature;
      if (!feature) {
        return;
      }
      const type = feature.getGeometry().getType();
      if (type === 'LineString') {
        const id = Number(feature.getProperty('id') ?? 0);
        store.dispatch(setCurrentLiveId(id));
        this.setMapStyle(this.map);
      } else if (type === 'Point' && this.units) {
        const id = Number(feature.getProperty('id') ?? 0);
        const index = Number(feature.getProperty('index') ?? 0);
        const popup = popupContent(id, index, this.units);

        if (!popup) {
          return;
        }

        if (this.info) {
          this.info.setContent(`<strong>${popup.title}</strong><br>${popup.content}`);
          this.info.setPosition(event.latLng);
          this.info.open(map);
          store.dispatch(setCurrentLiveId(id));
          this.setMapStyle(this.map);
        }
      }
    });
  }

  private setMapStyle(map: google.maps.Map): void {
    map.data.setStyle((feature: google.maps.Data.Feature): google.maps.Data.StyleOptions => {
      switch (feature.getGeometry().getType()) {
        case 'Point':
          return this.getPointStyle(feature);
        case 'LineString':
          return this.getTrackStyle(feature);
        default:
          return {};
      }
    });
  }

  // Using data-url with icon is much faster than using symbols.
  private getPointStyle(feature: google.maps.Data.Feature): google.maps.Data.StyleOptions {
    const nowSec = Date.now() / 1000;
    const id = Number(feature.getProperty('id') ?? 0);
    const track = liveTrackSelectors.selectById(store.getState(), id) as LiveTrack;
    const index = feature.getProperty('index') ?? 0;
    const message = getFixMessage(track, index);
    const isEmergency = isEmergencyFix(track.flags[index]);
    const heading = feature.getProperty('heading');
    const isActive = id === this.currentId;

    const ageMin = Math.round((nowSec - track.timeSec[index]) / 60);

    let opacity = ageMin > RECENT_TIMEOUT_MIN ? 0.3 : 0.9;
    const color = getUniqueColor(Math.round(id / 1000));
    let labelColor = 'black';
    let svg: string | undefined;
    let labelOrigin: google.maps.Point | undefined;
    let anchor: google.maps.Point | undefined;
    let zIndex = 10;
    let fontWeight: string | undefined;

    if (isActive) {
      opacity = 0.9;
      labelColor = '#BF1515';
      zIndex = 20;
      fontWeight = '500';
    }

    let label: google.maps.MarkerLabel | undefined;
    // Display an arrow when we have a bearing (most recent point).
    if (heading != null) {
      anchor = ANCHOR_ARROW;
      labelOrigin = ORIGIN_ARROW;
      svg = arrowSvg(heading, color, opacity);
      // Display the pilot name.
      if (this.displayLabels && (isActive || ageMin < 12 * 60)) {
        label = {
          color: labelColor,
          text: track.name + '\n-' + formatDurationMin(ageMin),
          className: 'gm-label-outline',
          fontWeight,
        };
      }
    }

    // Display speech bubble for messages and emergency.
    if (message) {
      anchor = ANCHOR_MSG;
      labelOrigin = ORIGIN_MSG;
      svg = msgSvg('yellow', opacity);
      zIndex = 50;
    }

    if (isEmergency) {
      anchor = ANCHOR_MSG;
      labelOrigin = ORIGIN_MSG;
      svg = msgSvg('red', 1);
      zIndex = 60;
    }

    // Simple dots for every other positions.
    if (svg == null) {
      svg = positionSvg(color, opacity);
      anchor = ANCHOR_POSITION;
    }

    return {
      label,
      zIndex,
      cursor: 'zoom-in',
      icon: {
        url: `data:image/svg+xml;base64,${btoa(svg)}`,
        anchor,
        labelOrigin,
      },
    } as google.maps.Data.StyleOptions;
  }

  private getTrackStyle(feature: google.maps.Data.Feature): google.maps.Data.StyleOptions {
    const nowSec = Date.now() / 1000;
    const id = feature.getProperty('id') as number;
    const track = liveTrackSelectors.selectById(store.getState(), id) as LiveTrack;
    const isEmergency = isEmergencyTrack(track);
    const endIdx = feature.getProperty('endIndex');
    const ageMin = (nowSec - track.timeSec[endIdx]) / 60;

    const strokeColor = getUniqueColor(Math.round(id / 1000));
    let strokeWeight = 1;
    let strokeOpacity = 1;
    let zIndex = 10;
    let icons: google.maps.IconSequence[] | undefined;

    if (isEmergency) {
      strokeWeight = 6;
      zIndex = 30;
    } else if (feature.getProperty('last') !== true) {
      // Dashed lines for previous tracks.
      icons = dashedLineIcons;
      strokeOpacity = 0;
    } else if (id == this.currentId) {
      // Make the selected track very visible.
      strokeWeight = 4;
      zIndex = 20;
    } else if (ageMin > OLD_TIMEOUT_MIN) {
      // Dashed lines for old tracks.
      icons = dashedLineIcons;
      strokeOpacity = 0;
    } else if (ageMin < RECENT_TIMEOUT_MIN && this.numTracks == 0) {
      // Make the recent tracks more visible when there are no non-live tracks.
      strokeWeight = 2;
      zIndex = 15;
    }

    return {
      strokeColor,
      strokeOpacity,
      strokeWeight,
      zIndex,
      icons,
    } as google.maps.Data.StyleOptions;
  }
}
