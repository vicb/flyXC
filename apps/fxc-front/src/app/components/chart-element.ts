import type { Class, RuntimeTrack, Type } from '@flyxc/common';
import { Flags, isAirspaceVisible, sampleAt } from '@flyxc/common';
import { ticks } from 'd3-array';
import type { CSSResult, PropertyValues, SVGTemplateResult, TemplateResult } from 'lit';
import { css, html, LitElement, svg } from 'lit';
import { customElement, query, state } from 'lit/decorators.js';
import { guard } from 'lit/directives/guard.js';
import { connect } from 'pwa-helpers';

import * as units from '../logic/units';
import { ChartYAxis, setChartYAxis } from '../redux/app-slice';
import * as sel from '../redux/selectors';
import type { RootState} from '../redux/store';
import { store } from '../redux/store';

const MIN_SPEED_FACTOR = 16;
const MAX_SPEED_FACTOR = 4096;
const PLAY_INTERVAL_MILLIS = 50;

function getAirspaceCssClass(flags: number): string {
  if (flags & Flags.AirspaceProhibited) {
    return `prohibited`;
  }
  if (flags & Flags.AirspaceRestricted) {
    return `restricted`;
  }
  if (flags & Flags.AirspaceDanger) {
    return `danger`;
  }
  return `other`;
}

@customElement('chart-element')
export class ChartElement extends connect(store)(LitElement) {
  @state()
  private tracks: RuntimeTrack[] = [];
  @state()
  private chartYAxis: ChartYAxis = ChartYAxis.Altitude;
  @state()
  private timeSec = 0;
  @state()
  private width = 0;
  @state()
  private height = 0;
  @state()
  private units?: units.Units;
  @state()
  private showClasses: Class[] = [];
  @state()
  private showTypes: Type[] = [];
  @state()
  private currentTrackId?: string;
  @state()
  private playSpeed = 64;
  @state()
  private playTimer?: number;
  @state()
  private trackColors: { [id: string]: string } = {};

  // Last time the track animation was paused and corresponding timestamp
  private lastPauseMs = 0;
  private lastPauseTimestampSec = 0;

  @query('#thumb')
  private thumbElement?: SVGLineElement;

  // mins, maxs and offsets are in seconds.
  private minTimeSec = 0;
  private maxTimeSec = 1;
  private offsetSeconds: { [id: string]: number } = {};
  // Throttle timestamp and airspace updates.
  private nextTimestampUpdate = 0;
  private sizeListener = () => this.updateSize();

  stateChanged(state: RootState): void {
    this.tracks = sel.tracks(state);
    this.chartYAxis = state.app.chartYAxis;
    this.timeSec = state.app.timeSec;
    this.minTimeSec = sel.minTimeSec(state);
    this.maxTimeSec = sel.maxTimeSec(state);
    this.units = state.units;
    this.offsetSeconds = sel.offsetSeconds(state);
    this.showClasses = state.airspace.showClasses;
    this.showTypes = state.airspace.showTypes;
    this.currentTrackId = state.track.currentTrackId;
    this.trackColors = sel.trackColors(state);
  }

  private get minY(): number {
    const state = store.getState();
    switch (this.chartYAxis) {
      case ChartYAxis.Speed:
        return sel.minSpeed(state);
      case ChartYAxis.Vario:
        return sel.minVario(state);
      default:
        return sel.minAlt(state);
    }
  }

  private get maxY(): number {
    const state = store.getState();
    switch (this.chartYAxis) {
      case ChartYAxis.Speed:
        return sel.maxSpeed(state);
      case ChartYAxis.Vario:
        return sel.maxVario(state);
      default:
        return sel.maxAlt(state);
    }
  }

  // time is in seconds.
  private getY(track: RuntimeTrack, timeSec: number): number {
    switch (this.chartYAxis) {
      case ChartYAxis.Speed:
        return sampleAt(track.timeSec, track.vx, timeSec);
      case ChartYAxis.Vario:
        return sampleAt(track.timeSec, track.vz, timeSec);
      default:
        return sampleAt(track.timeSec, track.alt, timeSec);
    }
  }

  private getYUnit(): units.DistanceUnit | units.SpeedUnit {
    const logUnits = this.units as units.Units;
    switch (this.chartYAxis) {
      case ChartYAxis.Speed:
        return logUnits.speed;
      case ChartYAxis.Vario:
        return logUnits.vario;
      default:
        return logUnits.altitude;
    }
  }

