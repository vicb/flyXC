import type { ScoringRequest, ScoringResult } from '@flyxc/optimizer';
import { initOptimizer, scoreTrack } from '@flyxc/optimizer';
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
  return (initPromise ??= initOptimizer(wasmUrl));
}

addEventListener('message', async (event: MessageEvent<Request>) => {
  const { request, id } = event.data;
  await ensureReady();
  const response = scoreTrack(request.track.points, request.ruleName);

  postMessage({
    response,
    id,
  } satisfies Response);
});
