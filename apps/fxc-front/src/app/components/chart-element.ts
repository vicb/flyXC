import type { Class, protos, Type } from '@flyxc/common';
import { arrayMax, arrayMin, Flags, isAirspaceVisible, sampleAt } from '@flyxc/common';
import { ticks } from 'd3-array';
import type { CSSResult, PropertyValues, SVGTemplateResult, TemplateResult } from 'lit';
import { css, html, LitElement, svg } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { guard } from 'lit/directives/guard.js';
import { when } from 'lit/directives/when.js';

import * as units from '../logic/units';

/**
 * Metrics that can be displayed on the chart's primary Y-axis.
 */
export enum ChartYAxis {
  /** Altitude profile (in meters, formatted according to user preferences). */
  Altitude = 0,
  /** Horizontal ground speed profile. */
  Speed = 1,
  /** Vertical speed (variometer) profile. */
  Vario = 2,
}

/**
 * Generic track representation rendered by `<chart-element>`.
 *
 * Can represent runtime tracks (e.g. from IGC/GPX files) or live tracking tracks.
 */
export interface ChartTrack {
  /** Unique identifier of the track. */
  id: string;
  /** Display name of the pilot or track. */
  name?: string;
  /** Visual color used to render the track line. */
  color?: string;
  /** Array of timestamps in epoch seconds. */
  timeSec: number[];
  /** Array of altitude points in meters corresponding to timeSec. */
  alt: number[];
  /** Optional array of ground elevation points in meters. */
  gndAlt?: number[];
  /** Optional array of horizontal speeds. */
  vx?: number[];
  /** Optional array of vertical speeds / variometer values. */
  vz?: number[];
  /** Optional airspace definitions intersected by the track. */
  airspaces?: protos.Airspaces;
  /** Time offset in seconds applied when synchronizing multiple tracks. */
  offsetSeconds?: number;
  /** Minimum altitude across the track. */
  minAlt?: number;
  /** Maximum altitude across the track. */
  maxAlt?: number;
  /** Minimum horizontal speed across the track. */
  minVx?: number;
  /** Maximum horizontal speed across the track. */
  maxVx?: number;
  /** Minimum vertical speed across the track. */
  minVz?: number;
  /** Maximum vertical speed across the track. */
  maxVz?: number;
  /** Start timestamp in epoch seconds. */
  minTimeSec?: number;
  /** End timestamp in epoch seconds. */
  maxTimeSec?: number;
  /** Whether the track is a live tracking track. */
  isLive?: boolean;
}

const MIN_SPEED_FACTOR = 16;
const MAX_SPEED_FACTOR = 4096;
const PLAY_INTERVAL_MILLIS = 50;

/** Reusable hour:minute time formatter without seconds to avoid re-instantiation per tick. */
const hourMinuteFormatter = new Intl.DateTimeFormat([], {
  hour: 'numeric',
  minute: '2-digit',
});

/**
 * Returns the CSS class name corresponding to airspace restriction flags.
 *
 * @param flags - Bitwise airspace classification flags.
 * @returns The CSS modifier string (`prohibited`, `restricted`, `danger`, or `other`).
 */
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

/**
 * Simplifies a sequence of 2D points by dropping intermediate collinear points
 * within a tolerance (0.2px), returning an SVG path string segment.
 * Coordinates are formatted without redundant trailing zeroes.
 *
 * @param points - Array of [x, y] coordinates.
 * @param toleranceSq - Maximum squared perpendicular distance to allow dropping a point.
 * @returns SVG path string segment (e.g. "0,81L1,58.6L4,0.1...").
 */
export function pointsToSvgPath(points: [number, number][], toleranceSq = 0.04): string {
  if (toleranceSq <= 0 || points.length <= 2) {
    return points.map(([x, y]) => `${x},${y}`).join(' ');
  }
  const simplified: [number, number][] = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const [x0, y0] = simplified[simplified.length - 1];
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];

    const cross = (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0);
    const distSq = (x2 - x0) ** 2 + (y2 - y0) ** 2;
    if (distSq > 0 && (cross * cross) / distSq <= toleranceSq) {
      continue;
    }
    simplified.push(points[i]);
  }
  simplified.push(points[points.length - 1]);
  return simplified.map(([x, y]) => `${x},${y}`).join(' ');
}