  static get styles(): CSSResult[] {
    return [
      css`
        :host {
          display: block;
          width: 100%;
          height: 100%;
          position: relative;
          font: 12px 'Nobile', verdana, sans-serif;
        }
        #chart {
          touch-action: none;
        }
        .paths {
          fill: none;
        }
        .gnd {
          stroke: #755445;
          fill: #755445;
          fill-opacity: 0.8;
        }
        .asp {
          stroke: #808080;
          fill: #808080;
          fill-opacity: 0.2;
          stroke-opacity: 0.3;
        }
        .asp.prohibited {
          stroke: #bf4040;
          fill: #bf4040;
        }
        .asp.restricted {
          stroke: #bfbf40;
          fill: #bfbf40;
        }
        .asp.danger {
          stroke: #bf8040;
          fill: #bf8040;
        }
        .axis {
          stroke: lightgray;
          fill: none;
          stroke-width: 0.5px;
        }
        .ticks {
          font: 10px sans-serif;
          user-select: none;
          pointer-events: none;
          stroke-width: 0.5px;
          fill: black;
          stroke: white;
          stroke-width: 0;
        }
        #thumb {
          stroke: gray;
          fill: none;
          stroke-width: 1.5px;
        }
        path {
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-opacity: 0.6;
          stroke-width: 1;
        }
        path.active {
          stroke-width: 1.5;
          stroke-opacity: 1;
        }
        #ct {
          position: absolute;
          top: 3px;
          right: 3px;
          height: 1px;
        }
        select {
          font: inherit;
          clear: both;
          float: right;
        }
        .control {
          display: block;
          float: right;
          border: 1px inset #555;
          padding: 4px;
          margin: 2px 2px 0 0;
          text-align: right;
          border-radius: 4px;
          opacity: 0.5;
          user-select: none;
          background-color: white;
          clear: both;
          cursor: pointer;
        }
        .control:hover {
          background-color: #adff2f;
          opacity: 0.9;
        }
        .hidden-mobile {
          display: inline-block;
        }
        @media (max-width: 767px) {
          .hidden-mobile {
            display: none;
          }
        }
      `,
    ];
  }

