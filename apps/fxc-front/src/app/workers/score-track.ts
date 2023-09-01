import {BRecord, IGCFile} from 'igc-parser';
import {ScoreInfo, Scoring, scoringRules, solver} from 'igc-xc-score';
import {RuntimeTrack} from "@flyxc/common";

export interface Request {
	track: RuntimeTrack;
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
		const solutions = solver(flight, scoringRules.FFVL, request.config);
		let solution = solutions.next();
		if (solution.value.scoreInfo){
			let response: Response = {
				scoreInfo: solution.value.scoreInfo,
				scoring: {name:solution.value.opt.scoring.name, code: solution.value.opt.scoring.code, multiplier: solution.value.opt.scoring.multiplier},
				trackId: message.data.track.id
			}
			console.info("scoring: computed", response)
			w.postMessage(response, {});
		}
	} catch (e) {
		console.error('solver failed', e);
	}
};

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
	let result: IGCFile = {
		date: new Date(track.minTimeSec).toISOString(),
		fixes: fixes,
	}
	return result
}