/**
 * Interactive SVG elevation, speed, and vario profile chart for flight tracks.
 *
 * Renders flight paths, ground elevation, airspace intersections, time & metric axes,
 * playback controls, and a synchronized time scrubber cursor.
 */
@customElement('chart-element')
export class ChartElement extends LitElement {
  @property({ attribute: false })
  tracks: ChartTrack[] = [];
  @property({ attribute: false })
  chartYAxis: ChartYAxis = ChartYAxis.Altitude;
  @property({ attribute: false })
  availableYAxes: ChartYAxis[] = [ChartYAxis.Altitude, ChartYAxis.Speed, ChartYAxis.Vario];
  @property({ attribute: false })
  timeSec = 0;
  @property({ attribute: false })
  currentTrackId?: string;
  @property({ attribute: false })
  minTimeSec?: number;
  @property({ attribute: false })
  maxTimeSec?: number;
  @property({ attribute: false })
  minY?: number;
  @property({ attribute: false })
  maxY?: number;
  @property({ attribute: false })
  units?: units.Units;
  @property({ attribute: false })
  showClasses: Class[] = [];
  @property({ attribute: false })
  showTypes: Type[] = [];
  @property({ type: Boolean })
  isLiveTrack = false;

  private get isLive(): boolean {
    return this.isLiveTrack || this.tracks.some((t) => t.isLive);
  }

  @state()
  private width = 0;
  @state()
  private height = 0;
  @state()
  private playSpeed = 64;
  @state()
  private playTimer?: number;

  // Last time the track animation was paused and corresponding timestamp
  private lastPauseMs = 0;
  private lastPauseTimestampSec = 0;

  @query('#thumb')
  private thumbElement?: SVGLineElement;

  // Throttle timestamp updates.
  private nextTimestampUpdate = 0;
  private sizeListener = () => this.updateSize();

  private get computedMinY(): number {
    if (this.minY != null) {
      return this.minY;
    }
    if (this.tracks.length === 0) {
      return 0;
    }
    switch (this.chartYAxis) {
      case ChartYAxis.Speed: {
        const mins = this.tracks.map((t) => t.minVx ?? (t.vx?.length ? arrayMin(t.vx) : 0));
        return arrayMin(mins);
      }
      case ChartYAxis.Vario: {
        const mins = this.tracks.map((t) => t.minVz ?? (t.vz?.length ? arrayMin(t.vz) : 0));
        return arrayMin(mins);
      }
      default: {
        const mins = this.tracks.map((t) => t.minAlt ?? (t.alt.length ? arrayMin(t.alt) : 0));
        return arrayMin(mins);
      }
    }
  }

  private get computedMaxY(): number {
    if (this.maxY != null) {
      return this.maxY;
    }
    if (this.tracks.length === 0) {
      return 1;
    }
    switch (this.chartYAxis) {
      case ChartYAxis.Speed: {
        const maxs = this.tracks.map((t) => t.maxVx ?? (t.vx?.length ? arrayMax(t.vx) : 1));
        return arrayMax(maxs);
      }
      case ChartYAxis.Vario: {
        const maxs = this.tracks.map((t) => t.maxVz ?? (t.vz?.length ? arrayMax(t.vz) : 1));
        return arrayMax(maxs);
      }
      default: {
        const maxs = this.tracks.map((t) => t.maxAlt ?? (t.alt.length ? arrayMax(t.alt) : 1));
        return arrayMax(maxs);
      }
    }
  }

  private get computedMinTimeSec(): number {
    if (this.minTimeSec != null) {
      return this.minTimeSec;
    }
    if (this.tracks.length === 0) {
      return 0;
    }
    const starts = this.tracks.map((t) => (t.minTimeSec ?? t.timeSec[0]) - (t.offsetSeconds ?? 0));
    return arrayMin(starts);
  }

  private get computedMaxTimeSec(): number {
    if (this.maxTimeSec != null) {
      return this.maxTimeSec;
    }
    if (this.tracks.length === 0) {
      return 1;
    }
    const ends = this.tracks.map((t) => (t.maxTimeSec ?? t.timeSec[t.timeSec.length - 1]) - (t.offsetSeconds ?? 0));
    return arrayMax(ends);
  }

