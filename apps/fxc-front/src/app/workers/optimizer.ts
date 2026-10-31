import type { LatLon, ScoringResult, ScoringRuleName } from '@flyxc/optimizer';
import { initOptimizer, scoreTrack } from '@flyxc/optimizer';
import wasmUrl from 'rustigc-wasm/rustigc_wasm_bg.wasm?url';

export interface Request {
  points: LatLon[];
  ruleName: ScoringRuleName;
  id?: number;
}

export interface Response {
  response?: ScoringResult;
  error?: string;
  id?: number;
}

addEventListener('message', async (event: MessageEvent<Request>) => {
  const { points, ruleName, id } = event.data;
  try {
    await initOptimizer(wasmUrl);
    const response = scoreTrack(points, ruleName);
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
