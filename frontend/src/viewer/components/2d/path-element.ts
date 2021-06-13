import '../ui/share-modal';
import '../ui/waypoint-modal';

import { customElement, internalProperty, LitElement, property, PropertyValues } from 'lit-element';
import { connect } from 'pwa-helpers';

import { ClosingSector } from '../../gm/closing-sector';
import { FaiSectors } from '../../gm/fai-sectors';
import { getCurrentUrl, pushCurrentState } from '../../logic/history';
import { drawRoute } from '../../logic/messages';
import { LEAGUES } from '../../logic/score/league/leagues';
import { Measure, Point } from '../../logic/score/measure';
import { CircuitType, Score } from '../../logic/score/scorer';
import { setDistance, setRoute, setScore } from '../../redux/planner-slice';
import { RootState, store } from '../../redux/store';
import { getModalController } from '../ui/ion-controllers';
import { PlannerElement } from './planner-element';

// Route color by circuit type.
const ROUTE_STROKE_COLORS = {
  [CircuitType.OpenDistance]: '#ff6600',
  [CircuitType.OutAndReturn]: '#ff9933',
  [CircuitType.FlatTriangle]: '#ffcc00',
  [CircuitType.FaiTriangle]: '#ffff00',
};

// Circuit abbreviation by circuit type.
const CIRCUIT_SHORT_NAME = {
  [CircuitType.OpenDistance]: 'od',
  [CircuitType.OutAndReturn]: 'oar',
  [CircuitType.FlatTriangle]: 'triangle',
  [CircuitType.FaiTriangle]: 'fai',
};

@customElement('path-element')
export class PathElement extends connect(store)(LitElement) {
  // Actual type is google.maps.Map.
  @property({ attribute: false })
  map!: google.maps.Map;

