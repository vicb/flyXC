import { ScoreInfo, Scoring } from 'igc-xc-score';
import { RuntimeTrack } from '@flyxc/common';
import { scoreTrack } from '../logic/score/improvedScorer';

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

w.onmessage = async (message: MessageEvent<Request>) => {
  console.info('scoring: received', message);
  try {
    const request = message.data;
    if (request.league) {
      const solution = await scoreTrack(request.track, request.league);
			if (solution && solution.scoreInfo) {
				const {name, code, multiplier} = solution.opt.scoring;
				let response: Response = {
					scoreInfo: solution.scoreInfo,
					scoring: {name, code, multiplier},
					trackId: message.data.track.id
				}
				console.info("scoring: computed", response.scoreInfo.score, response)
        w.postMessage(response, {});
      }
    }
  } catch (e) {
    console.error('solver failed', e);
  }
};