  // time is in seconds.
  private getY(track: ChartTrack, timeSec: number): number {
    switch (this.chartYAxis) {
      case ChartYAxis.Speed:
        return track.vx ? sampleAt(track.timeSec, track.vx, timeSec) : 0;
      case ChartYAxis.Vario:
        return track.vz ? sampleAt(track.timeSec, track.vz, timeSec) : 0;
      default:
        return sampleAt(track.timeSec, track.alt, timeSec);
    }
  }

  private getYUnit(): units.DistanceUnit | units.SpeedUnit {
    const logUnits = this.units;
    switch (this.chartYAxis) {
      case ChartYAxis.Speed:
        return logUnits?.speed ?? units.SpeedUnit.KilometersPerHour;
      case ChartYAxis.Vario:
        return logUnits?.vario ?? units.SpeedUnit.MetersPerSecond;
      default:
        return logUnits?.altitude ?? units.DistanceUnit.Meters;
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
          font: 12px sans-serif;
          user-select: none;
          pointer-events: none;
          fill: black;
          stroke: white;
          stroke-width: 4px;
          paint-order: stroke fill;
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
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(this.sizeListener).observe(this);
    }
    // Sometimes the SVG has a 0x0 size when opened in a new window.
    if (document.visibilityState != 'visible') {
      document.addEventListener('visibilitychange', () => setTimeout(this.sizeListener, 500));
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('resize', this.sizeListener);
    document.removeEventListener('visibilitychange', this.sizeListener);
    if (this.playTimer) {
      clearInterval(this.playTimer);
      this.playTimer = undefined;
    }
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
    // Note: `LitElement#shouldUpdate()` is always true
    return changedProps.size === 0 ? false : super.shouldUpdate(changedProps);
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
          [
            this.tracks,
            this.currentTrackId,
            this.showClasses,
            this.showTypes,
            this.width,
            this.height,
            this.chartYAxis,
            this.minY,
            this.maxY,
            this.minTimeSec,
            this.maxTimeSec,
          ],
          () => svg`<g class="paths">${this.paths()}</g>`,
        )}
        ${guard(
          [
            this.tracks,
            this.width,
            this.height,
            this.chartYAxis,
            this.minY,
            this.maxY,
            this.minTimeSec,
            this.maxTimeSec,
            this.units,
            this.isLive,
          ],
          () => svg`<g class="axis">${this.axis()}</g>
        <g class="ticks">${this.yTexts()}${this.xTexts()}</g>`,
        )}
        <line id="thumb" x1="0" x2="0" y2="100%"></line>
      </svg>
      <div id="ct">
        ${when(
          this.availableYAxes.length > 1,
          () => html`
            <select @change=${this.handleYChange}>
              ${this.availableYAxes.map(
                (axis) => html`
                  <option value=${axis} ?selected=${this.chartYAxis === axis}>
                    ${axis === ChartYAxis.Altitude ? 'Altitude' : axis === ChartYAxis.Speed ? 'Speed' : 'Vario'}
                  </option>
                `,
              )}
            </select>
          `,
        )}
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

