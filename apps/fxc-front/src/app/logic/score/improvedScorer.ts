import { Point } from '@flyxc/common';
import { Point as XcScorePoint, scoringRules, Solution } from 'igc-xc-score';
import { BRecord, IGCFile } from 'igc-parser';
import { CircuitType, Score } from './scorer';
import { LeagueCode } from './league';

async function lazyLoadedSolver(): Promise<typeof _solver> {
  if (!_solver) {
    const { solver } = await import('igc-xc-score');
    _solver = solver;
  }
  return _solver;
}

let _solver: (
  flight: IGCFile,
  scoringRules: object,
  config?: { [key: string]: any } | undefined,
) => Iterator<Solution, Solution>;

export type ScoreAndRoute = { score: Score; route: Point[] };
export type ScoringTrack = { lat: number[]; lon: number[]; timeSec: number[]; minTimeSec: number };

export async function scoreTrack(track: ScoringTrack, leagueCode: LeagueCode): Promise<ScoreAndRoute | undefined> {
  const scoringRules = getScoringRules(leagueCode);
  if (scoringRules) {
    const solver = await lazyLoadedSolver();
    const solutions = solver(igcFile(track), scoringRules, undefined);
    const solution = solutions.next().value;
    return { score: toScore(solution), route: toRoute(solution) };
  }
  return undefined;
}

function toScore(solution: Solution): Score {
  return new Score({
    distance: solution.scoreInfo?.distance,
    points: solution.score,
    multiplier: solution.opt.scoring.multiplier,
    circuit: toCircuitType(solution.opt.scoring.code as CircuitTypeCode),
    indexes: getIndexes(solution),
    closingRadius: solution.scoreInfo?.cp?.d,
  });
}

// duplicated code from apps/fxc-front/src/app/logic/track.ts
type CircuitTypeCode = 'od' | 'tri' | 'fai' | 'oar';

function toCircuitType(code: CircuitTypeCode) {
  switch (code) {
    case 'od':
      return CircuitType.OpenDistance;
    case 'fai':
      return CircuitType.FaiTriangle;
    case 'oar':
      return CircuitType.OutAndReturn;
    case 'tri':
      return CircuitType.FlatTriangle;
  }
}

// end duplication

function getIndexes(solution: Solution) {
  let currentIndex = -1;
  const entryPointsStart = getEntryPointsStart(solution);
  const result = entryPointsStart ? [currentIndex++] : [];
  const closingPointsIn = getClosingPointsIn(solution);
  if (closingPointsIn) result.push(currentIndex++);
  solution.scoreInfo?.legs?.map((leg) => leg.start.r).forEach(() => result.push(currentIndex++));
  const closingPointsOut = getClosingPointsOut(solution);
  if (closingPointsOut) result.push(currentIndex++);
  const entryPointsFinish = getEntryPointsFinish(solution);
  if (entryPointsFinish) result.push(currentIndex++);
  return result;
}

function push(point: XcScorePoint | undefined, route: Point[]) {
  if (point) route.push(getPoint(point));
}

function toRoute(solution: Solution): Point[] {
  const route: Point[] = [];
  push(getEntryPointsStart(solution), route);
  const closingPointsIn = getClosingPointsIn(solution);
  if (closingPointsIn) route.push(getPoint(closingPointsIn));
  solution.scoreInfo?.legs?.map((leg) => leg.start).forEach((it) => route.push(getPoint(it)));
  const closingPointsOut = getClosingPointsOut(solution);
  if (closingPointsOut) route.push(getPoint(closingPointsOut));
  const entryPointsFinish = getEntryPointsFinish(solution);
  if (entryPointsFinish) route.push(getPoint(entryPointsFinish));
  return route;
}

function getEntryPointsStart(solution: Solution) {
  return solution.scoreInfo?.ep?.start;
}

function getEntryPointsFinish(solution: Solution) {
  return solution.scoreInfo?.ep?.finish;
}

function getClosingPointsIn(solution: Solution) {
  return solution.scoreInfo?.cp?.in;
}

function getClosingPointsOut(solution: Solution) {
  return solution.scoreInfo?.cp?.out;
}

function getPoint(point: XcScorePoint): Point {
  return { ...point };
}

// build a fake igc file from a track
function igcFile(track: ScoringTrack): IGCFile {
  const fixes: BRecord[] = [];
  for (let i = 0; i < track.lon.length; i++) {
    // @ts-ignore
    const record: BRecord = {
      timestamp: track.timeSec[i],
      latitude: track.lat[i],
      longitude: track.lon[i],
      valid: true,
    };
    fixes.push(record);
  }
  // @ts-ignore
  return {
    date: new Date(track.minTimeSec).toISOString(),
    fixes: fixes,
  };
}

