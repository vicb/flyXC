import * as common from '@flyxc/common';
import { protos } from '@flyxc/common';
import type { RedisClientMultiCmd } from '@flyxc/common-node';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { FlymeFetcher } from './flyme';

function createFetcherState(account: string): protos.FetcherState {
  const state = protos.FetcherState.create();
  const pilot = protos.Pilot.create({ enabled: true });
  pilot.flyme = protos.Tracker.create({
    enabled: true,
    account,
  });
  state.pilots[1] = pilot;
  return state;
}

describe('FlymeFetcher', () => {
  const pipeline = {} as RedisClientMultiCmd;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-24T13:50:00Z'));
    vi.stubGlobal('SECRETS', { FLYME_TOKEN: 'test-token' });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test('fetches positions with Bearer token and Accept header', async () => {
    const fetchSpy = vi
      .spyOn(common, 'fetchResponse')
      .mockResolvedValue(new Response(JSON.stringify([[123, 46.05, 14.5, 1200, 1795428892, 'Pilot Name']])));

    const fetcher = new FlymeFetcher(createFetcherState('123'), pipeline);
    const updates = await fetcher.refresh(10);

    expect(fetchSpy).toHaveBeenCalledWith('https://xcglobe.com/api/partners/v1/live-tracking/positions', {
      timeoutS: 10,
      headers: {
        Authorization: 'Bearer test-token',
        Accept: 'application/json',
      },
    });
    expect(updates.errors).toEqual([]);
    expect(updates.fetchedTracker.has(1)).toBe(true);
    const delta = updates.trackerDeltas.get(1);
    expect(delta).toBeDefined();
    expect(delta?.lat).toEqual([46.05]);
    expect(delta?.lon).toEqual([14.5]);
    expect(delta?.alt).toEqual([1200]);
    expect(delta?.timeSec).toEqual([1795428892]);
  });

  test('handles empty array response', async () => {
    vi.spyOn(common, 'fetchResponse').mockResolvedValue(new Response('[]'));

    const fetcher = new FlymeFetcher(createFetcherState('123'), pipeline);
    const updates = await fetcher.refresh(10);

    expect(updates.errors).toEqual([]);
    expect(updates.fetchedTracker.has(1)).toBe(true);
    expect(updates.trackerDeltas.size).toBe(0);
  });

  test('respects Retry-After on 429 and 503', async () => {
    const fetchSpy = vi
      .spyOn(common, 'fetchResponse')
      .mockResolvedValueOnce(
        new Response(null, {
          status: 429,
          headers: { 'Retry-After': '120' },
        }),
      )
      .mockResolvedValueOnce(new Response('[]'));

    const state = createFetcherState('123');
    const updates1 = await new FlymeFetcher(state, pipeline).refresh(10);
    expect(updates1.errors).toEqual(['HTTP status 429']);
    expect(updates1.trackerDeltas.size).toBe(0);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Within Retry-After window: should skip fetching.
    vi.advanceTimersByTime(60_000);
    const updates2 = await new FlymeFetcher(state, pipeline).refresh(10);
    expect(updates2.errors).toEqual([]);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // After Retry-After expires: should resume fetching.
    vi.advanceTimersByTime(60_000);
    const updates3 = await new FlymeFetcher(state, pipeline).refresh(10);
    expect(updates3.errors).toEqual([]);
    expect(updates3.fetchedTracker.has(1)).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  test('respects Retry-After on 503 through real fetchResponse', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(null, {
          status: 503,
          headers: { 'Retry-After': '120' },
        }),
      )
      .mockResolvedValueOnce(new Response('[]'));

    const state = createFetcherState('123');
    const updates1 = await new FlymeFetcher(state, pipeline).refresh(10);
    expect(updates1.errors).toEqual(['HTTP status 503']);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Within Retry-After window: should skip fetching.
    vi.advanceTimersByTime(60_000);
    const updates2 = await new FlymeFetcher(state, pipeline).refresh(10);
    expect(updates2.errors).toEqual([]);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // After Retry-After expires: should resume fetching.
    vi.advanceTimersByTime(60_000);
    const updates3 = await new FlymeFetcher(state, pipeline).refresh(10);
    expect(updates3.errors).toEqual([]);
    expect(updates3.fetchedTracker.has(1)).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
