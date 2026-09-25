import type { protos } from '@flyxc/common';
import type { PropertyValues } from 'lit';
import { LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { connect } from 'pwa-helpers';

import type { LiveLineProperties, LivePointProperties } from '../../logic/live-track';
import { FixType } from '../../logic/live-track';
import { popupContent } from '../../logic/live-track-popup';
import type { Units } from '../../logic/units';
import { formatDurationMin, formatUnit } from '../../logic/units';
import * as app from '../../redux/app-slice';
import * as liveTrack from '../../redux/live-track-slice';
import * as planner from '../../redux/planner-slice';
import { selectTrackGndAlt, selectTrackLatLonAlt } from '../../redux/selectors/position';
import type { RootState } from '../../redux/store';
import { store } from '../../redux/store';
import { selectTrackTotal } from '../../redux/track-slice';
import * as unitsSlice from '../../redux/units-slice';
import { getUniqueContrastColor } from '../../styles/track';

// Anchors and label origins for markers.
let ANCHOR_POSITION_DOT: google.maps.Point | undefined;
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

/**
 * Extracts a typed property value from a GeoJSON Point feature.
 *
 * @param feature - The Google Maps Data feature.
 * @param key - The property key to retrieve.
 * @returns The typed property value.
 */
function getPointProp<K extends keyof LivePointProperties>(feature: google.maps.Data.Feature, key: K) {
  return feature.getProperty(key) as LivePointProperties[K];
}

/**
 * Extracts a typed property value from a GeoJSON LineString feature.
 *
 * @param feature - The Google Maps Data feature.
 * @param key - The property key to retrieve.
 * @returns The typed property value.
 */
function getLineProp<K extends keyof LiveLineProperties>(feature: google.maps.Data.Feature, key: K) {
  return feature.getProperty(key) as LiveLineProperties[K];
}

/**
 * Generates an SVG string for the current position marker dot on a live track.
 *
 * @param color - Fill color for the circle.
 * @param opacity - Opacity of the circle.
 * @returns An SVG markup string.
 */
const positionSvg = (color: string, opacity: number): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" height="19" width="19">
<circle r="6" cx="9" cy="9" fill="${color}" stroke="black" stroke-width="1.5" opacity="${opacity}"/>
</svg>`;

/**
 * Generates an SVG string for a directional arrow pilot icon.
 *
 * @param angle - Orientation angle in degrees.
 * @param color - Fill color for the arrow.
 * @param opacity - Opacity of the arrow.
 * @returns An SVG markup string.
 */
const arrowSvg = (
  angle: number,
  color: string,
  opacity: number,
): string => `<svg xmlns="http://www.w3.org/2000/svg" height="19" width="19">
<path d='M9 3 l-5 13 l5 -3 l5 3z' fill="${color}" stroke="black" stroke-width="1" transform="rotate(${angle}, 9, 9)"  opacity="${opacity}"/>
</svg>`;

/**
 * Generates an SVG string for a message fix icon.
 *
 * @param color - Fill color for the message icon.
 * @param opacity - Opacity of the message icon.
 * @returns An SVG markup string.
 */
const msgSvg = (
  color: string,
  opacity: number,
): string => `<svg xmlns="http://www.w3.org/2000/svg" height="16" width="16">
<path fill="${color}" stroke="black" stroke-width="1" opacity="${opacity}" d="M2.5 2C1.7 2 1 2.7 1 3.5 l 0 8 c0 .8.7 1.5 1.5 1.5 H4 l 0 2.4 L 7.7 13 l 4.8 0 c.8 0 1.5 -.7 1.5 -1.5 l 0 -8 c 0 -.8 -.7 -1.5 -1.5 -1.5 z"/>
</svg>`;

/**
 * Generates an SVG string for an unidentified flying object (UFO) icon.
 *
 * @param angle - Heading angle in degrees.
 * @param color - Fill color.
 * @param opacity - Opacity.
 * @returns An SVG markup string.
 */
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
  @state()
  private timeSec = 0;
  @state()
  private units?: Units;
  @state()
  private liveTrack?: protos.LiveTrack;

  private info?: google.maps.InfoWindow;

  private features: google.maps.Data.Feature[] = [];
  private clearCurrentPilotListener?: google.maps.MapsEventListener;
  private positionMarker?: google.maps.Marker;

  /**
   * Initializes the element, configures icon anchors, and sets up map event listeners.
   */
  connectedCallback(): void {
    super.connectedCallback();
    // At this point the api has been loaded.
    ANCHOR_POSITION_DOT = new google.maps.Point(9, 9);
    ANCHOR_ARROW = new google.maps.Point(9, 9);
    ORIGIN_ARROW = new google.maps.Point(9, 36);
    ANCHOR_UFO = new google.maps.Point(8, 8);
    ORIGIN_UFO = new google.maps.Point(8, 36);
    ANCHOR_MSG = new google.maps.Point(7, 9);
    ORIGIN_MSG = new google.maps.Point(0, 35);
    this.setMapStyle(this.map);
    this.setupInfoWindow(this.map);
    this.clearCurrentPilotListener = this.map.addListener('click', () => {
      store.dispatch(liveTrack.setCurrentLiveId(undefined));
      this.info?.close();
    });
    this.updateMovingDot(true);
  }

  /**
   * Cleans up map event listeners and removes the position marker.
   */
  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.clearCurrentPilotListener?.remove();
    this.clearCurrentPilotListener = undefined;
    this.positionMarker?.setMap(null);
    this.positionMarker = undefined;
  }

  /**
   * Updates map GeoJSON features, styles, and moving dot marker when relevant properties change.
   *
   * @param changedProps - Map of changed properties with their previous values.
   * @returns True if Lit should render an update.
   */
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
      changedProps.has('plannerEnabled') ||
      changedProps.has('units')
    ) {
      this.setMapStyle(this.map);
    }
    // Refresh moving marker dot when timestamp, pilot selection, track data, or units change.
    if (
      changedProps.has('timeSec') ||
      changedProps.has('currentId') ||
      changedProps.has('liveTrack') ||
      changedProps.has('units')
    ) {
      this.updateMovingDot(changedProps.has('currentId'));
    }
    // Note: `LitElement#shouldUpdate()` is always true
    return changedProps.size === 0 ? false : super.shouldUpdate(changedProps);
  }

  /**
   * Handles Redux store state updates for live tracking.
   *
   * @param state - The updated root Redux state.
   */
  stateChanged(state: RootState): void {
    this.units = unitsSlice.selectUnits(state);
    this.displayLabels = liveTrack.selectDisplayLabels(state);
    this.geojson = liveTrack.selectGeojson(state);
    this.currentId = liveTrack.selectCurrentLiveId(state);
    this.numTracks = selectTrackTotal(state);
    this.plannerEnabled = planner.selectEnabled(state);
    this.timeSec = app.selectTimeSec(state);
    this.liveTrack = liveTrack.selectActiveLiveTrack(state);
  }

  /**
   * Updates or hides the moving dot marker for the active live track on the map.
   *
   * The dot is displayed only when a live track is selected and the current timestamp
   * is within the active (last) segment's time span.
   *
   * @param hasCurrentIdChanged - Whether the selected pilot ID has changed.
   */
  private updateMovingDot(hasCurrentIdChanged = false): void {
    if (!this.map || !this.currentId) {
      this.positionMarker?.setMap(null);
      return;
    }

    // Only display the moving dot on the active (last) segment of the track.
    const liveTrackData = this.liveTrack ?? liveTrack.selectActiveLiveTrack(store.getState());
    if (
      !liveTrackData ||
      liveTrackData.timeSec.length === 0 ||
      this.timeSec < liveTrackData.timeSec[0] ||
      this.timeSec > liveTrackData.timeSec[liveTrackData.timeSec.length - 1]
    ) {
      this.positionMarker?.setMap(null);
      return;
    }

    const pos = selectTrackLatLonAlt(store.getState())(this.timeSec);
    if (!pos) {
      this.positionMarker?.setMap(null);
      return;
    }

    const color = getUniqueContrastColor(this.currentId);
    if (!this.positionMarker) {
      this.positionMarker = new google.maps.Marker({
        map: this.map,
        zIndex: 10,
        cursor: 'default',
        icon: {
          url: `data:image/svg+xml;base64,${btoa(positionSvg(color, 1))}`,
          anchor: ANCHOR_POSITION_DOT,
        },
      });
    } else if (hasCurrentIdChanged) {
      this.positionMarker.setIcon({
        url: `data:image/svg+xml;base64,${btoa(positionSvg(color, 1))}`,
        anchor: ANCHOR_POSITION_DOT,
      });
    }

    this.positionMarker.setPosition({ lat: pos.lat, lng: pos.lon });
    if (this.units && pos.alt != null) {
      const gndAlt = selectTrackGndAlt(store.getState())(this.timeSec);
      const altStr = formatUnit(pos.alt, this.units.altitude);
      const aglStr = gndAlt != null ? ` (${formatUnit(Math.max(0, pos.alt - gndAlt), this.units.altitude)} AGL)` : '';
      this.positionMarker.setTitle(`${altStr}${aglStr}`);
    }
    this.positionMarker.setMap(this.map);
  }

  /**
   * Sets up the info window and click listener for map data features (pilot icons, messages, tracks).
   *
   * @param map - The Google Maps map instance.
   */
  private setupInfoWindow(map: google.maps.Map): void {
    this.info = new google.maps.InfoWindow({ headerDisabled: false });
    this.info.close();
    this.info.addListener('closeclick', () => {
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
        store.dispatch(liveTrack.setCurrentLiveId(pilotId));
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
          this.info.setHeaderContent(popup.title);
          this.info.setPosition(event.latLng);
          this.info.open(map);
          store.dispatch(liveTrack.setCurrentLiveId(pilotId));
          this.setMapStyle(this.map);
        }
      }
    });
  }

  /**
   * Sets the style function on the map's Data layer.
   *
   * @param map - The Google Maps map instance.
   */
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

  /**
   * Computes the style options for a Point feature (pilot marker, message, emergency).
   *
   * Using data-URL with SVG icons is much faster than using Google Maps symbols.
   *
   * @param feature - The Point Data feature.
   * @returns The style options for rendering the point.
   */
  private getPointStyle(feature: google.maps.Data.Feature): google.maps.Data.StyleOptions {
    const fixType = getPointProp(feature, 'fixType');
    const pilotId = getPointProp(feature, 'pilotId');
    const isActive = pilotId === this.currentId;
    const nowSec = Date.now() / 1000;
    const ageMin = Math.round((nowSec - getPointProp(feature, 'timeSec')) / 60);

    let opacity = ageMin > RECENT_TIMEOUT_MIN ? 0.3 : 0.9;
    if (isActive) {
      opacity = 0.9;
    }

    let svg: string;
    let anchor: google.maps.Point | undefined;
    let labelOrigin: google.maps.Point | undefined;
    let zIndex = 10;

    switch (fixType) {
      case FixType.pilot:
        {
          const heading = getPointProp(feature, 'heading') ?? 0;
          const color = getUniqueContrastColor(pilotId);
          if (getPointProp(feature, 'isUfo')) {
            anchor = ANCHOR_UFO;
            labelOrigin = ORIGIN_UFO;
            svg = ufoSvg(heading, color, opacity);
          } else {
            anchor = ANCHOR_ARROW;
            labelOrigin = ORIGIN_ARROW;
            svg = arrowSvg(heading, color, opacity);
          }
          if (isActive) {
            zIndex = 20;
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
        return { visible: false };
    }

    let label: google.maps.MarkerLabel | undefined;
    if (fixType === FixType.pilot && this.displayLabels && (isActive || ageMin < 6 * 60)) {
      const alt = getPointProp(feature, 'alt');
      const elevationStr = formatUnit(alt, this.units!.altitude);
      label = {
        color: isActive ? '#BF1515' : 'black',
        text: `${getPointProp(feature, 'name')}\n${elevationStr} · -${formatDurationMin(ageMin)}`,
        className: 'gm-label-outline',
        fontWeight: isActive ? '500' : undefined,
      };
    }

    const alt = getPointProp(feature, 'alt');
    const gndAlt = getPointProp(feature, 'gndAlt');
    const title = gndAlt == null ? undefined : `${formatUnit(Math.max(0, alt - gndAlt), this.units!.altitude)} AGL`;

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

  /**
   * Computes the style options for a LineString feature (live track line).
   *
   * Renders previous segments before gaps as dashed lines, highlights the selected track,
   * and dims non-selected tracks when a track is active.
   *
   * @param feature - The LineString Data feature.
   * @returns The style options for rendering the line.
   */
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
