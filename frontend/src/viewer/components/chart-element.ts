import { ticks } from 'd3-array';
import {
  css,
  CSSResult,
  customElement,
  html,
  LitElement,
  property,
  PropertyValues,
  svg,
  SVGTemplateResult,
  TemplateResult,
} from 'lit-element';
import { connect } from 'pwa-helpers';

import { airspaceCategory, Flags } from '../../../../common/airspaces';
import { RuntimeTrack } from '../../../../common/track';
import { setChartY } from '../actions/map';
import { trackColor } from '../logic/map';
import { sampleAt } from '../logic/math';
import { formatUnit, UNITS } from '../logic/units';
import { Units } from '../reducers/map';
import * as mapSel from '../selectors/map';
import { RootState, store } from '../store';

@customElement('chart-element')
export class ChartElement extends connect(store)(LitElement) {
  @property({ attribute: false })
  tracks: RuntimeTrack[] | null = null;

  @property({ attribute: false })
  chartY: string | null = null;

  @property({ attribute: false })
  ts = 0;

  @property({ attribute: false })
  width = 0;

  @property({ attribute: false })
  height = 0;

  @property({ attribute: false })
  units: Units | null = null;

  @property({ attribute: false })
  showRestricted = false;

  minTs = 0;
  maxTs = 1;
  tsOffsets: number[] = [];

  stateChanged(state: RootState): void {
    if (state.map) {
      const map = state.map;
      this.tracks = map.tracks;
      this.chartY = map.chartY;
      this.ts = map.ts;
      this.minTs = mapSel.minTs(map);
      this.maxTs = mapSel.maxTs(map);
      this.units = map.units;
      this.tsOffsets = mapSel.tsOffsets(map);
      this.showRestricted = map.aspShowRestricted;
    }
  }

  get minY(): number {
    const mapState = store.getState().map;
    switch (this.chartY) {
      case 'speed':
        return mapSel.minSpeed(mapState);
      case 'vario':
        return mapSel.minVario(mapState);
      default:
        return mapSel.minAlt(mapState);
    }
  }

  get maxY(): number {
    const mapState = store.getState().map;
    switch (this.chartY) {
      case 'speed':
        return mapSel.maxSpeed(mapState);
      case 'vario':
        return mapSel.maxVario(mapState);
      default:
        return mapSel.maxAlt(mapState);
    }
  }

  protected getY(track: RuntimeTrack, ts: number): number {
    switch (this.chartY) {
      case 'speed':
        return sampleAt(track.fixes.ts, track.fixes.vx, [ts])[0];
      case 'vario':
        return sampleAt(track.fixes.ts, track.fixes.vz, [ts])[0];
      default:
        return sampleAt(track.fixes.ts, track.fixes.alt, [ts])[0];
    }
  }

  protected getYUnit(): UNITS {
    const units = this.units as Units;
    switch (this.chartY) {
      case 'speed':
        return units.speed;
      case 'vario':
        return units.vario;
      default:
        return units.altitude;
    }
  }