  connectedCallback(): void {
    super.connectedCallback();
    new ResizeObserver(this.sizeListener).observe(this);
    // Sometimes the SVG has a 0x0 size when opened in a new window.
    if (document.visibilityState != 'visible') {
      document.addEventListener('visibilitychange', () => setTimeout(this.sizeListener, 500));
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('resize', this.sizeListener);
    document.removeEventListener('visibilitychange', this.sizeListener);
  }

  shouldUpdate(changedProps: PropertyValues): boolean {
    if (changedProps.has('timeSec')) {
      if (this.thumbElement) {
        const x = String(this.getXAtTimeSec(this.timeSec));
        this.thumbElement.setAttribute('x1', x);
        this.thumbElement.setAttribute('x2', x);
      }
      changedProps.delete('timeSec');
    }
    return super.shouldUpdate(changedProps);
  }

  protected render(): TemplateResult {
    return html`
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/line-awesome@1/dist/line-awesome/css/line-awesome.min.css"
      />
      <svg
        id="chart"
        xmlns="http://www.w3.org/2000/svg"
        @pointermove=${this.handlePointerMove}
        @pointerdown=${this.handlePointerDown}
        @wheel=${this.handleMouseWheel}
        width=${this.width}
        height=${this.height}
      >
        <defs>
          <filter id="shadow-active">
            <feGaussianBlur in="SourceAlpha" stdDeviation="1.5"></feGaussianBlur>
            <feMerge>
              <feMergeNode></feMergeNode>
              <feMergeNode in="SourceGraphic"></feMergeNode>
            </feMerge>
          </filter>
          <filter id="shadow">
            <feGaussianBlur in="SourceAlpha" stdDeviation="0.5"></feGaussianBlur>
            <feMerge>
              <feMergeNode></feMergeNode>
              <feMergeNode in="SourceGraphic"></feMergeNode>
            </feMerge>
          </filter>
        </defs>
        <rect width="100%" height="100%" fill="white" />
        ${guard(
          [this.tracks, this.showClasses, this.showTypes, this.width, this.height, this.chartYAxis],
          () => svg`<g class="paths">${this.paths()}</g>`,
        )}
        ${guard(
          [this.tracks, this.width, this.height, this.chartYAxis],
          () => svg`<g class="axis">${this.axis()}</g>
        <g class="ticks">${this.yTexts()}</g>
        <g class="ticks">${this.xTexts()}</g>`,
        )}
        <line id="thumb" x1="0" x2="0" y2="100%"></line>
      </svg>
      <div id="ct">
        <select @change=${this.handleYChange}>
          <option value=${ChartYAxis.Altitude} selected>Altitude</option>
          <option value=${ChartYAxis.Speed}>Speed</option>
          <option value=${ChartYAxis.Vario}>Vario</option>
        </select>
        <div class="control">
          <i
            class="la la-2x la-chevron-down"
            @click=${() => (this.playSpeed = Math.max(MIN_SPEED_FACTOR, this.playSpeed / 2))}
            style=${`visibility: ${this.playSpeed == MIN_SPEED_FACTOR ? 'hidden' : 'visible'}`}
          ></i>
          <span class="hidden-mobile" style="vertical-align: .3em;">${this.playSpeed}x</span>
          <i
            class="la la-2x la-chevron-up"
            @click=${() => (this.playSpeed = Math.min(MAX_SPEED_FACTOR, this.playSpeed * 2))}
            style=${`visibility: ${this.playSpeed == MAX_SPEED_FACTOR ? 'hidden' : 'visible'}`}
          ></i>
          <i class=${`la la-2x ${this.playTimer ? 'la-pause' : 'la-play'}`} @click="${this.handlePlay}"></i>
        </div>
      </div>
    `;
  }

  protected firstUpdated(): void {
    // Wait for the element to get a size.
    // Then `updateSize()` will trigger a re-render by updating properties.
    // It helps with Safari which needs explicit width and height.
    // See
    const timeout = Date.now() + 5000;
    const waitForSize = () => {
      if (this.clientWidth > 0) {
        this.updateSize();
      } else if (Date.now() < timeout) {
        setTimeout(waitForSize, 50);
      }
    };
    waitForSize();
  }

  private paths(): TemplateResult[] {
    const paths: TemplateResult[] = [];

    // Dot not render before the width is set.
    if (this.tracks.length == 0 || this.width < 50) {
      return paths;
    }

    let activePath: SVGTemplateResult | undefined;

    // Display the gnd elevation only if there is a single track & mode is altitude

    const displayGndAlt = this.tracks.length == 1 && this.chartYAxis == ChartYAxis.Altitude;

    this.tracks.forEach((track) => {
      if (track.timeSec.length < 5) {
        return;
      }
      // Span of the track on the X axis.
      const offsetSeconds = this.offsetSeconds[track.id];
      const minX = this.getXAtTimeSec(track.timeSec[0], offsetSeconds);
      const maxX = this.getXAtTimeSec(track.timeSec[track.timeSec.length - 1], offsetSeconds);

      const trackCoords: string[] = [];
      const gndCoords = [`${minX},${this.getYAtHeight(this.minY).toFixed(1)}`];

      if (displayGndAlt && track.gndAlt) {
        paths.push(...this.airspacePaths(track));
      }
      for (let x = minX; x < maxX; x++) {
        const timeSec = this.getTimeSecAtX(x) + offsetSeconds;
        const y = this.getY(track, timeSec);
        trackCoords.push(`${x.toFixed(1)},${this.getYAtHeight(y).toFixed(1)}`);
        if (displayGndAlt && track.gndAlt) {
          const gndAlt = sampleAt(track.timeSec, track.gndAlt, timeSec);
          gndCoords.push(`${x.toFixed(1)},${this.getYAtHeight(gndAlt).toFixed(1)}`);
        }
      }
      gndCoords.push(`${maxX},${this.getYAtHeight(this.minY).toFixed(1)}`);
      if (displayGndAlt) {
        paths.push(svg`<path class=gnd d=${`M${gndCoords.join('L')}`}></path>`);
      }
      if (track.id == this.currentTrackId) {
        activePath = svg`<path class='active' stroke=${this.trackColors[track.id]} filter=url(#shadow-active)
          d=${`M${trackCoords.join('L')}`}></path>`;
      } else {
        paths.push(
          svg`<path stroke=${this.trackColors[track.id]} d=${`M${trackCoords.join('L')}`} filter=url(#shadow)></path>`,
        );
      }
    });

    // The active path should be drawn last to be on top of others.
    if (activePath) {
      paths.push(activePath);
    }

    return paths;
  }

  // Compute the SVG paths for the airspaces.
  private airspacePaths(track: RuntimeTrack): SVGTemplateResult[] {
    const airspaces = track.airspaces;
    if (airspaces == null) {
      return [];
    }
    const paths: SVGTemplateResult[] = [];

    for (let i = 0; i < airspaces.startSec.length; i++) {
      if (!isAirspaceVisible(airspaces.icaoClass[i], this.showClasses, airspaces.type[i], this.showTypes)) {
        continue;
      }
      const startSec = airspaces.startSec[i];
      const endSec = airspaces.endSec[i];
      const top = airspaces.top[i];
      const bottom = airspaces.bottom[i];
      const flags = airspaces.flags[i];
      const topRefGnd = flags & Flags.TopRefGnd;
      const bottomRefGnd = flags & Flags.FloorRefGnd;
      // When the bottom references the ground, it could be above the top at high elevations.
      // So we need to clamp it to the top. Same thing for the top
      const clampTo = {
        minAlt: bottomRefGnd ? Number.MIN_SAFE_INTEGER : bottom,
        maxAlt: topRefGnd ? Number.MAX_SAFE_INTEGER : top,
      };
      const coords = [
        // Bottom line
        ...this.aspLine(track, startSec, endSec, bottom, bottomRefGnd, clampTo),
        // Top line
        ...this.aspLine(track, endSec, startSec, top, topRefGnd, clampTo),
      ];
      if (coords.length < 4) {
        continue;
      }
      coords.push(coords[0]);
      const path = coords
        .map(([timeSec, alt]) => {
          const x = this.getXAtTimeSec(timeSec);
          const y = this.getYAtHeight(alt);
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join('L');
      paths.push(
        svg`<path data-start=${startSec} data-end=${endSec} class=${`asp ${getAirspaceCssClass(flags)}`} d=${
          'M' + path
        }></path>`,
      );
    }

    return paths;
  }

  private aspLine(
    track: RuntimeTrack,
    startSec: number,
    endSec: number,
    alt: number,
    refGnd: number,
    clampTo: { minAlt: number; maxAlt: number },
  ): Array<[number, number]> {
    if (!refGnd || !track.gndAlt) {
      return [
        [startSec, alt],
        [endSec, alt],
      ];
    }
    let reverse = false;
    if (startSec > endSec) {
      [startSec, endSec] = [endSec, startSec];
      reverse = true;
    }
    const startX = this.getXAtTimeSec(startSec);
    const endX = this.getXAtTimeSec(endSec);
    const points: Array<[number, number]> = [];

    for (let x = startX; x < endX; x++) {
      const timeSec = this.getTimeSecAtX(x);
      const gndAlt = sampleAt(track.timeSec, track.gndAlt, timeSec);
      let altitude = alt + gndAlt;
      altitude = Math.min(clampTo.maxAlt, altitude);
      altitude = Math.max(clampTo.minAlt, altitude);
      points.push([timeSec, altitude]);
    }
    return reverse ? points.reverse() : points;
  }

  private axis(): TemplateResult[] {
    const axis: TemplateResult[] = [];

    if (this.tracks) {
      const tks = ticks(this.minY, this.maxY, 4);

      tks.forEach((tick) => {
        // Draw line
        const y = this.getYAtHeight(tick);
        axis.push(svg`<line y1=${y.toFixed(1)} x2=${this.width} y2=${y}></line>`);
      });
    }

    return axis;
  }

  private yTexts(): TemplateResult[] {
    const texts: TemplateResult[] = [];

    if (this.tracks) {
      const tks = ticks(this.minY, this.maxY, 4);

      tks.forEach((tick) => {
        const y = this.getYAtHeight(tick);
        texts.push(
          svg`<text stroke-width=3 x=5 y=${y.toFixed(1)} dy=-2>${units.formatUnit(tick, this.getYUnit())}</text>
          <text x=5 y=${y.toFixed(1)} dy=-2>${units.formatUnit(tick, this.getYUnit())}</text>`,
        );
      });
    }

    return texts;
  }

  private xTexts(): TemplateResult[] {
    const texts: TemplateResult[] = [];

    if (this.tracks) {
      const minute = 60 * 1000;
      const hour = 60 * minute;

      // Push minTs 50px right to avoid writing over the alt scale
      const minSec = this.getTimeSecAtX(50);
      const timeSpan = this.maxTimeSec - minSec;
      const tickSpan = Math.ceil(timeSpan / hour / 6) * hour;
      const date = new Date(minSec * 1000);
      const startTime =
        new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours() + 1).getTime() / 1000;

      for (let timeSec = startTime; timeSec < this.maxTimeSec; timeSec += tickSpan) {
        const x = this.getXAtTimeSec(timeSec);
        const date = new Date(timeSec * 1000).toLocaleTimeString();
        texts.push(
          svg`<text text-anchor=middle stroke-width=3 y=${this.height} x=${x.toFixed(1)} dy=-4>${date}</text>
          <text text-anchor=middle y=${this.height} x=${x.toFixed(1)} dy=-4>${date}</text>`,
        );
      }
    }

    return texts;
  }

  private updateSize(): void {
    this.width = this.clientWidth;
    this.height = this.clientHeight;
  }

  private handlePlay() {
    if (this.playTimer) {
      clearInterval(this.playTimer);
      this.playTimer = undefined;
      this.lastPauseMs = Date.now();
    } else {
      // Restart from the beginning if play has not been used for 30s,
      if (this.lastPauseMs < Date.now() - 30 * 1000 || this.timeSec == this.maxTimeSec) {
        this.dispatchEvent(new CustomEvent('move', { detail: { timeSec: this.minTimeSec } }));
      } else {
        const timeSec = Math.min(Math.max(this.lastPauseTimestampSec, this.minTimeSec), this.maxTimeSec);
        this.dispatchEvent(new CustomEvent('move', { detail: { timeSec } }));
      }
      this.playTick();
      this.playTimer = window.setInterval(() => this.playTick(), PLAY_INTERVAL_MILLIS);
    }
  }

  private playTick() {
    let timeSec = this.timeSec + (PLAY_INTERVAL_MILLIS * this.playSpeed) / 1000;
    if (timeSec >= this.maxTimeSec) {
      timeSec = this.maxTimeSec;
      clearInterval(this.playTimer);
      this.playTimer = undefined;
      this.lastPauseMs = 0;
    }
    this.lastPauseTimestampSec = timeSec;
    this.dispatchEvent(new CustomEvent('move', { detail: { timeSec } }));
  }

  private handleYChange(e: Event): void {
    const y: ChartYAxis = Number((e.target as HTMLSelectElement).value);
    store.dispatch(setChartYAxis(y));
  }

  private getXAtTimeSec(timeSec: number, offsetSec = 0): number {
    return Math.round(((timeSec - offsetSec - this.minTimeSec) / (this.maxTimeSec - this.minTimeSec)) * this.width);
  }

  private getTimeSecAtX(x: number) {
    return (x / this.width) * (this.maxTimeSec - this.minTimeSec) + this.minTimeSec;
  }

  private getYAtHeight(height: number) {
    return ((this.maxY - height) / (this.maxY - this.minY)) * this.height;
  }

  private handlePointerDown(e: MouseEvent): void {
    const { timeSec } = this.getCoordinatesFromEvent(e);
    this.dispatchEvent(new CustomEvent('pin', { detail: { timeSec } }));
    this.dispatchEvent(new CustomEvent('move', { detail: { timeSec } }));
  }

  private handleMouseWheel(e: WheelEvent): void {
    const { timeSec } = this.getCoordinatesFromEvent(e);
    this.dispatchEvent(new CustomEvent('zoom', { detail: { timeSec, deltaY: e.deltaY } }));
    e.preventDefault();
  }

  private handlePointerMove(e: MouseEvent): void {
    if (this.playTimer == null) {
      const now = Date.now();
      if (now > this.nextTimestampUpdate) {
        const { timeSec } = this.getCoordinatesFromEvent(e);
        this.dispatchEvent(new CustomEvent('move', { detail: { timeSec } }));
        this.nextTimestampUpdate = now + 50;
      }
    }
  }

  private getCoordinatesFromEvent(e: MouseEvent): { x: number; y: number; timeSec: number } {
    // The event target could be any of the children of the element with the listener.
    const { left, top } = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - left;
    const y = e.clientY - top;
    return { x, y, timeSec: this.getTimeSecAtX(x) };
  }
}
