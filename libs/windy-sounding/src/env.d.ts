import type * as Windy from './windy-exports';

declare global {
  const __BUILD_TIMESTAMP__: number;
  const SwipeListener: any;
  const W: typeof Windy;
}
