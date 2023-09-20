import { ScoreInfo, Scoring } from 'igc-xc-score';
import { scoreTrack, ScoringTrack } from '../logic/score/improvedScorer';
import { LeagueCode } from '../logic/score/league';

export interface Request {
  track: ScoringTrack;
  leagueCode?: LeagueCode;
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
    if (request.leagueCode) {
      const scoreAndRoute = await scoreTrack(request.track, request.leagueCode);
      if (scoreAndRoute) w.postMessage(scoreAndRoute, {});
    }
  } catch (e) {
    console.error('solver failed', e);
  }
};
