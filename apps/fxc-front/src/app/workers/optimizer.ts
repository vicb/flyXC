import type { ScoringRequest, ScoringResult } from '@flyxc/optimizer';
import { CircuitType, initOptimizer, scoreTrack } from '@flyxc/optimizer';
import wasmUrl from 'rustigc-wasm/rustigc_wasm_bg.wasm?url';

export interface Request {
  request: ScoringRequest;
  id?: number;
}

export interface Response {
  response: ScoringResult;
  id?: number;
}

let initPromise: Promise<void> | undefined;

function ensureReady(): Promise<void> {
  return (initPromise ??= initOptimizer(wasmUrl).catch((error) => {
    initPromise = undefined;
    throw error;
  }));
}

addEventListener('message', async (event: MessageEvent<Request>) => {
  const { request, id } = event.data;
  let response: ScoringResult;
  try {
    await ensureReady();
    response = scoreTrack(request.track.points, request.ruleName);
  } catch (error) {
    console.error('Optimization error:', error);
    response = {
      score: 0,
      lengthKm: 0,
      multiplier: 0,
      circuit: CircuitType.OpenDistance,
      turnpoints: [],
      path: [],
    };
  }

  postMessage({
    response,
    id,
  } satisfies Response);
});
