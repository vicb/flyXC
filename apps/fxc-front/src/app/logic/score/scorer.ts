import type { LatLonAltTime, ScoringResult } from '@flyxc/optimizer/lib/optimizer';

import { type Response as WorkerResponse } from '../../workers/optimizer';
import ScoringWorker from '../../workers/optimizer?worker';
import { getScoringRuleName, type LeagueCode } from './league/leagues';

export type ScoringResultHandler = (result: ScoringResult) => void;

export type ScoringRequestIdProvider = () => number;

export class Scorer {
  private scoringWorker?: Worker;

  /**
   * `handleScoringResult` and `getScoringRequestId` functions are invoked in a
   * worker context which means that 'this' keyword is a reference to the worker itself.
   * If a function body uses 'this' keyword  and is sent to the constructor as a reference, it will not work.
   * In this case, the function should be wrapped in an arrow function (see example bellow).<br/>
   *
   * E.g:
   * <pre>
   * class MyClass {
   * ...
   *   handleResult(result: ScoringResult){
   *   ...
   *     this.doSomethingWithResult(result);
   *   ...
   *   }
   *   ...
   *   // although this is a valid code, it will not work because 'this' is the worker.
   *   scorer = new Scorer(this.handleResult,...);
   *   // the correct syntax is:
   *   scorer = new Scorer((result)=>this.handleResult(result),...);
   * }
   * </pre>
   * @param handleScoringResult {ScoringResultHandler}
   *        Takes the ScoringResult into account
   * @param getScoringRequestId {ScoringRequestIdProvider}
   *        Get a scoring request identifier. The ScoringResultHandler is invoked only if the returned
   *        request identifier matchs the request identifier returned by the underlying optimizer.
   */
  constructor(
    private handleScoringResult: ScoringResultHandler,
    private getScoringRequestId: ScoringRequestIdProvider,
  ) {}

  /**
   * The result is handled by the ScoringResultHandler, only if this result references the same scoringRequestId.
   * @param track
   * @param league
   * @param scoringRequestId
   */
  public score(track: LatLonAltTime[], league: LeagueCode, scoringRequestId: number) {
    // lazy creation of the worker
    this.scoringWorker ??= this.createWorker();
    this.scoringWorker.postMessage({
      request: {
        track: {
          points: track,
        },
        ruleName: getScoringRuleName(league),
      },
      id: scoringRequestId,
    });
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
  }

  private createWorker(): Worker {
    const scoringWorker = new ScoringWorker();
    scoringWorker.onmessage = (msg: MessageEvent<WorkerResponse>) => {
      // Ensure that this response matches the request
      if (msg.data.id === this.getScoringRequestId()) {
        this.handleScoringResult(msg.data.response);
      }
    };
    scoringWorker.onerror = (error) => {
      console.error('Scoring Worker Error:', error);
    };
    return scoringWorker;
  }
}
