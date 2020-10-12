import {
  css,
  CSSResult,
  customElement,
  html,
  internalProperty,
  LitElement,
  property,
  PropertyValues,
  query,
  TemplateResult,
} from 'lit-element';
import { connect } from 'pwa-helpers';

import { ClosingSector } from '../../gm/closing-sector';
import { FaiSectors } from '../../gm/fai-sectors';
import { getCurrentUrl, pushCurrentState } from '../../logic/history';
import { LEAGUES } from '../../logic/score/league/leagues';
import { Measure, Point } from '../../logic/score/measure';
import { CircuitType, Score } from '../../logic/score/scorer';
import { setDistance, setExpanded, setRoute, setScore } from '../../redux/planner-slice';
import { RootState, store } from '../../redux/store';
import { controlStyle } from '../control-style';
import { PlannerElement } from './planner-element';

// Route color by circuit type.
const ROUTE_STROKE_COLORS = {
  [CircuitType.OPEN_DISTANCE]: '#ff6600',
  [CircuitType.OUT_AND_RETURN]: '#ff9933',
  [CircuitType.FLAT_TRIANGLE]: '#ffcc00',
  [CircuitType.FAI_TRIANGLE]: '#ffff00',
};

// Circuit abbreviation by circuit type.
const CIRCUIT_SHORT_NAME = {
  [CircuitType.OPEN_DISTANCE]: 'od',
  [CircuitType.OUT_AND_RETURN]: 'oar',
  [CircuitType.FLAT_TRIANGLE]: 'triangle',
  [CircuitType.FAI_TRIANGLE]: 'fai',
};

const WAYPOINT_FORMATS: { [id: string]: string } = {
  cup: 'See You (cup)',
  gpx: 'GPX',
  kml: 'KML (Google Earth)',
  tsk: 'XCSoar',
  wpt: 'FormatGEO (GpsDump)',
};

@customElement('path-ctrl-element')
export class PathCtrlElement extends connect(store)(LitElement) {
  // Actual type is google.maps.Map.
  @property({ attribute: false })
  map: any;

  private get gMap(): google.maps.Map {
    return this.map;
  }

  @internalProperty()
  private expanded = false;
  @internalProperty()
  private league = 'xc';
  @internalProperty()
  private encodedRoute = '';

  @query('#share-dialog')
  private shareDialog?: any;
  @query('#download-dialog')
  private downloadDialog?: any;

  private line?: google.maps.Polyline;
  private optimizedLine?: google.maps.Polyline;
  // Set to true to block updating the state.
  // i.e. when the line is being created from the state.
  private doNotSyncState = false;
  private onPointAddeded?: google.maps.MapsEventListener;
  private onBoundsChanged?: google.maps.MapsEventListener;
  private closingSector?: ClosingSector;
  private faiSectors?: FaiSectors;
  private plannerElement?: PlannerElement;

  stateChanged(state: RootState): void {
    this.league = state.planner.league;
    this.expanded = state.planner.expanded;
    this.encodedRoute = state.planner.route;
  }

  shouldUpdate(changedProperties: PropertyValues): boolean {
    if (changedProperties.has('expanded')) {
      if (this.expanded) {
        this.createPlannerElement(this.gMap);
        this.line = this.createLine();
        this.updateLineFromState();
        if (this.encodedRoute.length > 0) {
          const bounds = new google.maps.LatLngBounds();
          this.line.getPath().forEach((p) => {
            bounds.extend(p);
          });
          this.gMap.fitBounds(bounds);
        }
      } else {
        this.destroy();
      }
    }
    if (changedProperties.has('league') && this.expanded) {
      this.optimize();
    }
    if (changedProperties.has('encodedRoute') && this.expanded) {
      this.updateLineFromState();
    }
    return super.shouldUpdate(changedProperties);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.destroy();
  }

  static get styles(): CSSResult[] {
    return [
      controlStyle,
      css`
        .form-fields {
          display: flex;
          flex-direction: column;
          justify-content: space-evenly;
          align-items: flex-start;
          text-align: left;
          margin: 1rem;
        }
      `,
    ];
  }

