import {BRecord, IGCFile} from 'igc-parser';
import {ScoreInfo, Scoring, scoringRules, solver} from 'igc-xc-score';
import {RuntimeTrack} from "@flyxc/common";

export interface Request {
	track: RuntimeTrack;
	league?: string;
	config?: { [key: string]: any } | undefined;
}

export interface Response {
	scoreInfo: ScoreInfo;
	scoring: Scoring;
	trackId: string;
}

const w: Worker = self as any;

w.onmessage = (message: MessageEvent<Request>) => {
	console.info('scoring: received', message);
	try {
		const request = message.data;
		const flight = igcFile(request.track);
		const solutions = solver(flight, getScoringRules(request), request.config);
		let solution = solutions.next();
		if (solution.value.scoreInfo){
			let response: Response = {
				scoreInfo: solution.value.scoreInfo,
				scoring: {name:solution.value.opt.scoring.name, code: solution.value.opt.scoring.code, multiplier: solution.value.opt.scoring.multiplier},
				trackId: message.data.track.id
			}
			console.info("scoring: computed", response.scoreInfo.score, response)
			w.postMessage(response, {});
		}
	} catch (e) {
		console.error('solver failed', e);
	}
};

function getScoringRules(request:Request) {
	let scoringRule;
	switch (request.league) {
		case "France (CFD)":
			scoringRule = scoringRules.FFVL;
			break;
		case "XContest":
			scoringRule = scoringRules.XContest;
			break;
		// TODO: others...
		default :
			scoringRule =  scoringRules.FFVL;
	}
	return scoringRule
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