  /**
   * Generates SVG path elements for the elevation profiles of all tracks.
   *
   * Draws ground elevation when a single track is in altitude mode, and highlights
   * the active track. Supports short active segments with at least two fixes.
   *
   * @returns Array of SVG template results representing track and terrain paths.
   */
  private paths(): TemplateResult[] {
    const paths: TemplateResult[] = [];

    // Do not render before the width is set.
    if (this.tracks.length == 0 || this.width < 50) {
      return paths;
    }

    let activePath: SVGTemplateResult | undefined;

    // Display the gnd elevation only if there is a single track & mode is altitude
    const displayGndAlt = this.tracks.length == 1 && this.chartYAxis == ChartYAxis.Altitude;

    this.tracks.forEach((track) => {
      // At least 2 points are required to define a line segment on the chart.
      if (track.timeSec.length < 2) {
        return;
      }
      // Span of the track on the X axis.
      const offsetSeconds = track.offsetSeconds ?? 0;
      const minX = this.getXAtTimeSec(track.timeSec[0], offsetSeconds);
      const maxX = this.getXAtTimeSec(track.timeSec[track.timeSec.length - 1], offsetSeconds);

      const trackPoints: [number, number][] = [];
      const gndPoints: [number, number][] = [[minX, Math.round(this.getYAtHeight(this.computedMinY) * 10) / 10]];

      if (displayGndAlt && track.gndAlt && track.airspaces) {
        paths.push(...this.airspacePaths(track));
      }
      // Sample all horizontal pixels across the track span up to maxX.
      for (let x = minX; x <= maxX; x++) {
        const timeSec = this.getTimeSecAtX(x) + offsetSeconds;
        const y = this.getY(track, timeSec);
        trackPoints.push([x, Math.round(this.getYAtHeight(y) * 10) / 10]);
        if (displayGndAlt && track.gndAlt) {
          const gndAlt = sampleAt(track.timeSec, track.gndAlt, timeSec);
          gndPoints.push([x, Math.round(this.getYAtHeight(gndAlt) * 10) / 10]);
        }
      }
      // When minX equals maxX, append the end fix to guarantee at least two path coordinates.
      if (trackPoints.length === 1) {
        const yEnd = this.getY(track, track.timeSec[track.timeSec.length - 1]);
        trackPoints.push([maxX, Math.round(this.getYAtHeight(yEnd) * 10) / 10]);
      }
      gndPoints.push([maxX, Math.round(this.getYAtHeight(this.computedMinY) * 10) / 10]);
      if (displayGndAlt && track.gndAlt) {
        paths.push(svg`<path class=gnd d=${`M${pointsToSvgPath(gndPoints)}`}></path>`);
      }
      const trackColor = track.color ?? 'black';
      const trackD = `M${pointsToSvgPath(trackPoints)}`;
      if (track.id == this.currentTrackId) {
        activePath = svg`<path class='active' stroke=${trackColor} filter=url(#shadow-active)
          d=${trackD}></path>`;
      } else {
        paths.push(svg`<path stroke=${trackColor} d=${trackD} filter=url(#shadow)></path>`);
      }
    });

    // The active path should be drawn last to be on top of others.
    if (activePath) {
      paths.push(activePath);
    }

    return paths;
  }

  /**
   * Computes the SVG path elements for airspaces intersected by the given track.
   *
   * @param track - The track whose airspaces to render.
   * @returns An array of SVG path template results.
   */
  private airspacePaths(track: ChartTrack): SVGTemplateResult[] {
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
      const aspPoints: [number, number][] = coords.map(([timeSec, alt]) => [
        Math.round(this.getXAtTimeSec(timeSec) * 10) / 10,
        Math.round(this.getYAtHeight(alt) * 10) / 10,
      ]);
      paths.push(
        svg`<path data-start=${startSec} data-end=${endSec} class=${`asp ${getAirspaceCssClass(
          flags,
        )}`} d=${`M${pointsToSvgPath(aspPoints, 0)}`}></path>`,
      );
    }

