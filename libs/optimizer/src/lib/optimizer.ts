import type { InitInput, Score } from 'rustigc-wasm';
import initRustigc, { Scorer } from 'rustigc-wasm';

import type { ScoringRuleName } from './api';
import { CircuitType } from './api';
import { getRuleset } from './scoring-rules';

export interface LatLon {
  lat: number;
  lon: number;
}

export interface LatLonAltTime extends LatLon {
  alt: number;
  timeSec: number;
}

export interface ScoringTrack {
  points: LatLon[];
}

export interface ScoringRequest {
  track: ScoringTrack;
  ruleName: ScoringRuleName;
}

export interface ScoringResult {
  // The score for the track in the given league
  score: number;
  // The length of the optimized track in kms
  lengthKm: number;
  // Multiplier for computing score. score = lengthKm * multiplier
  multiplier: number;
  circuit: CircuitType;
  closingRadiusKm?: number;
  closingPoints?: {
    in: LatLon;
    out: LatLon;
  };
  turnpoints: LatLon[];
  // Optimized route path
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
      circuit: CircuitType.OpenDistance,
      turnpoints: [],
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
      circuit: CircuitType.OpenDistance,
      turnpoints: [],
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
        circuit: CircuitType.OpenDistance,
        turnpoints: [],
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
    circuit: CircuitType.OpenDistance,
    turnpoints: points.slice(1, -1),
    path: points.map(({ lat, lon }) => ({ lat, lon })),
  };
}

/**
 * Maps a rustigc Score result to the corresponding FlyXC CircuitType.
 *
 * @param score The winning score from rustigc.
 * @returns The classified CircuitType.
 */
function toCircuitType(score: Score): CircuitType {
  switch (score.description) {
    case 'fai':
      return CircuitType.FaiTriangle;
    case 'out-and-return':
      return CircuitType.OutAndReturn;
    case 'triangle':
      return CircuitType.FlatTriangle;
    case 'open':
    default:
      return CircuitType.OpenDistance;
  }
}

/**
 * Converts a rustigc Score and input track points into a FlyXC ScoringResult.
 *
 * Resolves point indices (entry, turnpoints, exit) back to LatLon coordinates,
 * extracts closing points and radius for circuits, and builds the optimized path.
 *
 * @param score The winning score from rustigc.
 * @param points The original input track coordinates.
 * @returns The complete scoring result.
 */
function toScoringResult(score: Score, points: LatLon[]): ScoringResult {
  const circuit = toCircuitType(score);

  if (score.circuit) {
    const closingPoints = {
      in: { lat: points[score.entry].lat, lon: points[score.entry].lon },
      out: { lat: points[score.exit].lat, lon: points[score.exit].lon },
    };
    const turnpoints = score.turnpoints.map((idx) => ({
      lat: points[idx].lat,
      lon: points[idx].lon,
    }));

    return {
      score: score.score,
      lengthKm: score.distance_km,
      multiplier: score.multiplier,
      circuit,
      closingRadiusKm: score.threshold_m / 1000,
      closingPoints,
      turnpoints,
      path: [closingPoints.in, ...turnpoints, closingPoints.out],
    };
  }

  const rawIndices = [score.entry, ...score.turnpoints, score.exit];
  const deduplicatedIndices: number[] = [];
  for (const idx of rawIndices) {
    if (deduplicatedIndices.length === 0 || deduplicatedIndices[deduplicatedIndices.length - 1] !== idx) {
      deduplicatedIndices.push(idx);
    }
  }

  const path = deduplicatedIndices.map((idx) => ({
    lat: points[idx].lat,
    lon: points[idx].lon,
  }));

  const turnpoints = deduplicatedIndices.slice(1, -1).map((idx) => ({
    lat: points[idx].lat,
    lon: points[idx].lon,
  }));

  return {
    score: score.score,
    lengthKm: score.distance_km,
    multiplier: score.multiplier,
    circuit,
    turnpoints,
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
