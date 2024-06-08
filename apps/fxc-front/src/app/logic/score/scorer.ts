import type { LatLonAltTime, ScoringResult } from '@flyxc/optimizer/lib/optimizer';

import { type Request as WorkerRequest, type Response as WorkerResponse } from '../../workers/optimizer';
import ScoringWorker from '../../workers/optimizer?worker';
import { getScoringRuleName, type LeagueCode } from './league/leagues';

export enum ScoreOrigin {
  INTERACTIVE = 'interactive',
  TRACK = 'track',
}

export type Score = ScoringResult & { origin: ScoreOrigin };

export type ScoringResultHandler = (result: ScoringResult) => void;

export type ScoringRequestIdProvider = () => number;

export class Scorer {
  private scoringWorker: Worker | null = null;
  private readonly handleScoringResult: ScoringResultHandler;
  private readonly getScoringRequestId: ScoringRequestIdProvider;

  /**
   * Builds a new Scorer with the two required functions.
   *
   * Bear in mind that these function are invoked in a worker environment which means that 'this' is not what you
   * would expect. If a function use 'this' and is sent to the constructor as a reference, it will not work.
   * In this case, the function should be wrapped (see example bellow).<br/>
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
   *   // although this is a legal code, it will not work because 'this' in handleResult represents the worker and then
   *   // 'this.doSomethingWithResult(result)' will fail with this.doSomethingWithResult is not a function.
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
  constructor(handleScoringResult: ScoringResultHandler, getScoringRequestId: ScoringRequestIdProvider) {
    this.handleScoringResult = handleScoringResult;
    this.getScoringRequestId = getScoringRequestId;
  }

  /**
   * Computes the score for a given track and league, in a given caller context identified by scoringRequestId.
   * The result is handled by ScoringResultHandler, only if this result references the same scoringRequestId.
   * @param track
   * @param league
   * @param scoringRequestId
   */
  public score(track: LatLonAltTime[], league: LeagueCode, scoringRequestId: number) {
    const request: WorkerRequest = {
      request: {
        track: {
          points: track,
        },
        ruleName: getScoringRuleName(league),
      },
      id: scoringRequestId,
    };
    // lazy building of the worker
    this.scoringWorker = this.scoringWorker ?? this.buildWorker();
    this.scoringWorker.postMessage(request);
  }

  /**
   * release resources related to the worker.
   */
  public destroy() {
    if (!this.scoringWorker) {
      return;
    }
    this.scoringWorker.onmessage = null;
    this.scoringWorker.onerror = null;
    this.scoringWorker.onmessageerror = null;
    this.scoringWorker.terminate();
    this.scoringWorker = null;
  }

  private buildWorker(): Worker {
    const scoringWorker = new ScoringWorker();
    scoringWorker.onmessage = (msg: MessageEvent<WorkerResponse>) => {
      // Ensure that this response matches the request
      if (msg.data.id === this.getScoringRequestId()) {
        this.handleScoringResult(msg.data.response);
      }
    };
    return scoringWorker;
  }
}
