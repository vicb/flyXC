import { CircuitType } from '@flyxc/optimizer/src/lib/api';
import type { LatLon, Leg, ScoringRequest, ScoringResult, ScoringTrack } from '@flyxc/optimizer/src/lib/optimizer';
import { getOptimizer } from '@flyxc/optimizer/src/lib/optimizer';

import type { Score } from '../../../rustigc/rustigc-wasm/pkg/rustigc_wasm.js';
import initRustigc, { Scorer } from '../../../rustigc/rustigc-wasm/pkg/rustigc_wasm.js';
import wasmUrl from '../../../rustigc/rustigc-wasm/pkg/rustigc_wasm_bg.wasm?url';

export interface Request {
  request: ScoringRequest;
  id?: number;
}

export interface Response {
  response: ScoringResult;
  id?: number;
}

let rustigcInitPromise: Promise<unknown> | undefined;

async function ensureRustigc(): Promise<void> {
  if (!rustigcInitPromise) {
    rustigcInitPromise = (async () => {
      try {
        await initRustigc(wasmUrl);
      } catch {
        // Fallback to default relative fetch if URL resolution differs
        await initRustigc();
      }
    })();
  }
  await rustigcInitPromise;
}

function distanceEarthFCC(p1: LatLon, p2: LatLon): number {
  const df = p1.lat - p2.lat;
  const dg = p1.lon - p2.lon;
  const fmDegree = (p2.lat + p1.lat) / 2;
  const fm = fmDegree / (180 / Math.PI);
  const cosfm = Math.cos(fm);
  const cos2fm = 2 * cosfm * cosfm - 1;
  const cos3fm = cosfm * (2 * cos2fm - 1);
  const cos4fm = 2 * cos2fm * cos2fm - 1;
  const cos5fm = 2 * cos2fm * cos3fm - cosfm;
  const k1 = 111.13209 - 0.566605 * cos2fm + 0.0012 * cos4fm;
  const k2 = 111.41513 * cosfm - 0.09455 * cos3fm + 0.00012 * cos5fm;
  return Math.sqrt(k1 * df * (k1 * df) + k2 * dg * (k2 * dg));
}

function toCircuitType(score: Score): CircuitType {
  const desc = score.description.toLowerCase();
  if (desc.includes('fai')) {
    return CircuitType.FaiTriangle;
  }
  if (desc.includes('triangle')) {
    return CircuitType.FlatTriangle;
  }
  if (desc.includes('out and return')) {
    return CircuitType.OutAndReturn;
  }
  if (desc.includes('quad')) {
    return CircuitType.Quad;
  }
  return CircuitType.OpenDistance;
}

function convertRustigcScore(score: Score, track: ScoringTrack): ScoringResult {
  const points = track.points;
  const circuit = toCircuitType(score);
  const turnpoints: LatLon[] = score.turnpoints.map((idx) => ({
    lat: points[idx].lat,
    lon: points[idx].lon,
  }));

  let startPoint: LatLon | undefined;
  let endPoint: LatLon | undefined;
  let closingPoints: { in: LatLon; out: LatLon } | undefined;
  let path: LatLon[] = [];
  const legs: Leg[] = [];

  if (score.circuit) {
    closingPoints = {
      in: { lat: points[score.entry].lat, lon: points[score.entry].lon },
      out: { lat: points[score.exit].lat, lon: points[score.exit].lon },
    };
    path = [closingPoints.in, ...turnpoints, closingPoints.out];

    for (let i = 0; i < turnpoints.length; i++) {
      const from = turnpoints[i];
      const to = turnpoints[(i + 1) % turnpoints.length];
      legs.push({
        name: `leg${i}`,
        lengthKm: distanceEarthFCC(from, to),
        start: from,
        end: to,
      });
    }
  } else {
    startPoint = { lat: points[score.entry].lat, lon: points[score.entry].lon };
    endPoint = { lat: points[score.exit].lat, lon: points[score.exit].lon };
    path = [startPoint, ...turnpoints, endPoint];

    const pts = [startPoint, ...turnpoints, endPoint];
    for (let i = 0; i < pts.length - 1; i++) {
      legs.push({
        name: `leg${i}`,
        lengthKm: distanceEarthFCC(pts[i], pts[i + 1]),
        start: pts[i],
        end: pts[i + 1],
      });
    }
  }

  const solutionIndices = [score.entry, ...score.turnpoints, score.exit];

  return {
    score: score.score,
    lengthKm: score.distance_km,
    multiplier: score.multiplier,
    circuit,
    closingRadiusKm: score.circuit ? score.threshold_m / 1000 : undefined,
    solutionIndices,
    optimal: true,
    startPoint,
    endPoint,
    legs,
    turnpoints,
    closingPoints,
    path,
  };
}

async function scoreWithRustigc(track: ScoringTrack, leagueName: string): Promise<ScoringResult | undefined> {
  const points = track.points;
  if (points.length < 2) {
    return undefined;
  }
  await ensureRustigc();

  const coords = new Float64Array(points.length * 2);
  for (let i = 0; i < points.length; i++) {
    coords[2 * i] = points[i].lat;
    coords[2 * i + 1] = points[i].lon;
  }

  const scorer = new Scorer(coords);
  const score = scorer.solve(leagueName);
  if (!score) {
    return undefined;
  }

  console.log({ score });

  return convertRustigcScore(score, track);
}

addEventListener('message', async (event: MessageEvent<Request>) => {
  const { request, id } = event.data;
  const optimizer = getOptimizer(request);
  let result: IteratorResult<ScoringResult, ScoringResult>;
  do {
    result = optimizer.next();
  } while (!result.done);

  let rustigc: ScoringResult | undefined;
  if (request.ruleName === 'FFVL') {
    try {
      rustigc = await scoreWithRustigc(request.track, 'cfd');
    } catch (e) {
      console.error('[Optimizer Worker] rustigc scoring error:', e);
    }
  }

  postMessage({
    response: rustigc?.circuit === CircuitType.Quad ? rustigc : result.value,
    id,
  } satisfies Response);
});
