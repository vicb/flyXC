import { CircuitType } from '@flyxc/optimizer/lib/api';
import type { LatLonAltTime, ScoringResult } from '@flyxc/optimizer/lib/optimizer';

import { type Request as WorkerRequest, type Response as WorkerResponse } from '../../workers/optimizer';
import ScoringWorker from '../../workers/optimizer?worker';
import { getScoringRuleName, type LeagueCode } from './league/leagues';

export class Score {
  distanceM: number;
  indexes: number[];
  multiplier: number;
  circuit: CircuitType;
  closingRadiusKm: number;
  points: number;

  constructor(score: Partial<Score>) {
    this.distanceM = score.distanceM ?? 0;
    this.indexes = score.indexes ?? [];
    this.multiplier = score.multiplier ?? 1;
    this.circuit = score.circuit ?? CircuitType.OpenDistance;
    this.closingRadiusKm = score.closingRadiusKm ?? 0;
    this.points = score.points ?? 0;
  }
}

export type ScoringResultHandler = (result: ScoringResult) => void;

export type ScoringRequestIdProvider = () => number;

export class Scorer {
  private scoringWorker?: Worker;
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
    // lazy building of the worker
    const worker = this.scoringWorker ?? this.buildWorker();
    const request: WorkerRequest = {
      request: {
        track: {
          points: track,
        },
        ruleName: getScoringRuleName(league),
      },
      id: scoringRequestId,
    };
    worker.postMessage(request);
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
