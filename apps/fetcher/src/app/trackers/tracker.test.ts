import type { TrackerNames } from '@flyxc/common';
import { protos, TRACKERS_MAX_FETCH_DURATION_SEC } from '@flyxc/common';
import { describe, expect, it } from 'vitest';

import { TrackerFetcher } from './tracker';

class TestTrackerFetcher extends TrackerFetcher {
  protected getTrackerName(): TrackerNames {
    return 'inreach';
  }

  public testGetTrackerFetchFromSec(
    id: number,
    fetchStartSec: number,
    maxLookbackSec: number,
    fixOverlapSec?: number,
  ): number {
    return this.getTrackerFetchFromSec(id, fetchStartSec, maxLookbackSec, fixOverlapSec);
  }
}

describe('TrackerFetcher.getTrackerFetchFromSec', () => {
  const nowSec = 1700000000;

  it('reduces fetch window when tracker has a recent lastFixSec', () => {
    // Last fix was 10 minutes ago, last fetch was 1 minute ago.
    const state = protos.FetcherState.create({
      pilots: {
        '1': {
          inreach: {
            enabled: true,
            account: 'pilot1',
            lastFetchSec: nowSec - 60,
            lastFixSec: nowSec - 10 * 60,
            nextFetchSec: nowSec,
            numErrors: 0,
            numRequests: 10,
            numConsecutiveErrors: 0,
          },
        },
      },
    });

    const fetcher = new TestTrackerFetcher(state, null as any);
    // 2h lookback, 5min overlap -> should fetch from (nowSec - 10m - 5m) = nowSec - 15m.
    const fetchFromSec = fetcher.testGetTrackerFetchFromSec(1, nowSec, 2 * 3600);
    expect(fetchFromSec).toBe(nowSec - 15 * 60);
  });

  it('falls back to lookback window when lastFixSec is older than the lookback window', () => {
    // Last fix was 3 hours ago, last fetch was 1 minute ago.
    const state = protos.FetcherState.create({
      pilots: {
        '1': {
          inreach: {
            enabled: true,
            account: 'pilot1',
            lastFetchSec: nowSec - 60,
            lastFixSec: nowSec - 3 * 3600,
            nextFetchSec: nowSec,
            numErrors: 0,
            numRequests: 10,
            numConsecutiveErrors: 0,
          },
        },
      },
    });

    const fetcher = new TestTrackerFetcher(state, null as any);
    // 2h lookback: lastFetchSec - 2h is more recent than 3h - 5m.
    const fetchFromSec = fetcher.testGetTrackerFetchFromSec(1, nowSec, 2 * 3600);
    expect(fetchFromSec).toBe(nowSec - 60 - 2 * 3600);
  });

  it('falls back to lookback window when tracker has default 24h-old lastFixSec', () => {
    const state = protos.FetcherState.create({
      pilots: {
        '1': {
          inreach: {
            enabled: true,
            account: 'pilot1',
            lastFetchSec: nowSec - 60,
            lastFixSec: nowSec - 24 * 3600,
            nextFetchSec: nowSec,
            numErrors: 0,
            numRequests: 1,
            numConsecutiveErrors: 0,
          },
        },
      },
    });

    const fetcher = new TestTrackerFetcher(state, null as any);
    const fetchFromSec = fetcher.testGetTrackerFetchFromSec(1, nowSec, 2 * 3600);
    expect(fetchFromSec).toBe(nowSec - 60 - 2 * 3600);
  });

  it('does not expand window when maxLookbackSec is smaller than fixOverlapSec (e.g. XContest)', () => {
    // XContest style: maxLookback is 20s, last fetch was 30s ago, last fix was 25s ago.
    const state = protos.FetcherState.create({
      pilots: {
        '1': {
          inreach: {
            enabled: true,
            account: 'pilot1',
            lastFetchSec: nowSec - 30,
            lastFixSec: nowSec - 25,
            nextFetchSec: nowSec,
            numErrors: 0,
            numRequests: 1,
            numConsecutiveErrors: 0,
          },
        },
      },
    });

    const fetcher = new TestTrackerFetcher(state, null as any);
    // lastFetchSec - maxLookbackSec = nowSec - 50s.
    // lastFixSec - 5m = nowSec - 325s.
    // Math.max picks nowSec - 50s.
    const fetchFromSec = fetcher.testGetTrackerFetchFromSec(1, nowSec, 20);
    expect(fetchFromSec).toBe(nowSec - 50);
  });

  it('supports custom fixOverlapSec', () => {
    const state = protos.FetcherState.create({
      pilots: {
        '1': {
          inreach: {
            enabled: true,
            account: 'pilot1',
            lastFetchSec: nowSec - 60,
            lastFixSec: nowSec - 10 * 60,
            nextFetchSec: nowSec,
            numErrors: 0,
            numRequests: 1,
            numConsecutiveErrors: 0,
          },
        },
      },
    });

    const fetcher = new TestTrackerFetcher(state, null as any);
    // With 10 min overlap: nowSec - 10m - 10m = nowSec - 20m.
    const fetchFromSec = fetcher.testGetTrackerFetchFromSec(1, nowSec, 2 * 3600, 10 * 60);
    expect(fetchFromSec).toBe(nowSec - 20 * 60);
  });

  it('guards against future lastFixSec from clock skew', () => {
    const state = protos.FetcherState.create({
      pilots: {
        '1': {
          inreach: {
            enabled: true,
            account: 'pilot1',
            lastFetchSec: nowSec - 60,
            lastFixSec: nowSec + 3600, // 1 hour in future
            nextFetchSec: nowSec,
            numErrors: 0,
            numRequests: 1,
            numConsecutiveErrors: 0,
          },
        },
      },
    });

    const fetcher = new TestTrackerFetcher(state, null as any);
    // Should clamp lastFixSec to fetchStartSec (nowSec), resulting in nowSec - 5m.
    const fetchFromSec = fetcher.testGetTrackerFetchFromSec(1, nowSec, 2 * 3600);
    expect(fetchFromSec).toBe(nowSec - 5 * 60);
  });

  it('bounds by TRACKERS_MAX_FETCH_DURATION_SEC', () => {
    const state = protos.FetcherState.create({
      pilots: {
        '1': {
          inreach: {
            enabled: true,
            account: 'pilot1',
            lastFetchSec: 0,
            lastFixSec: 0,
            nextFetchSec: nowSec,
            numErrors: 0,
            numRequests: 0,
            numConsecutiveErrors: 0,
          },
        },
      },
    });

    const fetcher = new TestTrackerFetcher(state, null as any);
    const fetchFromSec = fetcher.testGetTrackerFetchFromSec(1, nowSec, 2 * 3600);
    expect(fetchFromSec).toBe(nowSec - TRACKERS_MAX_FETCH_DURATION_SEC);
  });
});
