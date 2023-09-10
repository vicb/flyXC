import {RuntimeTrack} from "@flyxc/common"
import {scoringRules, Solution, solver} from 'igc-xc-score';
import {BRecord, IGCFile} from "igc-parser";

export function scoreTrack(track: RuntimeTrack,
						   leagueIdentifier: string): Solution | undefined {
	const scoringRules = getScoringRules(leagueIdentifier);
	if (scoringRules) {
		const solutions = solver(igcFile(track), scoringRules, undefined);
		return solutions.next().value;
	}
	return undefined;
}

// build a fake igc file from a track
function igcFile(track: RuntimeTrack): IGCFile {
	let fixes: BRecord[] = []
	for (let i = 0; i < track.lon.length; i++) {
		// @ts-ignore
		const record: BRecord = {
			timestamp: track.timeSec[i],
			latitude: track.lat[i],
			longitude: track.lon[i],
			valid: true,
		}
		fixes.push(record)
	}
	// @ts-ignore
	return {
		date: new Date(track.minTimeSec).toISOString(),
		fixes: fixes,
	}
}

function getScoringRules(leagueIdentifier: string): object | undefined {
	return leaguesScoringRules.get(leagueIdentifier);
}

const scoringBaseModel = scoringRules["XContest"];
const openDistanceBase = scoringBaseModel[0];
const freeTriangleBase = scoringBaseModel[1];
const faiTriangleBase = scoringBaseModel[2];
const outAndReturnBase = scoringRules["FAI-OAR"][0];

const czlScoringRule = [
	{...openDistanceBase, multiplier: 1},
	{...freeTriangleBase, multiplier: 1.8},
	{...faiTriangleBase, multiplier: 2.2},
]

const czeScoringRule = [
	{...openDistanceBase, multiplier: 1},
	{...freeTriangleBase, multiplier: 1.2},
	{...faiTriangleBase, multiplier: 1.4},
]

const czoScoringRule = [
	{...openDistanceBase, multiplier: 0.8},
	{...freeTriangleBase, multiplier: 1.2},
	{...faiTriangleBase, multiplier: 1.4},
]

const leoScoringRule = [
	{...openDistanceBase, multiplier: 1.5},
	{...freeTriangleBase, multiplier: 1.75, closingDistanceRelative: 0.2},
	{...faiTriangleBase, multiplier: 2, closingDistanceRelative: 0.2},
]

const norScoringRule = [
	{...openDistanceBase, multiplier: 1},
	{...freeTriangleBase, multiplier: 1.7, closingDistanceRelative: 0.05},
	{...freeTriangleBase, multiplier: 1.5, closingDistanceRelative: 0.2},
	{...faiTriangleBase, multiplier: 2.4, closingDistanceRelative: 0.05},
	{...faiTriangleBase, multiplier: 2.2, closingDistanceRelative: 0.2},
]

const ukcScoringRule = [
	{...openDistanceBase, multiplier: 1, minDistance: 5},
	{...outAndReturnBase, multiplier: 1.2, minDistance: 5},
	{...outAndReturnBase, multiplier: 1.3, minDistance: 15},
	{...outAndReturnBase, multiplier: 1.7, minDistance: 35},
	{...freeTriangleBase, multiplier: 1.2, minDistance: 5},
	{...freeTriangleBase, multiplier: 1.3, minDistance: 15},
	{...freeTriangleBase, multiplier: 1.7, minDistance: 35},
	{...faiTriangleBase, multiplier: 1.5, minDistance: 5},
	{...faiTriangleBase, multiplier: 1.7, minDistance: 15},
	{...faiTriangleBase, multiplier: 2, minDistance: 35},
]

const ukiScoringRule = [
	{...openDistanceBase, multiplier: 1, minDistance: 10},
	{...outAndReturnBase, multiplier: 1.2, minDistance: 35},
	{...freeTriangleBase, multiplier: 1.2, minDistance: 35},
	{...faiTriangleBase, multiplier: 1.5, minDistance: 25},
]

const uknScoringRule = [
	{...openDistanceBase, multiplier: 1, minDistance: 10},
	{...outAndReturnBase, multiplier: 1.3, minDistance: 15},
	{...outAndReturnBase, multiplier: 1.7, minDistance: 35},
	{...freeTriangleBase, multiplier: 1.3, minDistance: 15},
	{...freeTriangleBase, multiplier: 1.7, minDistance: 35},
	{...faiTriangleBase, multiplier: 1.7, minDistance: 15},
	{...faiTriangleBase, multiplier: 2, minDistance: 25},
]

const xcppgScoringRule = [
	{...openDistanceBase, multiplier: 1},
	{...freeTriangleBase, multiplier: 2, closingDistanceFixed: 0.8},
	{...faiTriangleBase, multiplier: 4, closingDistanceFixed: 0.8},
]

const wxcScoringRule = [
	{...openDistanceBase, multiplier: 1},
	{...freeTriangleBase, multiplier: 1.75, closingDistanceRelative: 0.2},
	{...faiTriangleBase, multiplier: 2, closingDistanceFixed: 0.2},
]

const leaguesScoringRules: Map<string, object> = new Map()
	.set("czl", czlScoringRule)
	.set("cze", czeScoringRule)
	.set("czo", czoScoringRule)
	.set("leo", leoScoringRule)
	.set("nor", norScoringRule)
	.set("ukc", ukcScoringRule)
	.set("uki", ukiScoringRule)
	.set("ukn", uknScoringRule)
	.set("xc", scoringRules.XContest)
	.set("xcppg", xcppgScoringRule)
	.set("wxc", wxcScoringRule)
;