  private updateLineFromState() {
    if (!this.line) {
      return;
    }
    this.doNotSyncState = true;
    if (this.encodedRoute.length == 0) {
      this.setDefaultPath();
    } else {
      const path = this.line.getPath();
      path.clear();
      const coords = google.maps.geometry.encoding.decodePath(this.encodedRoute);
      coords.forEach((latLon) => {
        path.push(latLon);
      });
    }
    this.doNotSyncState = false;
    this.optimize();
  }

  protected render(): TemplateResult {
    return html`
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/line-awesome@1/dist/line-awesome/css/line-awesome.min.css"
      />
      <i
        class="la la-ruler la-2x"
        style="cursor: pointer"
        @click=${() => store.dispatch(setExpanded(!this.expanded))}
      ></i>

      <ui5-dialog id="share-dialog" header-text="Share">
        <section class="form-fields">
          <div>
            <ui5-toast id="notif-copy" placement="TopCenter">Link copied to clipboard</ui5-toast>
            <ui5-label for="link">Link</ui5-label>
            <ui5-input id="link" readonly value=${document.location.href}>
              ${navigator.clipboard
                ? html`<i
                    title="Copy to clipboard"
                    class="la la-copy la-lg"
                    slot="icon"
                    @click=${async () => {
                      await navigator.clipboard.writeText(document.location.href);
                      const notification = (this.shadowRoot as ShadowRoot).getElementById('notif-copy') as any;
                      notification?.show();
                    }}
                  ></i>`
                : html``}
            </ui5-input>
          </div>
          <br />
          <div>
            <ui5-label><a href=${this.getXcTrackLink()}>Open with XcTrack</a></ui5-label>
          </div>
          <img id="qr-code" width="256" height="256" />
        </section>
        <div slot="footer" style="display:flex;align-items:center;padding:.5rem">
          <div style="flex: 1"></div>
          <ui5-button design="Emphasized" @click=${this.closeShareDialog}>Close</ui5-button>
        </div>
      </ui5-dialog>

      <ui5-dialog id="download-dialog" header-text="Download Waypoints">
        <section class="form-fields">
          <div>
            <ui5-label for="link">Turnpoints</ui5-label>
            <table>
              ${this.getPathPoints().map(
                (p, i) =>
                  html`
                    <tr>
                      <td>${String(i + 1).padStart(3, '0')}</td>
                      <td>${p.lat.toFixed(6)}</td>
                      <td>${p.lon.toFixed(6)}</td>
                    </tr>
                  `,
              )}
            </table>
          </div>
          <div>
            <ui5-label for="format">Format</ui5-label>
            <ui5-select id="format">
              ${Object.getOwnPropertyNames(WAYPOINT_FORMATS).map(
                (f) => html` <ui5-option value=${f}>${WAYPOINT_FORMATS[f]}</ui5-option> `,
              )}
            </ui5-select>
          </div>
          <div>
            <ui5-label for="prefix">Waypoint prefix</ui5-label>
            <ui5-input id="prefix" value="FXC"></ui5-input>
          </div>
        </section>
        <div slot="footer" style="display:flex;align-items:center;padding:.5rem">
          <div style="flex: 1"></div>
          <ui5-button @click=${(): void => this.closeDownloadDialog(false)}>Close</ui5-button>
          <div style="flex: .1"></div>
          <ui5-button design="Emphasized" @click=${(): void => this.closeDownloadDialog(true)}>Download</ui5-button>
        </div>
      </ui5-dialog>
      <form id="form-wpt" style="display: none" action="_waypoints" method="POST">
        <input id="request" name="request" />
      </form>
    `;
  }

  private setDefaultPath() {
    if (this.line) {
      const path = this.line.getPath();
      path.clear();
      const center = this.gMap.getCenter();
      const mapViewSpan = (this.gMap.getBounds() as google.maps.LatLngBounds).toSpan();
      path.push(new google.maps.LatLng(center.lat(), center.lng() + mapViewSpan.lng() / 5));
      path.push(new google.maps.LatLng(center.lat(), center.lng() - mapViewSpan.lng() / 5));
    }
  }

  private appendToPath(coord: google.maps.LatLng): void {
    this.line?.getPath().push(coord);
  }

