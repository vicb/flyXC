import type { ScoringRequest, ScoringResult } from '@flyxc/optimizer';
import { initOptimizer, scoreTrack } from '@flyxc/optimizer';
import wasmUrl from 'rustigc-wasm/rustigc_wasm_bg.wasm?url';

export interface Request {
  request: ScoringRequest;
  id?: number;
}

export interface Response {
  response?: ScoringResult;
  error?: string;
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
  try {
    await ensureReady();
    const response = scoreTrack(request.track.points, request.ruleName);
    postMessage({
      response,
      id,
    } satisfies Response);
  } catch (error) {
    console.error('Optimization error:', error);
    postMessage({
      error: error instanceof Error ? error.message : String(error),
      id,
    } satisfies Response);
  }
});
