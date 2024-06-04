import type { PropertyValues } from 'lit';
import { LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { connect } from 'pwa-helpers';
import type { LiveLineProperties, LivePointProperties } from '../../logic/live-track';
import { FixType } from '../../logic/live-track';
import { popupContent } from '../../logic/live-track-popup';
import type { Units } from '../../logic/units';
import { formatDurationMin, formatUnit } from '../../logic/units';
import { setCurrentLiveId } from '../../redux/live-track-slice';
import * as sel from '../../redux/selectors';
import type { RootState } from '../../redux/store';
import { store } from '../../redux/store';
import { getUniqueContrastColor } from '../../styles/track';

// Anchors and label origins for markers.
let ANCHOR_POSITION: google.maps.Point | undefined;
let ANCHOR_ARROW: google.maps.Point | undefined;
let ORIGIN_ARROW: google.maps.Point | undefined;
let ANCHOR_UFO: google.maps.Point | undefined;
let ORIGIN_UFO: google.maps.Point | undefined;
let ANCHOR_MSG: google.maps.Point | undefined;
let ORIGIN_MSG: google.maps.Point | undefined;

// A track is considered recent if ended less than timeout ago.
const RECENT_TIMEOUT_MIN = 2 * 60;
// Old tracks.
const OLD_TIMEOUT_MIN = 12 * 60;

// Only the last track uses a solid line.
// Former tracks use a dashed line.
const dashedLineIconsFactory: (opacity: number) => google.maps.IconSequence[] = (opacity: number) => [
  {
    icon: {
      path: 'M 0,-1 0,1',
      strokeOpacity: opacity,
    },
    offset: '0',
    repeat: '5px',
  },
];

// Extract properties with the correct type.
function getPointProp<K extends keyof LivePointProperties>(feature: google.maps.Data.Feature, key: K) {
  return feature.getProperty(key) as LivePointProperties[K];
}

// Extract properties with the correct type.
function getLineProp<K extends keyof LiveLineProperties>(feature: google.maps.Data.Feature, key: K) {
  return feature.getProperty(key) as LiveLineProperties[K];
}

const positionSvg = (
  color: string,
  opacity: number,
): string => `<svg xmlns="http://www.w3.org/2000/svg" height="9" width="9">
<circle r="3" cx="4" cy="4" fill="${color}" stroke="black" stroke-width="1" opacity="${opacity}"/>
</svg>`;

const arrowSvg = (
  angle: number,
  color: string,
  opacity: number,
) => `<svg xmlns="http://www.w3.org/2000/svg" height="19" width="19">
<path d='M9 3 l-5 13 l5 -3 l5 3z' fill="${color}" stroke="black" stroke-width="1" transform="rotate(${angle}, 9, 9)"  opacity="${opacity}"/>
</svg>`;

const msgSvg = (
  color: string,
  opacity: number,
): string => `<svg xmlns="http://www.w3.org/2000/svg" height="16" width="16">
<path fill="${color}" stroke="black" stroke-width="1" opacity="${opacity}" d="M2.5 2C1.7 2 1 2.7 1 3.5 l 0 8 c0 .8.7 1.5 1.5 1.5 H4 l 0 2.4 L 7.7 13 l 4.8 0 c.8 0 1.5 -.7 1.5 -1.5 l 0 -8 c 0 -.8 -.7 -1.5 -1.5 -1.5 z"/>
</svg>`;

// https://www.svgrepo.com/svg/23593/old-plane
const ufoSvg = (
  angle: number,
  color: string,
  opacity: number,
): string => `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 183 183">
<path fill="${color}" stroke="black" stroke-width="1" opacity="${opacity}" transform="rotate(${angle}, 91, 91)" d="M170 58h-56V29c0-9-4-14-13-16-2-7-5-13-9-13-5 0-8 6-10 13-8 2-13 7-13 16v29H13c-4 0-8 4-8 8v14c0 4 3 8 7 9l19 4 10 1h31a314 314 0 0 1 3 33l6 21-20 5c-3 1-5 4-5 7v5c0 3 3 5 6 5h22c2 9 4 13 8 13 3 0 5-4 7-13h22c3 0 6-2 6-5v-5c0-3-2-6-5-7l-20-5 7-23 1-8 2-23h29l10-1 20-4c3-1 6-5 6-9V66c0-4-3-8-7-8z"/>
</svg>`;

@customElement('tracking-element')
export class TrackingElement extends connect(store)(LitElement) {
  @property({ attribute: false })
  map!: google.maps.Map;

  @state()
  private displayLabels = true;
  @state()
  private geojson: any;
  // Id of the selected pilot.
  @state()
  private currentId?: string;
  @state()
  private numTracks = 0;
  @state()
  plannerEnabled = false;

  private units?: Units;
  private info?: google.maps.InfoWindow;

  private features: google.maps.Data.Feature[] = [];
  private clearCurrentPilotListener?: google.maps.MapsEventListener;

  connectedCallback(): void {
    super.connectedCallback();
    // At this point the api has been loaded.
    ANCHOR_POSITION = new google.maps.Point(4, 4);
    ANCHOR_ARROW = new google.maps.Point(9, 9);
    ORIGIN_ARROW = new google.maps.Point(9, 36);
    ANCHOR_UFO = new google.maps.Point(8, 8);
    ORIGIN_UFO = new google.maps.Point(8, 36);
    ANCHOR_MSG = new google.maps.Point(7, 9);
    ORIGIN_MSG = new google.maps.Point(0, 35);
    this.setMapStyle(this.map);
    this.setupInfoWindow(this.map);
    this.clearCurrentPilotListener = this.map.addListener('click', () => {
      store.dispatch(setCurrentLiveId(undefined));
      this.info?.close();
    });
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.clearCurrentPilotListener?.remove();
    this.clearCurrentPilotListener = undefined;
  }

  shouldUpdate(changedProps: PropertyValues): boolean {
    if (changedProps.has('geojson')) {
      const features = this.features;
      this.features = this.map.data.addGeoJson(this.geojson) || [];
      features.forEach((f) => this.map.data.remove(f));
      changedProps.delete('geojson');
    }
    // Update the style when related props change.
    if (
      changedProps.has('displayLabels') ||
      changedProps.has('currentId') ||
      changedProps.has('numTracks') ||
      changedProps.has('plannerEnabled')
    ) {
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
    this.plannerEnabled = state.planner.enabled;
  }

  private setupInfoWindow(map: google.maps.Map): void {
    this.info = new google.maps.InfoWindow({ headerDisabled: false });
    this.info.close();
    this.info.addListener('closeclick', () => {
      store.dispatch(setCurrentLiveId(undefined));
      this.setMapStyle(this.map);
    });

    map.data.addListener('click', (event: any) => {
      const feature: google.maps.Data.Feature | undefined = event.feature;
      if (!feature) {
        return;
      }
      const type = feature.getGeometry()?.getType();
      if (type === 'LineString') {
        const pilotId = getLineProp(feature, 'id');
        this.info?.close();
        store.dispatch(setCurrentLiveId(pilotId));
        this.setMapStyle(this.map);
      } else if (type === 'Point' && this.units) {
        const pilotId = getPointProp(feature, 'pilotId');
        const index = getPointProp(feature, 'index');
        const popup = popupContent(pilotId, index, this.units);

        if (!popup) {
          return;
        }

        if (this.info) {
          this.info.setContent(popup.content);
          // TODO(vicb): Remove the cast when typings are updated
          (this.info as any).setHeaderContent(popup.title);
          this.info.setPosition(event.latLng);
          this.info.open(map);
          store.dispatch(setCurrentLiveId(pilotId));
          this.setMapStyle(this.map);
        }
      }
    });
  }

  private setMapStyle(map: google.maps.Map): void {
    map.data.setStyle((feature: google.maps.Data.Feature): google.maps.Data.StyleOptions => {
      switch (feature.getGeometry()?.getType()) {
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
    const pilotId = getPointProp(feature, 'pilotId');
    const alt = getPointProp(feature, 'alt');
    const gndAlt = getPointProp(feature, 'gndAlt');
    const ageMin = Math.round((nowSec - getPointProp(feature, 'timeSec')) / 60);
    const fixType = getPointProp(feature, 'fixType');
    const isActive = pilotId === this.currentId;

    const elevationStr = formatUnit(alt, this.units!.altitude);
    const title = gndAlt == null ? undefined : `${formatUnit(Math.max(0, alt - gndAlt), this.units!.altitude)} AGL`;

    let opacity = ageMin > RECENT_TIMEOUT_MIN ? 0.3 : 0.9;
    const color = getUniqueContrastColor(pilotId);
    let labelColor = 'black';
    let svg = positionSvg(color, opacity);
    let labelOrigin: google.maps.Point | undefined;
    let anchor = ANCHOR_POSITION;
    let zIndex = 10;
    let fontWeight: string | undefined;
    let label: google.maps.MarkerLabel | undefined;

    if (isActive) {
      opacity = 0.9;
      labelColor = '#BF1515';
      zIndex = 20;
      fontWeight = '500';
    }

    if (this.displayLabels && (isActive || ageMin < 6 * 60)) {
      label = {
        color: labelColor,
        text: `${getPointProp(feature, 'name')}\n${elevationStr} · -${formatDurationMin(ageMin)}`,
        className: 'gm-label-outline',
        fontWeight,
      };
    }

    switch (fixType) {
      case FixType.pilot:
        {
          const heading = getPointProp(feature, 'heading') ?? 0;
          if (getPointProp(feature, 'isUfo')) {
            anchor = ANCHOR_UFO;
            labelOrigin = ORIGIN_UFO;
            svg = ufoSvg(heading, color, opacity);
          } else {
            anchor = ANCHOR_ARROW;
            labelOrigin = ORIGIN_ARROW;
            svg = arrowSvg(heading, color, opacity);
          }
        }
        break;

      case FixType.message:
        anchor = ANCHOR_MSG;
        labelOrigin = ORIGIN_MSG;
        svg = msgSvg('yellow', opacity);
        zIndex = 50;
        break;

      case FixType.emergency:
        anchor = ANCHOR_MSG;
        labelOrigin = ORIGIN_MSG;
        svg = msgSvg('red', 1);
        zIndex = 60;
        break;

      default:
        label = undefined;
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
      title,
    };
  }

  private getTrackStyle(feature: google.maps.Data.Feature): google.maps.Data.StyleOptions {
    const nowSec = Date.now() / 1000;
    const id = getLineProp(feature, 'id');
    const isEmergency = getLineProp(feature, 'isEmergency');
    const ageMin = (nowSec - getLineProp(feature, 'lastTimeSec')) / 60;

    const strokeColor = getLineProp(feature, 'isUfo') ? '#aaa' : getUniqueContrastColor(id);
    let strokeWeight = 1;
    let strokeOpacity = 1;
    let zIndex = 10;
    let iconsFactory: ((opacity: number) => google.maps.IconSequence[]) | undefined;

    if (isEmergency) {
      strokeWeight = 6;
      zIndex = 30;
    } else if (!getLineProp(feature, 'last')) {
      // Dashed lines for previous tracks.
      iconsFactory = dashedLineIconsFactory;
    } else if (id == this.currentId) {
      // Make the selected track very visible.
      strokeWeight = 4;
      zIndex = 20;
    } else if (ageMin > OLD_TIMEOUT_MIN) {
      // Dashed lines for old tracks.
      iconsFactory = dashedLineIconsFactory;
    } else if (ageMin < RECENT_TIMEOUT_MIN && this.numTracks == 0 && !this.plannerEnabled) {
      // Make the recent tracks more visible when there are no non-live tracks.
      strokeWeight = 2;
      zIndex = 15;
    }

    // Fade the non selected tracks.
    // Helpful when there are many tracks (i.e. a comp).
    if (this.currentId != null && id != this.currentId) {
      strokeOpacity *= 0.5;
    }

    return {
      strokeColor,
      strokeOpacity: iconsFactory ? 0 : strokeOpacity,
      strokeWeight,
      zIndex,
      icons: iconsFactory ? iconsFactory(strokeOpacity) : undefined,
    };
  }
}