  private createLine(): google.maps.Polyline {
    const line = new google.maps.Polyline({
      editable: true,
      map: this.gMap,
      strokeColor: 'black',
      strokeWeight: 1,
      path: new google.maps.MVCArray(),
      zIndex: 100,
      icons: [
        {
          icon: { path: google.maps.SymbolPath.FORWARD_OPEN_ARROW, scale: 1.5 },
          repeat: '100px',
        },
      ],
    });

    const path = line.getPath();
    google.maps.event.addListener(path, 'set_at', () => this.handlePathUpdates());
    google.maps.event.addListener(path, 'remove_at', () => this.handlePathUpdates());
    google.maps.event.addListener(path, 'insert_at', () => this.handlePathUpdates());
    google.maps.event.addListener(line, 'rightclick', (event: google.maps.PolyMouseEvent): void => {
      if (event.vertex != null) {
        const path = line.getPath();
        path.getLength() > 2 && path.removeAt(event.vertex);
      }
    });
    google.maps.event.addListener(line, 'dblclick', (event: google.maps.PolyMouseEvent): void => {
      if (event.vertex != null) {
        const path = line.getPath();
        path.getLength() > 2 && path.removeAt(event.vertex);
      }
    });
    this.onPointAddeded = google.maps.event.addListener(this.gMap, 'rightclick', (e: google.maps.MouseEvent) =>
      this.appendToPath(e.latLng),
    );
    this.onBoundsChanged = google.maps.event.addListener(this.gMap, 'bounds_changed', () => {
      if (this.expanded && this.encodedRoute.length == 0) {
        this.updateLineFromState();
      }
    });

    return line;
  }

  // Returns the route as an array of points.
  private getPathPoints(): Point[] {
    return this.line
      ? this.line
          .getPath()
          .getArray()
          .map((latLng) => ({ lat: latLng.lat(), lon: latLng.lng() }))
      : [];
  }

  // Optimize the route and draw the optimize lines and sectors.
  private optimize(): void {
    if (!this.line || this.line.getPath().getLength() < 2) {
      return;
    }
    const line = this.line;
    store.dispatch(setDistance(google.maps.geometry.spherical.computeLength(line.getPath())));

    const points = this.getPathPoints();
    const measure = new Measure(points);
    const scores = LEAGUES[this.league].score(measure);

    scores.sort((score1, score2) => score2.points - score1.points);
    const score = scores[0];
    store.dispatch(setScore(score));

    let optimizedPath = score.indexes.map((index) => new google.maps.LatLng(points[index].lat, points[index].lon));
    if (score.circuit == CircuitType.FLAT_TRIANGLE || score.circuit == CircuitType.FAI_TRIANGLE) {
      optimizedPath = [optimizedPath[1], optimizedPath[2], optimizedPath[3], optimizedPath[1]];
    } else if (score.circuit == CircuitType.OUT_AND_RETURN) {
      optimizedPath = [optimizedPath[1], optimizedPath[2]];
    }

    if (!this.optimizedLine) {
      this, (this.optimizedLine = new google.maps.Polyline());
    }
    this.optimizedLine.setOptions({
      map: this.gMap,
      path: optimizedPath,
      strokeColor: ROUTE_STROKE_COLORS[score.circuit],
      strokeOpacity: 0.8,
      strokeWeight: 3,
      zIndex: 1000,
    });

    if (!this.closingSector) {
      this.closingSector = new ClosingSector();
      this.closingSector.addListener('rightclick', (e) => this.appendToPath(e.latLng));
    }

    if (score.closingRadius) {
      const center = points[score.indexes[0]];
      this.closingSector.center = center;
      this.closingSector.radius = score.closingRadius;
      this.closingSector.update();
      this.closingSector.setMap(this.gMap);
    } else {
      this.closingSector.setMap(null);
    }

    if (!this.faiSectors) {
      this.faiSectors = new FaiSectors();
      this.faiSectors.addListeners('rightclick', (e) => this.appendToPath(e.latLng));
    }
    if (score.circuit == CircuitType.FLAT_TRIANGLE || score.circuit == CircuitType.FAI_TRIANGLE) {
      const faiPoints = score.indexes.slice(1, 4).map((i) => points[i]);
      this.faiSectors.update(faiPoints);
      this.faiSectors.setMap(this.gMap);
    } else {
      this.faiSectors.setMap(null);
    }

    this.postScoreToHost(score);
  }

