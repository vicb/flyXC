import type { ScoringRequest, ScoringResult } from '@flyxc/optimizer';
import { getOptimizer } from '@flyxc/optimizer';

export interface Request {
  request: ScoringRequest;
  id?: number;
}

export interface Response {
  response: ScoringResult;
  id?: number;
}

addEventListener('message', (event: MessageEvent<Request>) => {
  const { request, id } = event.data;
  const optimizer = getOptimizer(request);
  let result: IteratorResult<ScoringResult, ScoringResult>;
  do {
    result = optimizer.next();
  } while (!result.done);

  postMessage({
    response: result.value,
    id,
  } satisfies Response);
});
