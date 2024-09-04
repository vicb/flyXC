import type { LatLonAltTime, ScoringResult } from '@flyxc/optimizer/lib/optimizer';

import { type Response as WorkerResponse } from '../../workers/optimizer';
import ScoringWorker from '../../workers/optimizer?worker';
import { getScoringRuleName, type LeagueCode } from './league/leagues';

export type ScoringResultHandler = (result: ScoringResult) => void;

export class Scorer {
  private scoringWorker?: Worker;
  private currentScoringRequestId = 0;
  private handlers: Map<number, ScoringResultHandler> = new Map();

  /**
   * Scores a track
   *
   * `handleScoringResult` function is invoked in a
   * worker context which means that 'this' keyword is a reference to the worker itself.
   * If a function body uses 'this' keyword  and is sent to the constructor as a reference, it will not work.
   * In this case, the function should be wrapped in an arrow function (see example bellow).<br/>
   *
   * E.g:
   * ```
   * class MyClass {
   * ...
   *   handleResult(result: ScoringResult){
   *   ...
   *     this.doSomethingWithResult(result);
   *   ...
   *   }
   *   ...
   *   // although this is a valid code, it will not work because 'this' is the worker.
   *   const scorer = new Scorer();
   *   const scoringRequestId = scorer.score(track, league, this.handleResult);
   *   // the correct syntax is:
   *   const scoringRequestId = scorer.core(track, league, (result)=>this.handleResult(result));
   * }
   * ```
   *
   * @param track
   * @param league
   * @param handleScoringResult {ScoringResultHandler}
   *        Takes the ScoringResult into account
   * @return {number} a number that identifies this scoring request
   */
  public score(track: LatLonAltTime[], league: LeagueCode, handleScoringResult: ScoringResultHandler): number {
    // lazy creation of the worker
    this.scoringWorker ??= this.createWorker();
    try {
      // stores the handler for retrieval when handling worker response message
      const scoringRequestId = this.currentScoringRequestId++;
      this.handlers.set(scoringRequestId, handleScoringResult );
      this.scoringWorker.postMessage({
        request: {
          track: {
            points: track,
          },
          ruleName: getScoringRuleName(league),
        },
        id: scoringRequestId,
      });
      return scoringRequestId;
    } catch (error) {
      console.error('Error posting message to scoring worker:', error);
      return -1;
    }
  }

  /**
   * release resources related to the worker.
   */
  public cleanup() {
    if (!this.scoringWorker) {
      return;
    }
    this.scoringWorker.onmessage = null;
    this.scoringWorker.onerror = null;
    this.scoringWorker.onmessageerror = null;
    this.scoringWorker.terminate();
    this.scoringWorker = undefined;
    this.handlers.clear();
    this.currentScoringRequestId = 0;
  }

  private createWorker(): Worker {
    const scoringWorker = new ScoringWorker();
    scoringWorker.onmessage = (msg: MessageEvent<WorkerResponse>) => {
      if (msg.data.id) {
        // retrieve the handler and invoke it
        this.handlers.get(msg.data.id)?.call(this, msg.data.response)
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