  // Sends a message to the iframe host with the changes.
  private postScoreToHost(score: Score) {
    let kms = '';
    let circuit = '';
    if (score.distance && window.parent) {
      kms = (score.distance / 1000).toFixed(1);
      circuit = CIRCUIT_SHORT_NAME[score.circuit];
      if (score.circuit == CircuitType.OPEN_DISTANCE) {
        circuit += score.indexes.length - 2;
      }
      window.parent.postMessage(
        JSON.stringify({
          kms,
          circuit,
          l: this.league,
          p: this.encodedRoute,
        }),
        '*',
      );
    }
  }

  private closeShareDialog(): void {
    this.shareDialog?.close();
  }

  private closeDownloadDialog(download: boolean): void {
    if (!download) {
      this.downloadDialog?.close();
    } else {
      const elevator = new google.maps.ElevationService();
      elevator.getElevationForLocations(
        {
          locations: this.getPathPoints().map((p) => new google.maps.LatLng(p.lat, p.lon)),
        },
        (results: google.maps.ElevationResult[], status: google.maps.ElevationStatus) => {
          let elevations = null;
          if (status == google.maps.ElevationStatus.OK) {
            elevations = results.map((r) => r.elevation);
          }
          const root = this.renderRoot;
          const input = root.querySelector('#request') as HTMLInputElement;
          input.value = JSON.stringify({
            points: this.getPathPoints(),
            elevations,
            format: (root.querySelector('#format') as any).selectedOption.value,
            prefix: (root.querySelector('#prefix') as any).value,
          });

          const form = root.querySelector('#form-wpt') as HTMLFormElement;
          form.submit();
          this.downloadDialog.close();
        },
      );
    }
  }

  private handlePathUpdates(): void {
    if (this.line && !this.doNotSyncState) {
      pushCurrentState();
      store.dispatch(setRoute(google.maps.geometry.encoding.encodePath(this.line.getPath())));
    }
    this.optimize();
  }

  private getXcTrackLink(): string {
    const params = new URLSearchParams();
    if (this.line) {
      const points: string[] = [];
      this.line
        .getPath()
        .forEach((latLng: google.maps.LatLng) => points.push(latLng.lat().toFixed(6) + ',' + latLng.lng().toFixed(6)));
      params.set('route', points.join(':'));
    }
    return `http://xctrack.org/xcplanner?${params}`;
  }

  // Creates the planner element lazily.
  private createPlannerElement(map: google.maps.Map): void {
    if (this.plannerElement) {
      return;
    }
    if (!this.plannerElement) {
      const shadowRoot = this.shadowRoot as ShadowRoot;
      this.plannerElement = document.createElement('planner-element') as PlannerElement;
      map.controls[google.maps.ControlPosition.LEFT_TOP].push(this.plannerElement);
      this.plannerElement.addEventListener('close-flight', () => {
        const path = (this.line as google.maps.Polyline).getPath();
        path.push(path.getAt(0));
      });
      this.plannerElement.addEventListener('share', () => {
        const dialog = shadowRoot.getElementById('share-dialog') as any;
        const qr = shadowRoot.getElementById('qr-code') as HTMLImageElement;
        qr.setAttribute('src', `_qr.svg?text=${encodeURIComponent(getCurrentUrl().href)}`);
        dialog.open();
      });
      this.plannerElement.addEventListener('download', () => {
        const dialog = shadowRoot.getElementById('download-dialog') as any;
        dialog.open();
      });
      this.plannerElement.addEventListener('reset', () => store.dispatch(setRoute('')));
    }
  }

  // Cleanup resources when the planner control gets closed.
  private destroy(): void {
    google.maps.event.removeListener(this.onPointAddeded as google.maps.MapsEventListener);
    this.onPointAddeded = undefined;
    google.maps.event.removeListener(this.onBoundsChanged as google.maps.MapsEventListener);
    this.onBoundsChanged = undefined;
    this.line?.setMap(null);
    this.line = undefined;
    this.optimizedLine?.setMap(null);
    this.optimizedLine = undefined;
    this.closingSector?.setMap(null);
    this.closingSector = undefined;
    this.faiSectors?.setMap(null);
    this.faiSectors = undefined;
    this.plannerElement?.remove();
    this.plannerElement = undefined;
  }
}
