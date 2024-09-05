import type { LatLonAltTime, ScoringResult } from '@flyxc/optimizer/lib/optimizer';

import { type Response as WorkerResponse } from '../../workers/optimizer';
import ScoringWorker from '../../workers/optimizer?worker';
import { getScoringRuleName, type LeagueCode } from './league/leagues';

export type ScoringResultHandler = (result: ScoringResult) => void;

export class Scorer {
  private scoringWorker?: Worker;
  private currentScoringRequestId = 0;
  /**
   * Associate the result handler of every scoring request with the scoring request identifier.
   * The scoring request identifier is a sequence number computed by incrementation of `currentScoringRequestId` field.
   * This identifier is sent to the worker (`id` field of the message) and returned by the worker in the response
   * message (`data.id` field).
   * The handler is retrieved and invoked when the worker response is received.
   */
  private handlers: Map<number, ScoringResultHandler> = new Map();

  /**
   * Scores a track
   *
   * @param track
   * @param league
   * @param handleScoringResult Callback called with the scoring solution
   * @return  a number that identifies this scoring request
   */
  public score(track: LatLonAltTime[], league: LeagueCode, handleScoringResult: ScoringResultHandler): number {
    // stores the handler for retrieval when handling worker response message
    const id = ++this.currentScoringRequestId;
    this.handlers.set(id, handleScoringResult);
    try {
      this.getWorker().postMessage({
        request: {
          track: {
            points: track,
          },
          ruleName: getScoringRuleName(league),
        },
        id,
      });
      return id;
    } catch (error) {
      console.error('Error posting message to scoring worker:', error);
      return -1;
    }
  }

  /**
   * release resources related to the worker.
   */
  public cleanup() {
    this.scoringWorker?.terminate();
  }

  // get worker with lazy instanciation
  private getWorker(): Worker {
    this.scoringWorker ??= this.createWorker();
    return this.scoringWorker;
  }

  private createWorker(): Worker {
    const scoringWorker = new ScoringWorker();
    scoringWorker.onmessage = (msg: MessageEvent<WorkerResponse>) => {
      if (msg.data.id) {
        // retrieve the handler and invoke it
        this.handlers.get(msg.data.id)?.call(this, msg.data.response);
        if (msg.data.response.optimal) {
          this.handlers.delete(msg.data.id);
        }
      }
    };
    scoringWorker.onerror = (error: any) => {
      console.error('Scoring Worker Error:', error);
    };
    return scoringWorker;
  }
}
