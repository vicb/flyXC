import {
  css,
  CSSResult,
  customElement,
  html,
  internalProperty,
  LitElement,
  PropertyValues,
  query,
  TemplateResult,
} from 'lit-element';
import { connect } from 'pwa-helpers';

import { setDistance, setLeague, setScore, setSpeed } from '../../actions';
import { ClosingSector } from '../../gm/closing-sector';
import { FaiSectors } from '../../gm/fai-sectors';
import { getCurrentUrl, getUrlParam, ParamNames, pushCurrentState, setUrlParamValue } from '../../logic/history';
import { LEAGUES } from '../../logic/score/league/leagues';
import { Measure, Point } from '../../logic/score/measure';
import { CircuitType } from '../../logic/score/scorer';
import { RootState, store } from '../../store';
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
  private line?: google.maps.Polyline;

  @internalProperty()
  private expanded = false;

  @internalProperty()
  private get map(): google.maps.Map | undefined {
    return this.map_;
  }
  private set map(map: google.maps.Map | undefined) {
    this.map_ = map;
    if (!this.line) {
      window.addEventListener('popstate', () => this.handlePopState());
      if (this.initialPath.length == 0) {
        const route = getUrlParam(ParamNames.ROUTE)[0];
        if (route) {
          this.initialPath = google.maps.geometry.encoding.decodePath(route);
        } else {
          this.initialPath = [];
        }
        const speed = getUrlParam(ParamNames.SPEED)[0];
        if (speed) {
          store.dispatch(setSpeed(parseFloat(speed).toFixed(1)));
        }
        const league = getUrlParam(ParamNames.LEAGUE)[0];
        if (league) {
          store.dispatch(setLeague(league));
        }
      }
      if (map) {
        if (this.initialPath.length) {
          this.creatingInitialPath = true;
          const line = this.createLine(map);
          const path = line.getPath();
          path.clear();
          const bounds = new google.maps.LatLngBounds();
          this.initialPath?.forEach((p) => {
            bounds.extend(p);
            path.push(p);
          });
          map.fitBounds(bounds);
          this.toggleExpanded();
          this.creatingInitialPath = false;
        }
      }
    }
  }
  private map_: google.maps.Map | undefined;

  @internalProperty()
  private speed = 0;

  @internalProperty()
  private league = 'xc';

  @query('#share-dialog')
  private shareDialog?: any;

  @query('#download-dialog')
  private downloadDialog?: any;

  private initialPath: google.maps.LatLng[] = [];
  private creatingInitialPath = false;
  private onAddPoint: google.maps.MapsEventListener | null = null;
  private flight: google.maps.Polyline | null = null;
  private closingSector?: ClosingSector;
  private faiSectors?: FaiSectors;
  private plannerElement?: PlannerElement;

  stateChanged(state: RootState): void {
    this.speed = state.map.speed;
    this.league = state.map.league;
  }

  shouldUpdate(changedProperties: PropertyValues): boolean {
    if (changedProperties.has('league')) {
      this.computeDistance();
      changedProperties.delete('league');
    }
    return super.shouldUpdate(changedProperties);
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

  // Handle expanding/collapsing the control.
  private toggleExpanded(): void {
    this.expanded = !this.expanded;
    if (this.map) {
      if (this.expanded) {
        this.createLeftPaneLazily(this.map);
        const line = this.line ?? this.createLine(this.map);
        this.onAddPoint = google.maps.event.addListener(this.map, 'rightclick', (e: google.maps.MouseEvent) =>
          this.appendToPath(e.latLng),
        );
        line.setMap(this.map);
        this.computeDistance();
      } else {
        this.cleanupOnCollapse();
        google.maps.event.removeListener(this.onAddPoint as google.maps.MapsEventListener);
        this.onAddPoint = null;
      }
    }
  }

  private appendToPath(coord: google.maps.LatLng): void {
    this.line?.getPath().push(coord);
  }

  private createLine(map: google.maps.Map): google.maps.Polyline {
    const line = (this.line = new google.maps.Polyline({
      editable: true,
      map,
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
    }));

    const path = this.resetPath();
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

    return line;
  }

  private resetPath(): google.maps.MVCArray<google.maps.LatLng> {
    const map = this.map as google.maps.Map;
    const line = this.line as google.maps.Polyline;
    const path = line.getPath();
    const center = map.getCenter();
    const mapViewSpan = (map.getBounds() as google.maps.LatLngBounds).toSpan();
    path.clear();
    path.push(new google.maps.LatLng(center.lat(), center.lng() + mapViewSpan.lng() / 5));
    path.push(new google.maps.LatLng(center.lat(), center.lng() - mapViewSpan.lng() / 5));
    return path;
  }

  private getPathPoints(): Point[] {
    return this.line
      ? this.line
          .getPath()
          .getArray()
          .map((latLng) => ({ lat: latLng.lat(), lon: latLng.lng() }))
      : [];
  }

  private computeDistance(): void {
    if (!this.line || this.line.getPath().getLength() < 2) {
      return;
    }
    const line = this.line;
    const distance = google.maps.geometry.spherical.computeLength(line.getPath());
    const points = this.getPathPoints();
    const measure = new Measure(points);
    const league = LEAGUES[this.league];
    const scores = league.score(measure);

    this.flight?.setMap(null);
    this.flight = null;

    store.dispatch(setDistance(distance));
    scores.sort((score1, score2) => score2.points - score1.points);
    const score = scores[0];
    store.dispatch(setScore(score));
    let path = score.indexes.map((index) => new google.maps.LatLng(points[index].lat, points[index].lon));
    if (score.circuit == CircuitType.FLAT_TRIANGLE || score.circuit == CircuitType.FAI_TRIANGLE) {
      path = [path[1], path[2], path[3], path[1]];
    } else if (score.circuit == CircuitType.OUT_AND_RETURN) {
      path = [path[1], path[2]];
    }

    this.flight = new google.maps.Polyline({
      map: this.map as google.maps.Map,
      path,
      strokeColor: ROUTE_STROKE_COLORS[score.circuit],
      strokeOpacity: 0.8,
      strokeWeight: 3,
      zIndex: 1000,
    });

    if (!this.closingSector) {
      this.closingSector = new ClosingSector();
      this.closingSector.addListener('rightclick', (e: google.maps.MouseEvent) => this.appendToPath(e.latLng));
    }
    this.closingSector.setMap(null);
    if (score.closingRadius) {
      const center = points[score.indexes[0]];
      this.closingSector.center = center;
      this.closingSector.radius = score.closingRadius;
      this.closingSector.update();
      this.closingSector.setMap(this.map);
    }

    if (!this.faiSectors) {
      this.faiSectors = new FaiSectors();
      this.faiSectors.addListeners('rightclick', (e: google.maps.MouseEvent) => this.appendToPath(e.latLng));
    }
    this.faiSectors.setMap(null);
    if (score.circuit == CircuitType.FLAT_TRIANGLE || score.circuit == CircuitType.FAI_TRIANGLE) {
      const faiPoints = score.indexes.slice(1, 4).map((i) => points[i]);
      this.faiSectors.update(faiPoints);
      this.faiSectors.setMap(this.map);
    }

    // Sends a message to the iframe host with the changes.
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
          p: google.maps.geometry.encoding.encodePath(line.getPath()),
        }),
        '*',
      );
    }
  }

  protected render(): TemplateResult {
    // Update the URL on re-rendering
    setUrlParamValue(ParamNames.SPEED, String(this.speed));
    setUrlParamValue(ParamNames.LEAGUE, this.league);
    return html`
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/line-awesome@1/dist/line-awesome/css/line-awesome.min.css"
      />
      <i class="la la-ruler la-2x" style="cursor: pointer" @click=${this.toggleExpanded}></i>

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
            <ui5-label><a href=${this.getXcTrackHref()}>Open with XcTrack</a></ui5-label>
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

  // Update the route when history changes.
  private handlePopState(): void {
    const route = getUrlParam(ParamNames.ROUTE)[0];
    if (this.line) {
      if (route) {
        const path = this.line.getPath();
        path.clear();
        google.maps.geometry.encoding.decodePath(route).forEach((latLng) => {
          path.push(latLng);
        });
        this.computeDistance();
      } else if (this.expanded) {
        this.toggleExpanded();
      }
    }
  }

  // Updates the URL route parameter and add an history entry when the route is updated.
  private handlePathUpdates(): void {
    // Do not record history when the path is being created from the URL parameter.
    if (this.line && !this.creatingInitialPath) {
      const path = this.line.getPath();
      pushCurrentState();
      setUrlParamValue(ParamNames.ROUTE, google.maps.geometry.encoding.encodePath(path));
    }
    this.computeDistance();
  }

  private getXcTrackHref(): string {
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

  // Creates the left pane lazily.
  private createLeftPaneLazily(map: google.maps.Map): void {
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
      this.plannerElement.addEventListener('reset', () => this.resetPath());
    }
  }

  // Cleanup resources when the planner control gets closed.
  private cleanupOnCollapse(): void {
    if (this.line) {
      this.line.setMap(null);
      this.flight?.setMap(null);
      this.closingSector?.setMap(null);
      this.faiSectors?.setMap(null);
      store.dispatch(setScore(null));
    }
  }
}
