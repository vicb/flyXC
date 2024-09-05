import '../ui/share-modal';
import '../ui/waypoint-modal';

import type { LatLon, RuntimeTrack } from '@flyxc/common';
import { CircuitType } from '@flyxc/optimizer/lib/api';
import type { ScoringResult } from '@flyxc/optimizer/lib/optimizer';
import { modalController, toastController } from '@ionic/core/components';
import { getPreciseDistance } from 'geolib';
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
import { Scorer } from '../../logic/score/scorer';
import * as plannerSlice from '../../redux/planner-slice';
import { currentTrack } from '../../redux/selectors';
import type { RootState } from '../../redux/store';
import { store } from '../../redux/store';
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

  private currentTrack?: RuntimeTrack;
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
  private scorer?: Scorer;
  private toastScoring?: HTMLIonToastElement;

  stateChanged(state: RootState): void {
    this.currentTrack = currentTrack(state);
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
    if (this.encodedRoute.length === 0) {
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
      if (event.vertex !== undefined) {
        const path = line.getPath();
        if (path.getLength() > 2) {
          path.removeAt(event.vertex);
        }
      }
    });
    google.maps.event.addListener(line, 'dblclick', (event: google.maps.PolyMouseEvent): void => {
      if (event.vertex !== undefined) {
        const path = line.getPath();
        if (path.getLength() > 2) {
          path.removeAt(event.vertex);
        }
      }
    });
    this.onPointAddeded = google.maps.event.addListener(this.map, 'rightclick', (e: google.maps.MapMouseEvent) =>
      this.appendToPath(e.latLng as google.maps.LatLng),
    );
    this.onBoundsChanged = google.maps.event.addListener(this.map, 'bounds_changed', () => {
      if (this.enabled && this.encodedRoute.length === 0) {
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

  // Optimize the route.
  private optimize(): void {
    const { line } = this;
    if (!line || line.getPath().getLength() < 2 || this.doNotSyncState) {
      return;
    }

    const points = this.getPathPoints().map((point, i) => ({ ...point, alt: 0, timeSec: i * 60 }));

    this.getScorer().score(points, this.league, (result) => this.drawOptimization(result));
  }

  // Lazily create and get scorer
  private getScorer() {
    this.scorer ??= new Scorer();
    return this.scorer;
  }

  private drawOptimization(result: ScoringResult): void {
    this.optimizedLine ??= new google.maps.Polyline();

    this.optimizedLine.setOptions({
      map: this.map,
      path: result.path,
      strokeColor: ROUTE_STROKE_COLORS[result.circuit],
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
      this.closingSector.radiusM = (result.closingRadiusKm ?? 0) * 1000;
      this.closingSector.update();
      this.closingSector.setMap(this.map);
    } else {
      this.closingSector.setMap(null);
    }

    if (!this.faiSectors) {
      this.faiSectors = new FaiSectors();
      this.faiSectors.addListeners('rightclick', (e) => this.appendToPath(e.latLng));
    }
    if (result.circuit == CircuitType.FlatTriangle || result.circuit == CircuitType.FaiTriangle) {
      this.faiSectors.update(result.turnpoints);
      this.faiSectors.setMap(this.map);
    } else {
      this.faiSectors.setMap(null);
    }

    store.dispatch(plannerSlice.setScore(result));
    // FFVL/CFD
    this.postScoreToHost(result);
  }

  // Sends a message to the iframe host with the changes.
  private postScoreToHost(scoringResult: ScoringResult) {
    let kms = '';
    let circuit = '';
    if (scoringResult.lengthKm !== 0 && window.parent) {
      kms = scoringResult.lengthKm.toFixed(1);
      circuit = CIRCUIT_SHORT_NAME[scoringResult.circuit];
      if (scoringResult.circuit === CircuitType.OpenDistance) {
        circuit += scoringResult.solutionIndices.length - 2;
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
    if (!this.line) {
      return;
    }
    const path = this.line.getPath();
    if (!this.doNotSyncState) {
      pushCurrentState();
      store.dispatch(plannerSlice.setRoute(google.maps.geometry.encoding.encodePath(path)));
    }
    let distanceM = 0;
    const latlonPath = path.getArray().map((latLng) => ({ lat: latLng.lat(), lon: latLng.lng() }));
    for (let i = 1; i < latlonPath.length; i++) {
      distanceM += getPreciseDistance(latlonPath[i - 1], latlonPath[i]);
    }
    store.dispatch(plannerSlice.setDistanceM(distanceM));
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
      el.addEventListener('reset', () => store.dispatch(plannerSlice.setRoute('')));
      el.addEventListener('draw-route', () => {
        drawRoute.emit();
        store.dispatch(plannerSlice.setRoute(''));
      });
      el.addEventListener('close', () => store.dispatch(plannerSlice.setEnabled(false)));
      el.addEventListener('score-track', async () => {
        // TODO: return if already running
        if (!this.currentTrack) {
          return;
        }

        // TODO: dialog if too long
        this.toastScoring = await toastController.create({
          message: 'Scoring in progress',
          position: 'middle',
          duration: 30000,
        });
        await this.toastScoring.present();

        const track = this.currentTrack;
        const points = track.lat.map((lat, index) => ({
          lat,
          lon: track.lon[index],
          alt: track.alt[index],
          timeSec: track.timeSec[index],
        }));
        this.getScorer().score(points, this.league, async (result) => {
          this.handleScoringResult(result);
          await this.toastScoring?.dismiss();
        });
      });
    }
  }

  private handleScoringResult(result: ScoringResult) {
    if (this.currentTrack && this.currentTrack.timeSec.length > 1) {
      const lastTimeSec = this.currentTrack.timeSec.at(-1)!;
      const durationS = lastTimeSec - this.currentTrack.timeSec[0];
      store.dispatch(plannerSlice.setSpeedKmh((result.lengthKm / durationS) * 3600));
      store.dispatch(plannerSlice.setRoute(google.maps.geometry.encoding.encodePath(result.path)));
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
    this.scorer?.cleanup();
    this.scorer = undefined;
  }
}