function getScoringRules(leagueCode: LeagueCode): object | undefined {
  return leaguesScoringRules.get(leagueCode);
}

const scoringBaseModel = scoringRules['XContest'];
const openDistanceBase = scoringBaseModel[0];
const freeTriangleBase = scoringBaseModel[1];
const faiTriangleBase = scoringBaseModel[2];
const outAndReturnBase = scoringRules['FAI-OAR'][0];

const czlScoringRule = [
  { ...openDistanceBase, multiplier: 1 },
  { ...freeTriangleBase, multiplier: 1.8 },
  { ...faiTriangleBase, multiplier: 2.2 },
];

const czeScoringRule = [
  { ...openDistanceBase, multiplier: 1 },
  { ...freeTriangleBase, multiplier: 1.2 },
  { ...faiTriangleBase, multiplier: 1.4 },
];

const czoScoringRule = [
  { ...openDistanceBase, multiplier: 0.8 },
  { ...freeTriangleBase, multiplier: 1.2 },
  { ...faiTriangleBase, multiplier: 1.4 },
];

const leoScoringRule = [
  { ...openDistanceBase, multiplier: 1.5 },
  { ...freeTriangleBase, multiplier: 1.75, closingDistanceRelative: 0.2 },
  { ...faiTriangleBase, multiplier: 2, closingDistanceRelative: 0.2 },
];

const norScoringRule = [
  { ...openDistanceBase, multiplier: 1 },
  { ...freeTriangleBase, multiplier: 1.7, closingDistanceRelative: 0.05 },
  { ...freeTriangleBase, multiplier: 1.5, closingDistanceRelative: 0.2 },
  { ...faiTriangleBase, multiplier: 2.4, closingDistanceRelative: 0.05 },
  { ...faiTriangleBase, multiplier: 2.2, closingDistanceRelative: 0.2 },
];

const ukcScoringRule = [
  { ...openDistanceBase, multiplier: 1, minDistance: 5 },
  { ...outAndReturnBase, multiplier: 1.2, minDistance: 5 },
  { ...outAndReturnBase, multiplier: 1.3, minDistance: 15 },
  { ...outAndReturnBase, multiplier: 1.7, minDistance: 35 },
  { ...freeTriangleBase, multiplier: 1.2, minDistance: 5 },
  { ...freeTriangleBase, multiplier: 1.3, minDistance: 15 },
  { ...freeTriangleBase, multiplier: 1.7, minDistance: 35 },
  { ...faiTriangleBase, multiplier: 1.5, minDistance: 5 },
  { ...faiTriangleBase, multiplier: 1.7, minDistance: 15 },
  { ...faiTriangleBase, multiplier: 2, minDistance: 35 },
];

const ukiScoringRule = [
  { ...openDistanceBase, multiplier: 1, minDistance: 10 },
  { ...outAndReturnBase, multiplier: 1.2, minDistance: 35 },
  { ...freeTriangleBase, multiplier: 1.2, minDistance: 35 },
  { ...faiTriangleBase, multiplier: 1.5, minDistance: 25 },
];

const uknScoringRule = [
  { ...openDistanceBase, multiplier: 1, minDistance: 10 },
  { ...outAndReturnBase, multiplier: 1.3, minDistance: 15 },
  { ...outAndReturnBase, multiplier: 1.7, minDistance: 35 },
  { ...freeTriangleBase, multiplier: 1.3, minDistance: 15 },
  { ...freeTriangleBase, multiplier: 1.7, minDistance: 35 },
  { ...faiTriangleBase, multiplier: 1.7, minDistance: 15 },
  { ...faiTriangleBase, multiplier: 2, minDistance: 25 },
];

const xcppgScoringRule = [
  { ...openDistanceBase, multiplier: 1 },
  { ...freeTriangleBase, multiplier: 2, closingDistanceFixed: 0.8 },
  { ...faiTriangleBase, multiplier: 4, closingDistanceFixed: 0.8 },
];

const wxcScoringRule = [
  { ...openDistanceBase, multiplier: 1 },
  { ...freeTriangleBase, multiplier: 1.75, closingDistanceRelative: 0.2 },
  { ...faiTriangleBase, multiplier: 2, closingDistanceFixed: 0.2 },
];

const leaguesScoringRules: Map<LeagueCode, object> = new Map()
  .set('czl', czlScoringRule)
  .set('cze', czeScoringRule)
  .set('czo', czoScoringRule)
  .set('fr', scoringRules['FFVL'])
  .set('leo', leoScoringRule)
  .set('nor', norScoringRule)
  .set('ukc', ukcScoringRule)
  .set('uki', ukiScoringRule)
  .set('ukn', uknScoringRule)
  .set('xc', scoringRules.XContest)
  .set('xcppg', xcppgScoringRule)
  .set('wxc', wxcScoringRule);