    return paths;
  }

  /**
   * Generates sample points for an airspace top or bottom boundary line,
   * factoring in terrain altitude when the boundary is AGL (above ground level).
   *
   * @param track - The flight track.
   * @param startSec - Start timestamp of the airspace segment.
   * @param endSec - End timestamp of the airspace segment.
   * @param alt - Boundary altitude value in meters.
   * @param refGnd - Whether the boundary references ground elevation (AGL).
   * @param clampTo - Altitude limits to clamp the line within.
   * @returns Array of `[timeSec, altitude]` coordinates.
   */
  private aspLine(
    track: ChartTrack,
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

  /**
   * Computes the Y-axis tick values and formatted pixel Y positions.
   *
   * Shared between grid lines and text labels to avoid calculating ticks twice.
   */
  private getYAxisTicks(): Array<{ tick: number; yStr: string }> {
    if (this.tracks.length === 0) {
      return [];
    }
    return ticks(this.computedMinY, this.computedMaxY, 4).map((tick) => ({
      tick,
      yStr: this.getYAtHeight(tick).toFixed(1),
    }));
  }

  /**
   * Renders horizontal grid lines across the chart Y axis.
   *
   * @returns An array of SVG line template results.
   */
  private axis(): TemplateResult[] {
    return this.getYAxisTicks().map(({ yStr }) => svg`<line y1=${yStr} x2=${this.width} y2=${yStr}></line>`);
  }

  /**
   * Generates Y-axis label text SVG elements with white outline for readability.
   *
   * @returns An array of SVG text template results.
   */
  private yTexts(): TemplateResult[] {
    const yTicks = this.getYAxisTicks();
    const yUnit = this.getYUnit();
    return yTicks.map(({ tick, yStr }) => svg`<text x=5 y=${yStr} dy=-2>${units.formatUnit(tick, yUnit)}</text>`);
  }

  /**
   * Generates X-axis time label text SVG elements along the bottom of the chart.
   * For live tracks, also renders a right-aligned age label ("now" or "now - Xmin")
   * and skips any overlapping tick labels.
   *
   * @returns An array of SVG text template results.
   */
  private xTexts(): TemplateResult[] {
    const texts: TemplateResult[] = [];

    if (this.tracks.length > 0) {
      const minuteInSec = 60;

      // Push minTs 60px right to avoid writing over the alt scale
      const minSec = this.getTimeSecAtX(60);
      const timeSpan = this.computedMaxTimeSec - minSec;
      // At max 6 ticks, with a minimum spacing of 1 minute between them.
      const tickSpan = Math.max(minuteInSec, Math.ceil(timeSpan / 6 / minuteInSec) * minuteInSec);
      const startTime = Math.ceil(minSec / tickSpan) * tickSpan;

      let rightLabel = '';
      let rightLabelX = 0;
      let rightLabelLeftEdge = Infinity;

      if (this.isLive && this.computedMaxTimeSec > 0) {
        const nowSec = Date.now() / 1000;
        const ageMin = Math.round((nowSec - this.computedMaxTimeSec) / 60);
        if (ageMin <= 90) {
          rightLabel = ageMin <= 0 ? 'now' : `${units.formatDurationMin(ageMin)} ago`;
          rightLabelX = this.width - 4;
          // Estimate label width: ~8px per character in 12px font, plus margin
          const approxWidth = Math.max(rightLabel.length * 8, 35);
          rightLabelLeftEdge = rightLabelX - approxWidth;
        }
      }

      for (let timeSec = startTime; timeSec < this.computedMaxTimeSec; timeSec += tickSpan) {
        const x = this.getXAtTimeSec(timeSec);
        // Skip tick label if it would overlap with the rightmost live label.
        // Tick label is centered at x (approx width ~ 60px, so right edge is x + 30).
        if (rightLabel && x + 30 >= rightLabelLeftEdge) {
          continue;
        }
        const dateStr = hourMinuteFormatter.format(timeSec * 1000);
        texts.push(svg`<text text-anchor=middle y=${this.height} x=${x.toFixed(1)} dy=-4>${dateStr}</text>`);
      }

      // Add the rightmost live label if it doesn't overlap with the left scale (x > 70).
      if (rightLabel && rightLabelLeftEdge > 70) {
        texts.push(svg`<text text-anchor=end y=${this.height} x=${rightLabelX.toFixed(1)} dy=-4>${rightLabel}</text>`);
      }
    }

    return texts;
  }

  /**
   * Synchronizes internal width and height with the component's client dimensions.
   */
  private updateSize(): void {
    this.width = this.clientWidth;
    this.height = this.clientHeight;
  }

  /**
   * Toggles track replay playback on or off.
   */
  private handlePlay(): void {
    const minTimeSec = this.computedMinTimeSec;
    const maxTimeSec = this.computedMaxTimeSec;
    if (this.playTimer) {
      clearInterval(this.playTimer);
      this.playTimer = undefined;
      this.lastPauseMs = Date.now();
    } else {
      // Restart from the beginning if play has not been used for 30s,
      if (this.lastPauseMs < Date.now() - 30 * 1000 || this.timeSec == maxTimeSec) {
        this.dispatchEvent(new CustomEvent('move', { detail: { timeSec: minTimeSec } }));
      } else {
        const timeSec = Math.min(Math.max(this.lastPauseTimestampSec, minTimeSec), maxTimeSec);
        this.dispatchEvent(new CustomEvent('move', { detail: { timeSec } }));
      }
      this.playTick();
      this.playTimer = window.setInterval(() => this.playTick(), PLAY_INTERVAL_MILLIS);
    }
  }

  /**
   * Advances the playback timestamp by one tick interval and dispatches a move event.
   */
  private playTick(): void {
    const maxTimeSec = this.computedMaxTimeSec;
    let timeSec = this.timeSec + (PLAY_INTERVAL_MILLIS * this.playSpeed) / 1000;
    if (timeSec >= maxTimeSec) {
      timeSec = maxTimeSec;
      clearInterval(this.playTimer);
      this.playTimer = undefined;
      this.lastPauseMs = 0;
    }
    this.lastPauseTimestampSec = timeSec;
    this.dispatchEvent(new CustomEvent('move', { detail: { timeSec } }));
  }

  /**
   * Handles user selection of a different Y-axis metric (Altitude, Speed, or Vario).
   *
   * @param e - The select change event.
   */
  private handleYChange(e: Event): void {
    const y: ChartYAxis = Number((e.target as HTMLSelectElement).value);
    this.dispatchEvent(new CustomEvent('select-y', { detail: { y } }));
  }

  /**
   * Converts a timestamp in seconds to an X coordinate in pixels.
   *
   * @param timeSec - Epoch timestamp in seconds.
   * @param offsetSec - Optional offset in seconds (e.g. for multi-day tracks).
   * @returns Pixel X position.
   */
  private getXAtTimeSec(timeSec: number, offsetSec = 0): number {
    const timeSpan = this.computedMaxTimeSec - this.computedMinTimeSec;
    return timeSpan === 0 ? 0 : Math.round(((timeSec - offsetSec - this.computedMinTimeSec) / timeSpan) * this.width);
  }

  /**
   * Converts an X coordinate in pixels to a timestamp in seconds.
   *
   * @param x - Pixel X position.
   * @returns Epoch timestamp in seconds.
   */
  private getTimeSecAtX(x: number): number {
    return this.width === 0
      ? this.computedMinTimeSec
      : (x / this.width) * (this.computedMaxTimeSec - this.computedMinTimeSec) + this.computedMinTimeSec;
  }

  /**
   * Converts a metric value (height, speed, vario) to a Y coordinate in pixels.
   *
   * @param height - Value in metric units.
   * @returns Pixel Y position (inverted SVG coordinate).
   */
  private getYAtHeight(height: number): number {
    const ySpan = this.computedMaxY - this.computedMinY;
    return ySpan === 0 ? this.height / 2 : ((this.computedMaxY - height) / ySpan) * this.height;
  }

  /**
   * Handles pointer down events on the chart to pin and scrub the time position.
   *
   * @param e - Pointer mouse event.
   */
  private handlePointerDown(e: MouseEvent): void {
    const { timeSec } = this.getCoordinatesFromEvent(e);
    this.dispatchEvent(new CustomEvent('pin', { detail: { timeSec } }));
    this.dispatchEvent(new CustomEvent('move', { detail: { timeSec } }));
  }

  /**
   * Handles mouse wheel events on the chart to trigger zooming centered at the pointer timestamp.
   *
   * @param e - Wheel event.
   */
  private handleMouseWheel(e: WheelEvent): void {
    const { timeSec } = this.getCoordinatesFromEvent(e);
    this.dispatchEvent(new CustomEvent('zoom', { detail: { timeSec, deltaY: e.deltaY } }));
    e.preventDefault();
  }

  /**
   * Handles pointer movement over the chart to scrub the timestamp during hover/drag.
   *
   * @param e - Mouse event.
   */
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

  /**
   * Extracts chart pixel coordinates and corresponding timestamp from a mouse event.
   *
   * @param e - Mouse event.
   * @returns Object with x, y, and timeSec.
   */
  private getCoordinatesFromEvent(e: MouseEvent): { x: number; y: number; timeSec: number } {
    // The event target could be any of the children of the element with the listener.
    const { left, top } = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - left;
    const y = e.clientY - top;
    return { x, y, timeSec: this.getTimeSecAtX(x) };
  }
}
