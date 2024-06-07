import '../ui/share-modal';
import '../ui/waypoint-modal';

import type { LatLon } from '@flyxc/common';
import { CircuitType } from '@flyxc/optimizer/lib/api';
import type { ScoringResult } from '@flyxc/optimizer/lib/optimizer';
import { modalController } from '@ionic/core/components';
import type { PropertyValues } from 'lit';
import { LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { connect } from 'pwa-helpers';

import { ClosingSector } from '../../gm/closing-sector';
import { FaiSectors } from '../../gm/fai-sectors';
import { addAltitude } from '../../logic/elevation';
import { getCurrentUrl, pushCurrentState } from '../../logic/history';
import { drawRoute } from '../../logic/messages';
import type { LeagueCode } from '../../logic/score/league/leagues';
import { getScoringRuleName } from '../../logic/score/league/leagues';
import { Score } from '../../logic/score/scorer';
import { setDistance, setEnabled, setRoute, setScore } from '../../redux/planner-slice';
import type { RootState } from '../../redux/store';
import { store } from '../../redux/store';
import type { Request as WorkerRequest, Response as WorkerResponse } from '../../workers/optimizer';
import ScoringWorker from '../../workers/optimizer?worker';
import type { PlannerElement } from './planner-element';

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
  @property({ attribute: false })
  map!: google.maps.Map;

  @state()
  private enabled = false;
  @state()
  private league: LeagueCode = 'xc';
  @state()
  private encodedRoute = '';
  @state()
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
  private scoringRequestId = 0;
  private scoringWorker?: Worker;

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
      const center = this.map.getCenter() as google.maps.LatLng;
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
      this.appendToPath(e.latLng as google.maps.LatLng),
    );
    this.onBoundsChanged = google.maps.event.addListener(this.map, 'bounds_changed', () => {
      if (this.enabled && this.encodedRoute.length == 0) {
        this.updateLineFromState();
      }
    });

    return line;
  }

  // Returns the route as an array of points.
  private getPathPoints(): LatLon[] {
    return this.line
      ? this.line
          .getPath()
          .getArray()
          .map((latLng) => ({ lat: latLng.lat(), lon: latLng.lng() }))
      : [];
  }

  // Optimize the route and draw the optimize lines and sectors.
  private optimize(): void {
    const { line } = this;
    if (!line || line.getPath().getLength() < 2 || this.doNotSyncState) {
      return;
    }

    const points = this.getPathPoints();

    if (!this.scoringWorker) {
      this.scoringWorker = new ScoringWorker();
      this.scoringWorker.onmessage = (msg: MessageEvent<WorkerResponse>) => {
        if (msg.data.id == this.scoringRequestId) {
          this.optimizerCallback(msg.data.response);
        }
      };
    }

    const request: WorkerRequest = {
      request: {
        track: {
          points: points.map((point, i) => ({ ...point, alt: 0, timeSec: i * 60 })),
        },
        ruleName: getScoringRuleName(this.league),
      },
      id: ++this.scoringRequestId,
    };

    this.scoringWorker.postMessage(request);
  }

  private optimizerCallback(result: ScoringResult): void {
    const score = this.toScore(result);
    store.dispatch(setDistance(score.distanceM));
    store.dispatch(setScore(score));

    const path = [result.startPoint, ...result.turnpoints, result.endPoint]
      .filter((p) => p != null)
      .map((p) => ({ lat: p!.lat, lng: p!.lon }));

    if (result.circuit != CircuitType.OpenDistance) {
      path.push(path[0]);
    }

    this.optimizedLine ??= new google.maps.Polyline();

    this.optimizedLine.setOptions({
      map: this.map,
      path,
      strokeColor: ROUTE_STROKE_COLORS[score.circuit],
      strokeOpacity: 0.8,
      strokeWeight: 3,
      zIndex: 1000,
    });

    if (!this.closingSector) {
      this.closingSector = new ClosingSector();
      this.closingSector.addListener('rightclick', (e) => this.appendToPath(e.latLng));
    }

    if (result.closingPoints) {
      this.closingSector.center = result.closingPoints.in;
      this.closingSector.radiusM = score.closingRadiusKm * 1000;
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
      this.faiSectors.update(result.turnpoints);
      this.faiSectors.setMap(this.map);
    } else {
      this.faiSectors.setMap(null);
    }

    this.postScoreToHost(score);
  }

  private toScore(result: ScoringResult): Score {
    return new Score({
      circuit: result.circuit,
      distanceM: result.lengthKm * 1000,
      multiplier: result.multiplier,
      closingRadiusKm: result.closingRadiusKm ?? 0,
      indexes: result.solutionIndices,
      points: result.score,
    });
  }

  // Sends a message to the iframe host with the changes.
  private postScoreToHost(score: Score) {
    let kms = '';
    let circuit = '';
    if (score.distanceM && window.parent) {
      kms = (score.distanceM / 1000).toFixed(1);
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
    const points = await addAltitude(this.getPathPoints());
    const modal = await modalController.create({
      component: 'waypoint-modal',
      componentProps: { points },
    });
    await modal.present();
  }

  private handlePathUpdates(): void {
    if (this.line && !this.doNotSyncState) {
      pushCurrentState();
      store.dispatch(setRoute(google.maps.geometry.encoding.encodePath(this.line.getPath())));
    }
    this.optimize();
  }

  // Creates the planner element lazily.
  private createPlannerElement(map: google.maps.Map): void {
    if (this.plannerElement) {
      return;
    }
    if (!this.plannerElement) {
      const el = (this.plannerElement = document.createElement('planner-element') as PlannerElement);
      map.controls[google.maps.ControlPosition.RIGHT_TOP].push(el);
      el.addEventListener('close-flight', () => {
        const path = (this.line as google.maps.Polyline).getPath();
        const last = path.getAt(path.getLength() - 1);
        const first = path.getAt(0);
        if (!first.equals(last)) {
          path.push(first);
        }
      });
      el.addEventListener('share', async () => {
        const points = await addAltitude(this.getPathPoints());
        const modal = await modalController.create({
          component: 'share-modal',
          componentProps: {
            link: getCurrentUrl().href,
            points,
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
      el.addEventListener('close', () => store.dispatch(setEnabled(false)));
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
