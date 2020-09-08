import { css, CSSResult, customElement, html, internalProperty, LitElement, TemplateResult } from 'lit-element';
import { connect } from 'pwa-helpers';

import { decrementSpeed, incrementSpeed, setSpeed } from '../../actions';
import { Score } from '../../logic/score/scorer';
import { formatUnit } from '../../logic/units';
import { Units } from '../../reducers';
import { RootState, store } from '../../store';

@customElement('planner-element')
export class PlannerElement extends connect(store)(LitElement) {
  @internalProperty()
  private score?: Score;

  @internalProperty()
  private speed?: number;

  @internalProperty()
  private units?: Units;

  @internalProperty()
  private distance = 0;

  @internalProperty()
  // Don't display details by default when width is less than 640px.
  private detailed = window.matchMedia('(min-width: 640px)').matches;

  private duration?: number;

  stateChanged(state: RootState): void {
    this.distance = state.map.distance;
    this.score = state.map.score as Score;
    this.speed = state.map.speed as number;
    this.units = state.map.units;
    this.duration = ((this.distance / this.speed) * 60) / 1000;
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
        display: block;
      }

      .control > :last-child {
        display: block;
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
    `;
  }

  protected render(): TemplateResult {
    return this.score && this.units
      ? html`
          <style>
            .control > div {
              display: ${this.detailed ? 'block' : 'none'};
            }
          </style>
          <div class="control">
            <div>
              <div>${this.score.circuit}</div>
              <div class="large">${formatUnit(this.score.distance / 1000, this.units.distance)}</div>
            </div>
            <div>
              <div>Points = ${this.getMultiplier()}</div>
              <div class="large">${this.score.points.toFixed(1)}</div>
            </div>
            <div>
              <div>Total distance</div>
              <div class="large">${formatUnit(this.distance / 1000, this.units.distance)}</div>
            </div>
            <div @mousemove=${this.onMouseMove} @click=${this.changeDuration} @wheel=${this.wheelDuration}>
              <div>
                <span>Duration</span>
                <div class="decrement">
                  <img
                    alt="Reduce duration"
                    src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAkAAAAJAQMAAADaX5RTAAAABlBMVEX///9xe4e/5menAAAAE0lEQVQImWP438DQAEP7kNj/GwCK4wo9HA2mvgAAAABJRU5ErkJggg=="
                    height="9"
                    width="9"
                  />
                </div>
                <div class="increment">
                  <img
                    alt="Increase duration"
                    src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAkAAAAJAQMAAADaX5RTAAAABlBMVEX///9xe4e/5menAAAAGElEQVQImWP438DQ0MDQAUb7YAygyP8GAIyjCl0WJTcvAAAAAElFTkSuQmCC"
                    height="9"
                    width="9"
                  />
                </div>
              </div>
              <div class="large">${this.getDuration()}</div>
            </div>
            <div @mousemove=${this.onMouseMove} @click=${this.changeSpeed} @wheel=${this.wheelSpeed}>
              <div>
                <span>Speed</span>
                <div class="decrement">
                  <img
                    alt="Reduce speed"
                    src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAkAAAAJAQMAAADaX5RTAAAABlBMVEX///9xe4e/5menAAAAE0lEQVQImWP438DQAEP7kNj/GwCK4wo9HA2mvgAAAABJRU5ErkJggg=="
                    height="9"
                    width="9"
                  />
                </div>
                <div class="increment">
                  <img
                    alt="Increase speed"
                    src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAkAAAAJAQMAAADaX5RTAAAABlBMVEX///9xe4e/5menAAAAGElEQVQImWP438DQ0MDQAUb7YAygyP8GAIyjCl0WJTcvAAAAAElFTkSuQmCC"
                    height="9"
                    width="9"
                  />
                </div>
              </div>
              <div class="large">${formatUnit(this.speed as number, this.units.speed)}</div>
            </div>
            <div @click=${() => this.dispatchEvent(new CustomEvent('close-flight'))}>
              <div>Close flight</div>
            </div>
            <div @click=${() => this.dispatchEvent(new CustomEvent('share'))}>
              <div>Share</div>
            </div>
            <div @click=${() => this.dispatchEvent(new CustomEvent('download'))}>
              <div>Download</div>
            </div>
            <div @click=${() => this.dispatchEvent(new CustomEvent('reset'))}>
              <div>Reset</div>
            </div>
            <div @click=${() => (this.detailed = !this.detailed)}>
              <div>
                ${this.detailed
                  ? html`
                      <img
                        height="5"
                        width="8"
                        src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAADAQAAAABzTfhVAAAADklEQVQImWO4wdDBwAAABdYBYfESkFcAAAAASUVORK5CYII="
                      />
                    `
                  : html`
                      <img
                        height="5"
                        width="8"
                        src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAADAQAAAABzTfhVAAAADklEQVQImWNgYOhguAEAAnYBYaFuVa4AAAAASUVORK5CYII="
                      />
                    `}
              </div>
            </div>
          </div>
        `
      : html``;
  }

  private getMultiplier() {
    return this.score?.multiplier == 1 ? 'kms' : `${this.score?.multiplier} x kms`;
  }

  private getDuration(): string {
    const duration = this.duration as number;
    const hour = Math.floor(duration / 60);
    const minutes = Math.floor(duration % 60).toString();
    return `${hour}:${minutes.padStart(2, '0')}`;
  }

  private onMouseMove(e: MouseEvent): void {
    const target = e.currentTarget as HTMLElement;
    const width = target.clientWidth;
    const x = e.clientX - target.getBoundingClientRect().left;
    target.style.cursor = x > width / 2 ? 'n-resize' : 's-resize';
  }

  private changeDuration(e: MouseEvent): void {
    const target = e.currentTarget as HTMLElement;
    const width = target.clientWidth;
    const x = e.clientX - target.getBoundingClientRect().left;
    const delta = x > width / 2 ? 1 : -1;
    const duration = (Math.floor((this.duration as number) / 15) + delta) * 15;
    store.dispatch(setSpeed(this.distance / ((1000 * Math.max(15, duration)) / 60)));
  }

  private wheelDuration(e: WheelEvent): void {
    const delta = Math.sign(e.deltaY);
    const duration = (Math.floor((this.duration as number) / 15) + delta) * 15;
    store.dispatch(setSpeed(this.distance / ((1000 * Math.max(15, duration)) / 60)));
  }

  private changeSpeed(e: MouseEvent): void {
    const target = e.currentTarget as HTMLElement;
    const width = target.clientWidth;
    const x = e.clientX - target.getBoundingClientRect().left;
    store.dispatch(x > width / 2 ? incrementSpeed() : decrementSpeed());
  }

  private wheelSpeed(e: WheelEvent): void {
    store.dispatch(e.deltaY > 0 ? incrementSpeed() : decrementSpeed());
  }
}
