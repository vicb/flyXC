import { css, CSSResult, html, LitElement, PropertyValues, TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { when } from 'lit/directives/when.js';
import { connect } from 'pwa-helpers';

import { computeScore, getSampledTrack, getTrackLengthKm } from '../../logic/score/scorer';
import * as units from '../../logic/units';
import * as planner from '../../redux/planner-slice';
import { RootState, store } from '../../redux/store';
import { RuntimeTrack } from '@flyxc/common';
import { currentLeague, currentTrack } from '../../redux/selectors';

const ICON_MINUS =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAkAAAAJAQMAAADaX5RTAAAABlBMVEX///9xe4e/5menAAAAE0lEQVQImWP438DQAEP7kNj/GwCK4wo9HA2mvgAAAABJRU5ErkJggg==';
const ICON_PLUS =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAkAAAAJAQMAAADaX5RTAAAABlBMVEX///9xe4e/5menAAAAGElEQVQImWP438DQ0MDQAUb7YAygyP8GAIyjCl0WJTcvAAAAAElFTkSuQmCC';
const ICON_COLLAPSE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAADAQAAAABzTfhVAAAADklEQVQImWO4wdDBwAAABdYBYfESkFcAAAAASUVORK5CYII=';
const ICON_EXPAND =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAADAQAAAABzTfhVAAAADklEQVQImWNgYOhguAEAAnYBYaFuVa4AAAAASUVORK5CYII=';

@customElement('planner-element')
export class PlannerElement extends connect(store)(LitElement) {
  @state()
  private scoringInfo?: planner.ScoringInfo;
  @state()
  private speed = 20;
  @state()
  private units?: units.Units;
  @state()
  private distance = 0;
  @state()
  private hideDetails = store.getState().browser.isSmallScreen;
  @state()
  private isFreeDrawing = false;
  @state()
  private track: RuntimeTrack | undefined;

  private duration?: number;
  private readonly closeHandler = () => this.dispatchEvent(new CustomEvent('close'));
  private readonly closeFlightHandler = () => this.dispatchEvent(new CustomEvent('close-flight'));
  private readonly shareHandler = () => this.dispatchEvent(new CustomEvent('share'));
  private readonly downloadHandler = () => this.dispatchEvent(new CustomEvent('download'));
  private readonly resetHandler = () => this.dispatchEvent(new CustomEvent('reset'));
  private readonly drawHandler = () => this.dispatchEvent(new CustomEvent('draw-route'));

  static get styles(): CSSResult {
    return css`
      :host {
        display: block;
        opacity: 0.9;
        user-select: none;
      }

      .control {
        user-select: none;
        text-align: center;
        position: relative;
        box-shadow: rgba(0, 0, 0, 0.4), 0, 2px, 4px;
        background-color: #fff;
        border-radius: 4px;
        color: #000;
        font-size: 13px;
        margin: 0 5px;
        min-width: 106px;
        cursor: pointer;
        min-height: 2em;
      }

      .control > div {
        border: solid 1px #717b87;
        border-top: 0;
        padding: 4px;
      }

      .control > :first-child {
        border-radius: 4px 4px 0 0;
        border-top: solid 1px #717b87;
        padding: 4px 0px;
      }

      .control > :last-child {
        border-radius: 0 0 4px 4px;
      }

      .large {
        font-size: 24px !important;
        font-weight: bold !important;
        overflow: hidden;
      }

      .decrement {
        float: left;
        padding-left: 6px;
      }

      .increment {
        float: right;
        padding-right: 6px;
      }

      .unit {
        color: darkgray;
        font-size: 0.7em;
      }

      .emphasis {
        color: orange;
        font-weight: bold !important;
        font-size: 14px;
      }
    `;
  }

  stateChanged(state: RootState): void {
    this.distance = state.planner.distance;
    this.scoringInfo = state.planner.scoringInfo;
    this.speed = state.planner.speed;
    this.units = state.units;
    this.duration = ((this.distance / this.speed) * 60) / 1000;
    this.isFreeDrawing = state.planner.isFreeDrawing;
    this.track = currentTrack(state);
  }

  protected shouldUpdate(changedProperties: PropertyValues): boolean {
    if (changedProperties.has('isComputing')) {
      this.render();
    }
    return super.shouldUpdate(changedProperties);
  }

  protected render(): TemplateResult {
    if (this.scoringInfo == null || this.units == null) {
      return html``;
    }
    return html`
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/line-awesome@1/dist/line-awesome/css/line-awesome.min.css"
      />
      <style>
        .collapsible {
          display: ${this.hideDetails ? 'none' : 'block'};
        }
        .active {
          background-color: lightgray;
        }
        .hoverable:hover {
          background-color: #f0f0f0;
        }
      </style>
      <div class="control">
        <div @click=${this.closeHandler} class="hoverable">
          <div><i class="las la-times-circle"></i> Close</div>
        </div>
        <div>
          <div>${this.scoringInfo.score.circuit}</div>
          <div class="large">
            ${unsafeHTML(
              units.formatUnit(this.scoringInfo.score.distanceM / 1000, this.units.distance, undefined, 'unit'),
            )}
          </div>
        </div>
        <div class="collapsible">
          <div>Points = ${this.getMultiplier()}</div>
          <div class="large">${this.scoringInfo.score.points.toFixed(1)}</div>
        </div>
        <div class="collapsible">
          <div>Total distance</div>
          <div class="large">
            ${unsafeHTML(units.formatUnit(this.distance / 1000, this.units.distance, undefined, 'unit'))}
          </div>
        </div>
        <div
          class="collapsible"
          @mousemove=${this.onMouseMove}
          @click=${this.changeDuration}
          @wheel=${this.wheelDuration}
        >
          <div>
            <span>Duration</span>
            <div class="decrement">
              <img alt="Reduce duration" src=${ICON_MINUS} height="9" width="9" />
            </div>
            <div class="increment">
              <img alt="Increase duration" src=${ICON_PLUS} height="9" width="9" />
            </div>
          </div>
          <div class="large">${this.getDuration()}</div>
        </div>
        <div class="collapsible" @mousemove=${this.onMouseMove} @click=${this.changeSpeed} @wheel=${this.wheelSpeed}>
          <div>
            <span>Speed</span>
            <div class="decrement">
              <img alt="Reduce speed" src=${ICON_MINUS} height="9" width="9" />
            </div>
            <div class="increment">
              <img alt="Increase speed" src=${ICON_PLUS} height="9" width="9" />
            </div>
          </div>
          <div class="large">
            ${unsafeHTML(units.formatUnit(this.speed as number, this.units.speed, undefined, 'unit'))}
          </div>
        </div>
        ${when(
          this.track,
          () => html` <div class="collapsible hoverable" @click="${this.scoreCurrentTrack}">
            <span class="emphasis">🆕<i class="las la-trophy"></i>Score Track🆕</span>
          </div>`,
        )}
        <div
          @click=${this.drawHandler}
          class=${when(
            this.isFreeDrawing,
            () => 'active',
            () => 'hoverable',
          )}
        >
          <div><i class="las la-pen"></i> Free draw</div>
        </div>
        <div class="collapsible hoverable" @click=${this.closeFlightHandler}>
          <div><i class="las la-redo-alt"></i> Close flight</div>
        </div>
        <div class="collapsible hoverable" @click=${this.shareHandler}>
          <div><i class="las la-share"></i> Share</div>
        </div>
        <div class="collapsible hoverable" @click=${this.downloadHandler}>
          <div><i class="las la-cloud-download-alt"></i> Download</div>
        </div>
        <div class="collapsible hoverable" @click=${this.resetHandler}>
          <div><i class="las la-broom"></i> Reset</div>
        </div>
        <div @click=${() => (this.hideDetails = !this.hideDetails)} class="hoverable">
          <div>
            ${this.hideDetails
              ? html` <img height="5" width="8" src=${ICON_EXPAND} /> `
              : html` <img height="5" width="8" src=${ICON_COLLAPSE} /> `}
          </div>
        </div>
      </div>
    `;
  }

  private getMultiplier() {
    return this.scoringInfo?.score.multiplier == 1 ? 'kms' : `${this.scoringInfo?.score.multiplier} x kms`;
  }

  private getDuration(): string {
    const duration = this.duration as number;
    const hour = Math.floor(duration / 60);
    const minutes = Math.floor(duration % 60).toString();
    return `${hour}:${minutes.padStart(2, '0')}`;
  }

  private onMouseMove(e: MouseEvent): void {
    const target = e.currentTarget as HTMLElement;
    const x = e.clientX - target.getBoundingClientRect().left;
    const width = target.clientWidth;
    target.style.cursor = x > width / 2 ? 'n-resize' : 's-resize';
  }

  private changeDuration(e: MouseEvent): void {
    const target = e.currentTarget as HTMLElement;
    const x = e.clientX - target.getBoundingClientRect().left;
    const width = target.clientWidth;
    const delta = x > width / 2 ? 1 : -1;
    const duration = (Math.floor((this.duration as number) / 15) + delta) * 15;
    store.dispatch(planner.setSpeed(this.distance / ((1000 * Math.max(15, duration)) / 60)));
  }

  private wheelDuration(e: WheelEvent): void {
    const delta = Math.sign(e.deltaY);
    const duration = (Math.floor((this.duration as number) / 15) + delta) * 15;
    store.dispatch(planner.setSpeed(this.distance / ((1000 * Math.max(15, duration)) / 60)));
  }

  private changeSpeed(e: MouseEvent): void {
    const target = e.currentTarget as HTMLElement;
    const x = e.clientX - target.getBoundingClientRect().left;
    const width = target.clientWidth;
    store.dispatch(x > width / 2 ? planner.incrementSpeed() : planner.decrementSpeed());
  }

  private wheelSpeed(e: WheelEvent): void {
    store.dispatch(e.deltaY > 0 ? planner.incrementSpeed() : planner.decrementSpeed());
  }

  // compute score on the current selected track
  private scoreCurrentTrack() {
    if (this.track) {
      const track = this.track;
      const points = track.lat.map((lat, index) => {
        return { lat, lon: track.lon[index], alt: track.alt[index], timeSec: track.timeSec[index] };
      });
      const score = computeScore(points, currentLeague(store.getState()));
      const scoringInfo = { score, points, useCurrentTrack: true };
      store.dispatch(planner.setScoringInfo(scoringInfo));
      const durationS = points.at(-1)!.timeSec - points[0].timeSec;
      const durationH = durationS / 3600;
      // to
      const sampledTrack = getSampledTrack(points, 15 * 60);
      score.indexes.forEach((index) => sampledTrack.push(points[index]));
      // negative if a is less than b
      sampledTrack.sort((a, b) => {
        if (a.timeSec < b.timeSec) {
          return -1;
        } else if (a.timeSec > b.timeSec) {
          return 1;
        }
        return 0;
      });
      sampledTrack.push(points.at(-1)!)
      store.dispatch(planner.setSampledTrack(sampledTrack));
      const sampledTrackLengthKm = getTrackLengthKm(sampledTrack);
      this.duration = durationS;
      this.distance = sampledTrackLengthKm;
      store.dispatch(planner.setSpeed(sampledTrackLengthKm / durationH));
      store.dispatch(planner.setDistance(sampledTrackLengthKm * 1000));
    }
  }
}
