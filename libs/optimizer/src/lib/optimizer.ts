import type { InitInput, Score } from 'rustigc-wasm';
import initRustigc, { Scorer } from 'rustigc-wasm';

import type { ScoringRuleName } from './api';
import { CircuitType } from './api';
import { getRuleset } from './scoring-rules';

export interface LatLon {
  lat: number;
  lon: number;
}

/**
 * Information about the closing gap and sector for closed circuits.
 */
export interface ScoringClosing {
  /** Maximum allowed closing distance gap in kilometers for closed circuits. */
  radiusKm: number;
  /** Actual closing distance gap in kilometers between start and end. */
  gapKm: number;
  /** Starting/entry point of the closed circuit where the closing sector is centered. */
  startPoint: LatLon;
  /** Ending/exit point of the closed circuit closing back to the start. */
  endPoint: LatLon;
}

/**
 * Result of scoring a flight track according to league rules.
 *
 * The scored route is given by `path`, which contains the ordered sequence of
 * vertices `[start, ...turnpoints, end]`.
 *
 * To obtain intermediate turnpoints:
 * - Use `path.slice(1, -1)`:
 *   - Triangles (`FlatTriangle`, `FaiTriangle`): returns the 3 triangle corner turnpoints.
 *   - Out and return (`OutAndReturn`): returns the turnaround point(s).
 *   - Open distance (`OpenDistance`): returns intermediate waypoints (0 to 3 points);
 *     the number of turnpoints is `Math.max(0, path.length - 2)`.
 */
export interface ScoringResult {
  /**
   * The calculated score points for the track in the given league.
   */
  score: number;
  /**
   * The total scored length of the optimized track in kilometers.
   */
  lengthKm: number;
  /**
   * Scoring multiplier applied to distance to compute final score (score = lengthKm * multiplier).
   */
  multiplier: number;
  /**
   * The classified circuit type of the flight.
   */
  circuitType: CircuitType;
  /**
   * Information about the closing gap and sector for closed circuits.
   * Undefined for open distance flights.
   */
  closing?: ScoringClosing;
  /**
   * Sequence of coordinates forming the complete optimized route path: `[start, ...turnpoints, end]`.
   *
   * To extract intermediate turnpoints, use `path.slice(1, -1)`.
   */
  path: LatLon[];
}

let initPromise: Promise<void> | undefined;

/**
 * Initializes the rustigc WebAssembly module.
 *
 * @param wasmInput Custom URL, BufferSource, Response, or WebAssembly.Module.
 */
export function initOptimizer(wasmInput: InitInput | Promise<InitInput>): Promise<void> {
  return (initPromise ??= (async () => {
    try {
      await initRustigc({ module_or_path: wasmInput });
    } catch (e) {
      initPromise = undefined;
      throw e;
    }
  })());
}

/**
 * Computes the score for a track in a given league.
 *
 * @param points Array of LatLon coordinates.
 * @param ruleName Name of the league scoring ruleset.
 * @returns The scoring result.
 */
export function scoreTrack(points: LatLon[], ruleName: ScoringRuleName): ScoringResult {
  if (points.length === 0) {
    return {
      score: 0,
      lengthKm: 0,
      multiplier: 0,
      circuitType: CircuitType.OpenDistance,
      path: [],
    };
  }

  if (ruleName === 'None') {
    return toUnoptimizedSolution(points);
  }

  if (points.length < 2) {
    return {
      score: 0,
      lengthKm: 0,
      multiplier: 0,
      circuitType: CircuitType.OpenDistance,
      path: [...points],
    };
  }

  const ruleset = getRuleset(ruleName);
  if (!ruleset) {
    return toUnoptimizedSolution(points);
  }

  const coords = new Float64Array(points.length * 2);
  for (let i = 0; i < points.length; i++) {
    coords[2 * i] = points[i].lat;
    coords[2 * i + 1] = points[i].lon;
  }

  const scorer = new Scorer(coords);
  try {
    const score = scorer.solve(ruleset);
    if (!score) {
      return {
        score: 0,
        lengthKm: 0,
        multiplier: 0,
        circuitType: CircuitType.OpenDistance,
        path: points.map(({ lat, lon }) => ({ lat, lon })),
      };
    }

    return toScoringResult(score, points);
  } finally {
    scorer.free();
  }
}

