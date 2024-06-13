import type { RuntimeTrack } from '@flyxc/common';
import type { ScoringResult } from '@flyxc/optimizer/lib/optimizer';
import type { CSSResult, TemplateResult } from 'lit';
import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { when } from 'lit/directives/when.js';
import { connect } from 'pwa-helpers';

import type { LeagueCode } from '../../logic/score/league/leagues';
import type { Score } from '../../logic/score/scorer';
import { ScoreOrigin, Scorer } from '../../logic/score/scorer';
import * as units from '../../logic/units';
import { decrementSpeed, incrementSpeed, setDistanceM, setScore, setSpeedKmh } from '../../redux/planner-slice';
import { currentTrack } from '../../redux/selectors';
import type { RootState } from '../../redux/store';
import { store } from '../../redux/store';

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
  private score?: Score;
  @state()
  private speedKmh = 20;
  @state()
  private units?: units.Units;
  @state()
  private distanceM = 0;
  @state()
  private hideDetails = store.getState().browser.isSmallScreen;
  @state()
  private isFreeDrawing = false;
  @state()
  private currentTrack?: RuntimeTrack;
  @state()
  private league: LeagueCode = 'xc';

  private duration?: number;
  private readonly closeHandler = () => this.dispatchEvent(new CustomEvent('close'));
  private readonly closeFlightHandler = () => this.dispatchEvent(new CustomEvent('close-flight'));
  private readonly shareHandler = () => this.dispatchEvent(new CustomEvent('share'));
  private readonly downloadHandler = () => this.dispatchEvent(new CustomEvent('download'));
  private readonly resetHandler = () => this.dispatchEvent(new CustomEvent('reset'));
  private readonly drawHandler = () => this.dispatchEvent(new CustomEvent('draw-route'));
  private scoringRequestId = 0;
  private scorer?: Scorer;

  stateChanged(state: RootState): void {
    this.distanceM = state.planner.distanceM;
    this.score = state.planner.score;
    this.speedKmh = state.planner.speedKmh;
    this.units = state.units;
    this.duration = ((this.distanceM / this.speedKmh) * 60) / 1000;
    this.isFreeDrawing = state.planner.isFreeDrawing;
    this.currentTrack = currentTrack(state);
    this.league = state.planner.league;
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.scorer?.cleanup();
    this.scorer = undefined;
  }

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
    `;
  }

  protected render(): TemplateResult {
    if (this.score == null || this.units == null) {
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
          <div>${this.score.circuit}</div>
          <div class="large">
            ${unsafeHTML(units.formatUnit(this.score.lengthKm, this.units.distance, undefined, 'unit'))}
          </div>
        </div>
        <div class="collapsible">
          <div>Points = ${this.getMultiplier()}</div>
          <div class="large">${this.getScore()}</div>
        </div>
        <div class="collapsible">
          <div>Total distance</div>
          <div class="large">
            ${unsafeHTML(units.formatUnit(this.distanceM / 1000, this.units.distance, undefined, 'unit'))}
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
            ${unsafeHTML(units.formatUnit(this.speedKmh as number, this.units.speed, undefined, 'unit'))}
          </div>
        </div>
        ${when(
          this.currentTrack,
          () => html` <div class="collapsible hoverable" @click=${this.handleScoreAction}>
            <span><i class="las la-trophy"></i>Score Track</span>
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
    return this.score?.multiplier === 1 ? 'kms' : `${this.score?.multiplier} x kms`;
  }

  private getScore() {
    return this.score?.score.toFixed(1) ?? '';
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
    store.dispatch(setSpeedKmh(this.distanceM / ((1000 * Math.max(15, duration)) / 60)));
  }

  private wheelDuration(e: WheelEvent): void {
    const delta = Math.sign(e.deltaY);
    const duration = (Math.floor((this.duration as number) / 15) + delta) * 15;
    store.dispatch(setSpeedKmh(this.distanceM / ((1000 * Math.max(15, duration)) / 60)));
  }

  private changeSpeed(e: MouseEvent): void {
    const target = e.currentTarget as HTMLElement;
    const x = e.clientX - target.getBoundingClientRect().left;
    const width = target.clientWidth;
    store.dispatch(x > width / 2 ? incrementSpeed() : decrementSpeed());
  }

  private wheelSpeed(e: WheelEvent): void {
    store.dispatch(e.deltaY > 0 ? incrementSpeed() : decrementSpeed());
  }

  private handleScoreAction() {
    if (!this.currentTrack) {
      return;
    }
    const track = this.currentTrack;
    const points = track.lat.map((lat, index) => ({
      lat,
      lon: track.lon[index],
      alt: track.alt[index],
      timeSec: track.timeSec[index],
    }));
    this.scorer ??= new Scorer(
      (result) => this.handleScoringResult(result),
      () => this.scoringRequestId,
    );
    this.scorer.score(points, this.league, ++this.scoringRequestId);
  }

  private handleScoringResult(result: ScoringResult) {
    store.dispatch(setScore({ ...result, origin: ScoreOrigin.TRACK }));
    if (this.currentTrack && this.currentTrack.timeSec.length > 1) {
      const lastTimeSec = this.currentTrack.timeSec.at(-1)!;
      const durationS = lastTimeSec - this.currentTrack.timeSec[0];
      store.dispatch(setSpeedKmh((result.lengthKm / durationS) * 3600));
      this.duration = durationS;
    }
    store.dispatch(setDistanceM(result.lengthKm * 1000));
  }
}
