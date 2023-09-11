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

w.onmessage = (message: MessageEvent<Request>) => {
  console.info('scoring: received', message);
  try {
    const request = message.data;
    if (request.league) {
      const solution = scoreTrack(request.track, request.league);
      if (solution && solution.scoreInfo) {
        const scoreInfo = solution.scoreInfo;
        const scoring = solution.opt.scoring;
        const trackId = message.data.track.id;
        let response: Response = { scoreInfo, scoring, trackId };
        console.info('scoring: computed', response.scoreInfo.score, response);
        w.postMessage(response, {});
      }
    }
  } catch (e) {
    console.error('solver failed', e);
  }
};
