import { LiveTrack } from 'flyxc/common/protos/live-track';
import { getFixMessage, isEmergencyFix } from 'flyxc/common/src/live-track';
import { customElement, internalProperty, LitElement, property, PropertyValues } from 'lit-element';
import { connect } from 'pwa-helpers';

import { popupContent } from '../../logic/live-track-popup';
import { Units } from '../../logic/units';
import { liveTrackSelectors } from '../../redux/live-track-slice';
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

// Only the last track uses a solid line.
// Former tracks use a dashed line.
const formerTrackIcons: google.maps.IconSequence[] = [
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
  @property()
  map: any;

  private get gMap(): google.maps.Map {
    return this.map;
  }

  @internalProperty()
  private displayNames = true;

  @internalProperty()
  private geojson: any;

  private units?: Units;
  private info?: google.maps.InfoWindow;
  // Id of the selected pilot.
  private currentId?: number;
  private features: google.maps.Data.Feature[] = [];

  connectedCallback(): void {
    super.connectedCallback();
    // At this point the api has been loaded.
    ANCHOR_POSITION = new google.maps.Point(4, 4);
    ANCHOR_ARROW = new google.maps.Point(9, 9);
    ORIGIN_ARROW = new google.maps.Point(9, 36);
    ANCHOR_MSG = new google.maps.Point(7, 9);
    ORIGIN_MSG = new google.maps.Point(0, 22);
    this.setMapStyle(this.gMap);
    this.setupInfoWindow(this.gMap);
    this.currentId = undefined;
  }

  shouldUpdate(changedProps: PropertyValues): boolean {
    if (changedProps.has('geojson')) {
      const features = this.features;
      this.features = this.gMap.data.addGeoJson(this.geojson) || [];
      features.forEach((f) => this.gMap.data.remove(f));
      changedProps.delete('geojson');
    }
    if (changedProps.has('displayNames')) {
      // The style depends on displayNames.
      this.setMapStyle(this.gMap);
    }
    return super.shouldUpdate(changedProps);
  }

  stateChanged(state: RootState): void {
    this.units = state.units;
    this.displayNames = state.app.displayLiveNames;
    this.geojson = state.liveTrack.geojson;
  }

  private setupInfoWindow(map: google.maps.Map): void {
    this.info = new google.maps.InfoWindow();
    this.info.close();
    this.info.addListener('closeclick', () => {
      this.currentId = undefined;
      this.setMapStyle(this.gMap);
    });

    map.data.addListener('click', (event) => {
      const feature: google.maps.Data.Feature | undefined = event.feature;
      if (feature?.getGeometry().getType() == 'Point' && this.units) {
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
          this.currentId = id;
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
            return this.getPointStyle(feature);
          case 'LineString':
            return this.getTrackStyle(feature);
          default:
            return {};
        }
      },
    );
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

    if (isActive) {
      opacity = 0.9;
      labelColor = 'darkred';
      zIndex = 20;
    }

    let label: google.maps.MarkerLabel | undefined;
    // Display an arrow when we have a bearing (most recent point).
    if (heading != null) {
      anchor = ANCHOR_ARROW;
      labelOrigin = ORIGIN_ARROW;
      svg = arrowSvg(heading, color, opacity);
      // Display the pilot name.
      if (this.displayNames && (isActive || ageMin < 12 * 60)) {
        const age = ageMin < 60 ? `${ageMin}min` : `${Math.floor(ageMin / 60)}h${String(ageMin % 60).padStart(2, '0')}`;
        label = {
          color: labelColor,
          text: track.name + '\n-' + age,
          className: 'gm-label-outline',
        } as any;
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
    const endIdx = feature.getProperty('endIndex');
    const ageMin = (nowSec - track.timeSec[endIdx]) / 60;

    const strokeColor = getUniqueColor(Math.round(id / 1000));
    let strokeWeight = 1;
    let strokeOpacity = 1;
    let zIndex = 10;
    let icons: google.maps.IconSequence[] | undefined;

    if (feature.getProperty('last') !== true) {
      icons = formerTrackIcons;
      strokeOpacity = 0;
    } else if (id == this.currentId) {
      strokeWeight = 4;
    } else if (ageMin < RECENT_TIMEOUT_MIN) {
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