/**
 * Computes an unoptimized solution for a track.
 *
 * Used when no scoring ruleset is configured (e.g. 'None'). The total distance
 * is calculated by summing the distances between consecutive points using the
 * FCC formula.
 *
 * @param points Array of track coordinates.
 * @returns A ScoringResult representing the unoptimized open distance flight.
 */
function toUnoptimizedSolution(points: LatLon[]): ScoringResult {
  let distance = 0;
  for (let i = 0; i < points.length - 1; i++) {
    distance += distanceEarthFCC(points[i], points[i + 1]);
  }

  return {
    score: distance,
    lengthKm: distance,
    multiplier: 1,
    circuitType: CircuitType.OpenDistance,
    path: points.map(({ lat, lon }) => ({ lat, lon })),
  };
}

function toScoringResult(score: Score, points: LatLon[]): ScoringResult {
  const circuitType = score.description as CircuitType;

  if (score.circuit) {
    const closing: ScoringClosing = {
      radiusKm: score.threshold_m / 1000,
      gapKm: score.gap_m / 1000,
      startPoint: { lat: points[score.entry].lat, lon: points[score.entry].lon },
      endPoint: { lat: points[score.exit].lat, lon: points[score.exit].lon },
    };
    const tps = score.turnpoints.map((idx) => ({
      lat: points[idx].lat,
      lon: points[idx].lon,
    }));

    return {
      score: score.score,
      lengthKm: score.distance_km,
      multiplier: score.multiplier,
      circuitType,
      closing,
      path: [closing.startPoint, ...tps, closing.endPoint],
    };
  }

  // For open distance tasks, rustigc always fills the fixed number of turnpoints
  // configured in the rule (e.g. 3 turnpoints for a 5-point polyline). When the track
  // has fewer points than the rule requires, or when the optimal flight does not need
  // all available turns (e.g. a straight line), rustigc collapses unused turnpoints
  // onto adjacent indices (entry, exit, or neighboring turnpoints).
  // Deduplicating consecutive indices yields the actual active vertices.
  const activeIndices = [score.entry, ...score.turnpoints, score.exit].filter(
    (idx, i, arr) => i === 0 || idx !== arr[i - 1],
  );

  const path = activeIndices.map((idx) => ({
    lat: points[idx].lat,
    lon: points[idx].lon,
  }));

  return {
    score: score.score,
    lengthKm: score.distance_km,
    multiplier: score.multiplier,
    circuitType,
    path,
  };
}

/**
 * Computes the distance between two coordinates in kilometers using the FCC formula.
 *
 * The Federal Communications Commission (FCC) formula provides an elliptical
 * approximation of distance on the Earth's surface, accurate for distances up to
 * several hundred kilometers.
 *
 * @param p1 First coordinate.
 * @param p2 Second coordinate.
 * @returns Distance in kilometers.
 */
function distanceEarthFCC(p1: LatLon, p2: LatLon): number {
  const df = p1.lat - p2.lat;
  const dg = p1.lon - p2.lon;
  const fmDegree = (p2.lat + p1.lat) / 2;
  const fm = fmDegree / (180 / Math.PI);
  // Speed up cos computation using:
  // - cos(2x) = 2 * cos(x)^2 - 1
  // - cos(a+b) = 2 * cos(a)cos(b) - cos(a-b)
  const cosfm = Math.cos(fm);
  const cos2fm = 2 * cosfm * cosfm - 1;
  const cos3fm = cosfm * (2 * cos2fm - 1);
  const cos4fm = 2 * cos2fm * cos2fm - 1;
  const cos5fm = 2 * cos2fm * cos3fm - cosfm;
  const k1 = 111.13209 - 0.566605 * cos2fm + 0.0012 * cos4fm;
  const k2 = 111.41513 * cosfm - 0.09455 * cos3fm + 0.00012 * cos5fm;
  return Math.sqrt(k1 * df * (k1 * df) + k2 * dg * (k2 * dg));
}