  @internalProperty()
  private enabled = false;
  @internalProperty()
  private league = 'xc';
  @internalProperty()
  private encodedRoute = '';
  @internalProperty()
  private isFreeDrawing = false;

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
    this.enabled = state.planner.enabled;
    this.encodedRoute = state.planner.route;
    this.isFreeDrawing = state.planner.isFreeDrawing;
  }

  shouldUpdate(changedProperties: PropertyValues): boolean {
    if (changedProperties.has('enabled')) {
      if (this.enabled) {
        this.createPlannerElement(this.map);
        this.line = this.createLine();
        this.updateLineFromState();
        if (this.encodedRoute.length > 0) {
          const bounds = new google.maps.LatLngBounds();
          this.line.getPath().forEach((p) => {
            bounds.extend(p);
          });
          this.map.fitBounds(bounds);
        }
      } else {
        this.destroy();
      }
    }
    if (changedProperties.has('league') && this.enabled) {
      this.optimize();
    }
    if ((changedProperties.has('encodedRoute') || changedProperties.has('isFreeDrawing')) && this.enabled) {
      this.updateLineFromState();
    }
    return super.shouldUpdate(changedProperties);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.destroy();
  }

  private updateLineFromState() {
    if (!this.line) {
      return;
    }
    this.line.setVisible(!this.isFreeDrawing);
    this.optimizedLine?.setVisible(!this.isFreeDrawing);
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

  private setDefaultPath() {
    if (this.line) {
      const path = this.line.getPath();
      path.clear();
      const center = this.map.getCenter();
      const mapViewSpan = (this.map.getBounds() as google.maps.LatLngBounds).toSpan();
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
      map: this.map,
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
    this.onPointAddeded = google.maps.event.addListener(this.map, 'rightclick', (e: google.maps.MapMouseEvent) =>
      this.appendToPath(e.latLng),
    );
    this.onBoundsChanged = google.maps.event.addListener(this.map, 'bounds_changed', () => {
      if (this.enabled && this.encodedRoute.length == 0) {
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
    if (score.circuit == CircuitType.FlatTriangle || score.circuit == CircuitType.FaiTriangle) {
      optimizedPath = [optimizedPath[1], optimizedPath[2], optimizedPath[3], optimizedPath[1]];
    } else if (score.circuit == CircuitType.OutAndReturn) {
      optimizedPath = [optimizedPath[1], optimizedPath[2]];
    }

    if (!this.optimizedLine) {
      this, (this.optimizedLine = new google.maps.Polyline());
    }
    this.optimizedLine.setOptions({
      map: this.map,
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
      this.closingSector.setMap(this.map);
    } else {
      this.closingSector.setMap(null);
    }

    if (!this.faiSectors) {
      this.faiSectors = new FaiSectors();
      this.faiSectors.addListeners('rightclick', (e) => this.appendToPath(e.latLng));
    }
    if (score.circuit == CircuitType.FlatTriangle || score.circuit == CircuitType.FaiTriangle) {
      const faiPoints = score.indexes.slice(1, 4).map((i) => points[i]);
      this.faiSectors.update(faiPoints);
      this.faiSectors.setMap(this.map);
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
      if (score.circuit == CircuitType.OpenDistance) {
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

  private async openDownloadModal(): Promise<void> {
    const elevator = new google.maps.ElevationService();
    elevator.getElevationForLocations(
      {
        locations: this.getPathPoints().map((p) => new google.maps.LatLng(p.lat, p.lon)),
      },
      async (results: google.maps.ElevationResult[], status: google.maps.ElevationStatus) => {
        let elevations = null;
        if (status == google.maps.ElevationStatus.OK) {
          elevations = results.map((r) => r.elevation);
        }

        const payload = {
          points: this.getPathPoints(),
          elevations,
        };

        const modal = await getModalController().create({
          component: 'waypoint-modal',
          componentProps: { payload },
        });
        await modal.present();
      },
    );
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

  private encodeNumber(num: number): string {
    // google.maps.geometry.encoding.encodePath is for latLng only.
    let pnum = num << 1;
    if (num < 0) {
      pnum = ~pnum;
    }
    let result = '';
    while (pnum > 0x1f) {
      result += String.fromCharCode(((pnum & 0x1f) | 0x20) + 63);
      pnum = pnum >>> 5;
    }
    result += String.fromCharCode(63 + pnum);
    return result;
  }

  private getXctsk(): string {
    const path = this.line ? this.line.getPath() : [];
    // https://xctrack.org/Competition_Interfaces.html#task-definition-format-2---for-qr-codes
    const turnpoints = path.map((latLng: google.maps.LatLng, i: number) => ({
      n: `WPT {i + 1}`,
      z:
        this.encodeNumber(1e5 * latLng.lng()) +
        this.encodeNumber(1e5 * latLng.lat()) +
        this.encodeNumber(0) + // Altitude
        this.encodeNumber(400), // Radius
    }));
    return `XCTSK:${JSON.stringify({ taskType: 'CLASSIC', version: 2, t: turnpoints })}`;
  }

  // Creates the planner element lazily.
  private createPlannerElement(map: google.maps.Map): void {
    if (this.plannerElement) {
      return;
    }
    if (!this.plannerElement) {
      const el = (this.plannerElement = document.createElement('planner-element') as PlannerElement);
      map.controls[google.maps.ControlPosition.LEFT_TOP].push(el);
      el.addEventListener('close-flight', () => {
        const path = (this.line as google.maps.Polyline).getPath();
        const last = path.getAt(path.getLength() - 1);
        const first = path.getAt(0);
        if (!first.equals(last)) {
          path.push(first);
        }
      });
      el.addEventListener('share', async () => {
        const modal = await getModalController().create({
          component: 'share-modal',
          componentProps: {
            xctrackLink: this.getXcTrackLink(),
            xctsk: this.getXctsk(),
          },
        });
        await modal.present();
      });
      el.addEventListener('download', async () => {
        await this.openDownloadModal();
      });
      el.addEventListener('reset', () => store.dispatch(setRoute('')));
      el.addEventListener('draw-route', () => {
        drawRoute.emit();
        store.dispatch(setRoute(''));
      });
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