  constructor() {
    super();
    window.addEventListener('resize', () => this.updateSize());
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
          fill-opacity: 0.4;
          stroke-opacity: 0.6;
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
          stroke-width: 0.5px;
          fill: black;
          stroke: white;
          stroke-width: 0;
        }
        #ts {
          stroke: gray;
          fill: none;
          stroke-width: 1.5px;
        }
        path {
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-width: 1;
        }
        select {
          font: inherit;
          position: absolute;
          top: 2px;
          right: 2px;
        }
      `,
    ];
  }

  protected paths(): TemplateResult[] {
    const paths: TemplateResult[] = [];
    const spanTs = this.maxTs - this.minTs;
    const scaleY = -this.height / (this.maxY - this.minY);
    const offsetY = -this.maxY * scaleY;

    if (this.tracks != null) {
      this.tracks.forEach((track, i) => {
        // Span of the track on the X axis.
        const minX = Math.round(((track.fixes.ts[0] - this.tsOffsets[i] - this.minTs) / spanTs) * this.width);
        const maxX = Math.round(
          ((track.fixes.ts[track.fixes.ts.length - 1] - this.tsOffsets[i] - this.minTs) / spanTs) * this.width,
        );
        const spanX = maxX - minX;
        const spanTrackTs = track.maxTs - track.minTs;

        const trackCoords: string[] = [];
        const gndCoords = [`${minX},${(this.minY * scaleY + offsetY).toFixed(1)}`];
        // Display the gnd elevation only if there is a single track & mode is altitude
        const displayGndAlt = this.tracks?.length == 1 && this.chartY == 'alt';
        if (displayGndAlt && track.fixes.gndAlt) {
          paths.push(...this.airspacePaths(track, minX, spanX, spanTrackTs, scaleY, offsetY));
        }
        for (let x = minX; x < maxX; x++) {
          const ts = ((x - minX) / spanX) * spanTrackTs + track.minTs;
          const y = this.getY(track, ts);
          trackCoords.push(`${x},${(y * scaleY + offsetY).toFixed(1)}`);
          if (displayGndAlt && track.fixes.gndAlt) {
            const gndAlt = sampleAt(track.fixes.ts, track.fixes.gndAlt, [ts])[0];
            gndCoords.push(`${x},${(gndAlt * scaleY + offsetY).toFixed(1)}`);
          }
        }
        gndCoords.push(`${maxX},${(this.minY * scaleY + offsetY).toFixed(1)}`);
        if (displayGndAlt && gndCoords.length > 4) {
          paths.push(svg`<path class=gnd d=${'M' + gndCoords.join('L')}></path>`);
        }
        if (trackCoords.length > 4) {
          paths.push(svg`<path stroke=${trackColor(i)} filter="url(#shadow)" d=${'M' + trackCoords.join('L')}></path>`);
        }
      });
    }

    return paths;
  }

  // Compute the SVG paths for the airspaces.
  protected airspacePaths(
    track: RuntimeTrack,
    minX: number,
    spanX: number,
    spanTrackTs: number,
    scaleY: number,
    offsetY: number,
  ): SVGTemplateResult[] {
    const airspaces = track.airspaces;
    if (airspaces == null) {
      return [];
    }
    const paths: SVGTemplateResult[] = [];

    for (let i = 0; i < airspaces.start_ts.length; i++) {
      const flags = airspaces.flags[i];
      if (!this.showRestricted && flags & Flags.AIRSPACE_RESTRICTED) {
        continue;
      }
      const start = airspaces.start_ts[i];
      const end = airspaces.end_ts[i];
      const top = airspaces.top[i];
      const bottom = airspaces.bottom[i];
      const topRefGnd = flags & Flags.TOP_REF_GND;
      const bottomRefGnd = flags & Flags.BOTTOM_REF_GND;
      const coords = [
        ...this.aspLine(track, start, end, minX, spanX, spanTrackTs, bottom, bottomRefGnd),
        ...this.aspLine(track, end, start, minX, spanX, spanTrackTs, top, topRefGnd),
      ];
      if (coords.length < 4) {
        continue;
      }
      coords.push(coords[0]);
      const path = coords
        .map(([time, alt]) => {
          const x = ((time - track.minTs) / spanTrackTs) * spanX + minX;
          const y = alt * scaleY + offsetY;
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join('L');
      paths.push(
        svg`<path title=${`[${airspaces.category[i]}] ${airspaces.name[i]}`}  class=${`asp ${airspaceCategory(
          airspaces.flags[i],
        )}`} d=${'M' + path}></path>`,
      );
    }

    return paths;
  }

  protected aspLine(
    track: RuntimeTrack,
    start: number,
    end: number,
    minX: number,
    spanX: number,
    spanTrackTs: number,
    alt: number,
    refGnd: number,
  ): Array<[number, number]> {
    if (!refGnd || !track.fixes.gndAlt) {
      return [
        [start, alt],
        [end, alt],
      ];
    }
    let reverse = false;
    if (start > end) {
      [start, end] = [end, start];
      reverse = true;
    }
    const startX = Math.round(((start - track.minTs) / spanTrackTs) * spanX + minX);
    const endX = Math.round(((end - track.minTs) / spanTrackTs) * spanX + minX);
    const points: Array<[number, number]> = [];
    for (let x = startX; x < endX; x++) {
      const ts = ((x - minX) / spanX) * spanTrackTs + track.minTs;
      const gndAlt = sampleAt(track.fixes.ts, track.fixes.gndAlt, [ts])[0];
      points.push([ts, alt + gndAlt]);
    }
    return reverse ? points.reverse() : points;
  }

  protected axis(): TemplateResult[] {
    const axis: TemplateResult[] = [];

    if (this.tracks) {
      const tks = ticks(this.minY, this.maxY, 4);
      const ySpan = this.maxY - this.minY;

      tks.forEach((tick) => {
        // Draw line
        const y = ((this.maxY - tick) / ySpan) * this.height;
        axis.push(svg`<line y1=${y.toFixed(1)} x2=${this.width} y2=${y}></line>`);
      });
    }

    return axis;
  }

  protected yTexts(): TemplateResult[] {
    const texts: TemplateResult[] = [];

    if (this.tracks) {
      const tks = ticks(this.minY, this.maxY, 4);
      const ySpan = this.maxY - this.minY;

      tks.forEach((tick) => {
        const y = ((this.maxY - tick) / ySpan) * this.height;
        texts.push(
          svg`<text stroke-width=3 x=5 y=${y.toFixed(1)} dy=-2>${formatUnit(tick, this.getYUnit())}</text>
          <text x=5 y=${y.toFixed(1)} dy=-2>${formatUnit(tick, this.getYUnit())}</text>`,
        );
      });
    }

    return texts;
  }

  protected xTexts(): TemplateResult[] {
    const texts: TemplateResult[] = [];

    if (this.tracks) {
      const minute = 60 * 1000;
      const hour = 60 * minute;

      // Push minTs 50px right to avoid writing over the alt scale
      const offset = 50;
      const minTs = this.minTs + ((this.maxTs - this.minTs) / this.width) * offset;

      const timeSpan = this.maxTs - minTs;

      const tickSpan = Math.ceil(timeSpan / hour / 6) * hour;
      const time = new Date(minTs);
      const startTs = new Date(time.getFullYear(), time.getMonth(), time.getDate(), time.getHours() + 1).getTime();

      for (let ts = startTs; ts < this.maxTs; ts += tickSpan) {
        const x = ((ts - this.minTs) / (this.maxTs - this.minTs)) * this.width;
        const time = new Date(ts).toLocaleTimeString();
        texts.push(
          svg`<text text-anchor=middle stroke-width=3 y=${this.height} x=${x} dy=-4>${time}</text>
          <text text-anchor=middle y=${this.height} x=${x} dy=-4>${time}</text>`,
        );
      }
    }

    return texts;
  }

  protected updateSize(): void {
    const shadowRoot = this.shadowRoot as ShadowRoot;
    const host = shadowRoot.host;
    this.width = host.clientWidth;
    this.height = host.clientHeight;
  }

  render(): TemplateResult {
    if (!this.width) {
      // FF and Edge would report a size of 0x0 without setTimeout
      setTimeout(() => this.updateSize(), 0);
    }
    return html`
      <svg
        @mousemove=${this.handleMouseEvent('move')}
        @wheel=${this.handleMouseEvent('zoom')}
        @click=${this.handleMouseEvent('pin')}
        id="chart"
        width="100%"
        height="100%"
      >
        <defs>
          <filter id="shadow">
            <feGaussianBlur in="SourceAlpha" stdDeviation="1"></feGaussianBlur>
            <feMerge>
              <feMergeNode></feMergeNode>
              <feMergeNode in="SourceGraphic"></feMergeNode>
            </feMerge>
          </filter>
        </defs>
        <rect width="100%" height="100%" fill="white" />
        <g class="paths">
          ${this.paths()}
        </g>
        <g class="axis">
          ${this.axis()}
        </g>
        <g class="ticks">
          ${this.yTexts()}
        </g>
        <g class="ticks">
          ${this.xTexts()}
        </g>
        <line id="ts" x1="0" x2="0" y2="100%"></line>
      </svg>
      <select @change=${this.handleYChange}>
        <option value="alt" selected>Altitude</option>
        <option value="speed">Speed</option>
        <option value="vario">Vario</option>
      </select>
    `;
  }

  protected handleYChange(e: Event): void {
    const axis: string = (e.target as HTMLSelectElement).value;
    store.dispatch(setChartY(axis));
  }

  protected tsX(): number {
    return ((this.ts - this.minTs) / (this.maxTs - this.minTs)) * this.width;
  }

  protected handleMouseEvent(name: string): (event: MouseEvent) => void {
    return (event: MouseEvent): void => {
      const target = event.currentTarget as HTMLElement;
      const x = event.clientX - target.getBoundingClientRect().left;
      const ts = (x / this.width) * (this.maxTs - this.minTs) + this.minTs;
      this.dispatchEvent(new CustomEvent(name, { detail: { ts, event } }));
      event.preventDefault();
    };
  }

  shouldUpdate(changedProps: PropertyValues): boolean {
    if (changedProps.size == 1 && changedProps.has('ts')) {
      // Do not re-render if only the timestamp changes
      const shadowRoot = this.shadowRoot as ShadowRoot;
      const tsEl = (shadowRoot.getElementById('ts') as unknown) as SVGLineElement | null;
      if (tsEl) {
        tsEl.setAttribute('x1', `${this.tsX()}`);
        tsEl.setAttribute('x2', `${this.tsX()}`);
      }
      return false;
    }
    return super.shouldUpdate(changedProps);
  }
}
