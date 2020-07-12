import { CSSResult, LitElement, PropertyValues, TemplateResult, css, customElement, html, property } from 'lit-element';
import { Measure, Point } from '../logic/score/measure';
import { RootState, store } from '../store';
import { setDistance, setLeague, setScore, setSpeed } from '../actions/map';
import { Track } from '../logic/map';

import { CircuitType, Score } from '../logic/score/scorer';
import { ClosingSector } from '../gm/closing-sector';
import { FaiSectors } from '../gm/fai-sectors';
import { LEAGUES } from '../logic/score/league/leagues';
import { PlannerElement } from './planner-element';
import { connect } from 'pwa-helpers';
import { formatUnit } from '../logic/units';
//import { isMobileDevice } from '../logic/util';
import { BRecord, RecordExtensions } from 'igc-parser';
import { Solution } from 'igc-xc-score';
import { Units } from '../reducers/map';

const ROUTE_STROKE_COLORS = {
  [CircuitType.OPEN_DISTANCE]: '#ff6600',
  [CircuitType.OUT_AND_RETURN]: '#ff9933',
  [CircuitType.FLAT_TRIANGLE]: '#ffcc00',
  [CircuitType.FAI_TRIANGLE]: '#ffff00',
};

const SCORE_STROKE_COLORS = {
  [CircuitType.OPEN_DISTANCE]: '#b22222',
  [CircuitType.OUT_AND_RETURN]: '#b22222',
  [CircuitType.FLAT_TRIANGLE]: '#cd5c5c',
  [CircuitType.FAI_TRIANGLE]: '#cd5c5c',
};

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
  line: google.maps.Polyline | null = null;
  scoring: {
    path: google.maps.Polyline | null;
    closing: google.maps.Polyline | null;
  } = { path: null, closing: null };

  @property({ attribute: false })
  expanded = false;

  
  @property({ attribute: false })
  tracks: Track[] | null = null;

  @property({ attribute: false })
  currentTrack: number | null = null;

  @property({ attribute: false })
  worker: Worker | null = null;

  @property({ attribute: false })
  measureIcon: string = 'img/measuring.svg';

  @property({ attribute: false })
  units: Units | null = null;

  @property({ attribute: false })
  get map(): google.maps.Map | null {
    return this.map_;
  }
  set map(map: google.maps.Map | null) {
    this.map_ = map;
    if (!this.line) {
      const url = new URL(document.location.href);
      if (this.initialPath == null) {
        if (url.searchParams.has('p')) {
          this.initialPath = google.maps.geometry.encoding.decodePath(url.searchParams.get('p') as string);
        } else {
          this.initialPath = [];
        }
        if (url.searchParams.has('s')) {
          store.dispatch(setSpeed(parseFloat(url.searchParams.get('s') as string).toFixed(1)));
        }
        if (url.searchParams.has('l')) {
          store.dispatch(setLeague(url.searchParams.get('l')));
        }
      }
      if (map) {
        if (this.initialPath.length) {
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
        }
      }
    }
  }
  map_: google.maps.Map | null = null;

  @property({ attribute: false })
  distance = 0;

  @property({ attribute: false })
  speed = 0;

  @property({ attribute: false })
  league = 'xc';

  initialPath: google.maps.LatLng[] | null = null;
  onAddPoint: google.maps.MapsEventListener | null = null;
  flight: google.maps.Polyline | null = null;
  closingSector: ClosingSector | null = null;
  faiSectors: FaiSectors | null = null;
  plannerElement: PlannerElement | null = null;

  stateChanged(state: RootState): void {
    if (state.map) {
      this.speed = state.map.speed;
      this.league = state.map.league;
      this.units = state.map.units;
      this.tracks = state.map.tracks;
      this.currentTrack = state.map.currentTrack;
    }
  }

  shouldUpdate(changedProperties: PropertyValues): boolean {
    if (changedProperties.has('league')) {
      this.updateDistance();
      changedProperties.delete('league');
    }
    return super.shouldUpdate(changedProperties);
  }

  static get styles(): CSSResult[] {
    return [
      css`
        :host {
          display: block;
          border: 1px inset #555;
          padding: 4px;
          margin: 2px 5px;
          background-color: #adff2f;
          text-align: right;
          border-radius: 4px;
          opacity: 0.9;
          user-select: none;
          float: right;
          clear: both;
        }
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

  protected toggleExpanded(): void {
    this.expanded = !this.expanded;
    if (this.map) {
      if (this.expanded) {
        if (!this.plannerElement) {
          const shadowRoot = this.shadowRoot as ShadowRoot;
          this.plannerElement = document.createElement('planner-element') as PlannerElement;
          this.map.controls[google.maps.ControlPosition.LEFT_TOP].push(this.plannerElement);
          this.plannerElement.addEventListener('close-flight', () => {
            const path = (this.line as google.maps.Polyline).getPath();
            path.push(path.getAt(0));
          });
          this.plannerElement.addEventListener('share', () => {
            const dialog = shadowRoot.getElementById('share-dialog') as any;
            const qr = shadowRoot.getElementById('qr-code') as HTMLImageElement;
            qr.setAttribute('src', `_qr.svg?text=${this.getQrText()}`);
            dialog.open();
          });
          this.plannerElement.addEventListener('download', () => {
            const dialog = shadowRoot.getElementById('download-dialog') as any;
            dialog.open();
          });
          this.plannerElement.addEventListener('reset', () => this.resetPath());
        }
        const line = this.line ? (this.line as google.maps.Polyline) : this.createLine(this.map);
        this.onAddPoint = google.maps.event.addListener(this.map, 'rightclick', (e: google.maps.MouseEvent) =>
          this.appendToPath(e.latLng),
        );
        line.setMap(this.map);
        this.updateDistance();
      } else {
        const line = this.line as google.maps.Polyline;
        line.setMap(null);
        for (let e of [this.flight, this.closingSector, this.faiSectors, this.scoring.closing, this.scoring.path]) {
          if (e) {
            e.setMap(null);
          }
        }
        store.dispatch(setScore(null));
        google.maps.event.removeListener(this.onAddPoint as google.maps.MapsEventListener);
        this.onAddPoint = null;
      }
    }
  }

  protected appendToPath(coord: google.maps.LatLng): void {
    this.line!.getPath().push(coord);
  }

  protected createLine(map: google.maps.Map): google.maps.Polyline {
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
    google.maps.event.addListener(path, 'set_at', () => this.updateDistance());
    google.maps.event.addListener(path, 'remove_at', () => this.updateDistance());
    google.maps.event.addListener(path, 'insert_at', () => this.updateDistance());
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

  protected resetPath(): google.maps.MVCArray<google.maps.LatLng> {
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

  protected getPathPoints(): Point[] {
    return this.line
      ? this.line
          .getPath()
          .getArray()
          .map((latLng) => ({ lat: latLng.lat(), lon: latLng.lng() }))
      : [];
  }

  protected updateDistance(): void {
    if (!this.line || this.line.getPath().getLength() < 2) {
      return;
    }
    const line = this.line;
    const distance = google.maps.geometry.spherical.computeLength(line.getPath());
    this.distance = Number((distance / 1000).toFixed(1));
    const points = this.getPathPoints();
    const measure = new Measure(points);
    const league = LEAGUES[this.league];
    const scores = league.score(measure);

    if (this.flight) {
      this.flight.setMap(null);
      this.flight = null;
    }

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
      strokeWeight: 4,
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

  protected launchScoring(): void {
    if (this.tracks && this.currentTrack !== null && this.tracks[this.currentTrack]) {
      const fixes: BRecord[] = [];
      for (let i = 0; i < this.tracks[this.currentTrack].fixes.lat.length; i++)
        // Keep this to the bare minimum needed for igc-xc-score
        fixes[i] = {
          timestamp: this.tracks[this.currentTrack].fixes.ts[i],
          latitude: this.tracks[this.currentTrack].fixes.lat[i],
          longitude: this.tracks[this.currentTrack].fixes.lon[i],
          pressureAltitude: this.tracks[this.currentTrack].fixes.alt[i],
          gpsAltitude: this.tracks[this.currentTrack].fixes.alt[i],
          valid: true,
          extensions: {} as RecordExtensions,
          fixAccuracy: null,
          time: '',
          enl: null
        };
      if (this.worker !== null)
        this.worker.terminate();
      this.worker = new Worker('js/xc-score-worker.js');
      this.worker.onmessage = this.updateScore.bind(this);
      this.worker.postMessage({ msg: 'xc-score-start', flight: JSON.stringify(fixes), league: this.league });
      this.measureIcon = 'img/pacman.svg';
    }
  }

  protected updateScore(msg: any): void {
    if (msg.data.msg && (msg.data.msg === 'xc-score-result' || msg.data.msg === 'xc-score-progress')) {
      const r = JSON.parse(msg.data.r) as Solution;
      let t: CircuitType;
      let closedCircuit: boolean = false;
      switch (r.opt.scoring.code) {
        case 'tri':
          t = CircuitType.FLAT_TRIANGLE;
          closedCircuit = true;
          break;
        case 'fai':
          t = CircuitType.FAI_TRIANGLE;
          closedCircuit = true;
          break;
        default:
        case 'od':
          t = CircuitType.OPEN_DISTANCE;
          break;
      }
      const score: Score = {
        points: r.score ? r.score : 0,
        distance: r.scoreInfo ? r.scoreInfo.distance * 1000 : 0,
        closingRadius: r.scoreInfo && r.scoreInfo.cp ? r.scoreInfo.cp.d : 0,
        multiplier: r.opt.scoring.multiplier,
        circuit: t,
        indexes: [0]
      }

      if (this.scoring.path !== null)
        this.scoring.path.setMap(null);
      if (this.scoring.closing !== null)
        this.scoring.closing.setMap(null);
      let turnPoints: google.maps.LatLng[] = [];
      if (r.scoreInfo && r.scoreInfo.tp) {
        turnPoints = r.scoreInfo.tp.map(p => new google.maps.LatLng(p.y, p.x));
        if (closedCircuit) {
          /* Triangle -> first point is also last */
          turnPoints.push(turnPoints[0]);
        } else {
          /* Open distance -> ep.start and ep.finish are actually first and fifth turnpoint */
          if (r.scoreInfo && r.scoreInfo.ep) {
            turnPoints.unshift(new google.maps.LatLng(r.scoreInfo.ep.start.y, r.scoreInfo.ep.start.x));
            turnPoints.push(new google.maps.LatLng(r.scoreInfo.ep.finish.y, r.scoreInfo.ep.finish.x));
          }
        }
        this.scoring.path = new google.maps.Polyline({
          map: this.map as google.maps.Map,
          path: turnPoints,
          strokeColor: SCORE_STROKE_COLORS[score.circuit],
          strokeWeight: 4,
          zIndex: 1000,
        });
      }
      let closingPoints: google.maps.LatLng[] = [];
      if (r.scoreInfo && r.scoreInfo.cp && closedCircuit) {
        closingPoints = [new google.maps.LatLng(r.scoreInfo.cp.in.y, r.scoreInfo.cp.in.x),
          new google.maps.LatLng(r.scoreInfo.cp.out.y, r.scoreInfo.cp.out.x)];
        this.scoring.closing = new google.maps.Polyline({
          map: this.map as google.maps.Map,
          path: closingPoints,
          strokeColor: SCORE_STROKE_COLORS['Out and return'],
          strokeWeight: 4,
          zIndex: 1000,
        });
      }

      store.dispatch(setScore(score));
      if (msg.data.msg === 'xc-score-result')
        this.measureIcon = 'img/measuring.svg';
    }
  }

  protected render(): TemplateResult {
    // Update the URL on re-rendering
    this.getQrText();
    return this.units
      ? html`
          <link rel="stylesheet" href="https://kit-free.fontawesome.com/releases/latest/css/free.min.css" />
          <span .hidden=${!this.expanded}>
            <i class="fas fa-2x" style="cursor: pointer" @click=${this.launchScoring}>
              <img width="32" height="32" style="vertical-align: middle;" src="${this.measureIcon}" />
            </i>
            ${formatUnit(this.distance, this.units.distance)}
          </span>
          <i class="fas fa-ruler fa-2x" style="cursor: pointer" @click=${this.toggleExpanded}></i>

          <ui5-dialog id="share-dialog" header-text="Share">
            <section class="form-fields">
              <div>
                <ui5-label for="link">Link</ui5-label>
                <ui5-input id="link" readonly value=${document.location.href}></ui5-input>
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

          <ui5-dialog id="download-dialog" header-text="Download">
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
        `
      : html``;
  }

  protected closeShareDialog(): void {
    const shadowRoot = this.shadowRoot as ShadowRoot;
    const dialog = shadowRoot.getElementById('share-dialog') as any;
    dialog.close();
  }

  protected closeDownloadDialog(download: boolean): void {
    const shadowRoot = this.shadowRoot as ShadowRoot;
    const dialog = shadowRoot.getElementById('download-dialog') as any;
    if (!download) {
      dialog.close();
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
          const shadowRoot = this.shadowRoot as ShadowRoot;
          const input = shadowRoot.getElementById('request') as HTMLInputElement;
          input.value = JSON.stringify({
            points: this.getPathPoints(),
            elevations,
            format: (shadowRoot.getElementById('format') as any).selectedOption.value,
            prefix: (shadowRoot.getElementById('prefix') as any).value,
          });

          const form = shadowRoot.getElementById('form-wpt') as HTMLFormElement;
          form.submit();
          dialog.close();
        },
      );
    }
  }

  protected getQrText(): string {
    const url = new URL(document.location.href);
    url.searchParams.set('s', String(this.speed));
    url.searchParams.set('l', this.league);
    if (this.line) {
      const path = this.line.getPath();
      url.searchParams.set('p', google.maps.geometry.encoding.encodePath(path));
    }
    history.replaceState({}, '', String(url));
    return encodeURIComponent(String(url));
  }

  protected getXcTrackHref(): string {
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
}
