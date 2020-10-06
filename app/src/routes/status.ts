/* eslint-disable @typescript-eslint/no-var-requires */
const { Datastore } = require('@google-cloud/datastore');

import Redis from 'ioredis';

import Router, { RouterContext } from '@koa/router';

import { Keys } from '../keys';

const datastore = new Datastore();
const redis = new Redis(Keys.REDIS_URL);

// Cache the counter for hours.
const COUNTER_STALE_AFTER_HOURS = 240;

// Last count timestamp.
const LAST_COUNT_TIMESTAMP = 'count.last-ts';
const NO_DEVICE_TRACKER_COUNT = 'count.inactive-tracker';
const TRACKER_COUNT = 'count.tracker';
const TRACK_COUNT = 'count.track';
const TRACK_OFFSET = 45000;

interface Counts {
  // Total number of tracker accounts.
  trackers: number;
  // Tracker accounts with device set to "no".
  noDeviceTrackers: number;
  // Trackers currently active.
  activeTrackers: number;
  tracks: number;
}

export function registerStatusRoutes(router: Router): void {
  // Retrieves status information.
  router.get(
    '/_status.json',
    async (ctx: RouterContext): Promise<void> => {
      const counts = await getDatastoreCounts();
      ctx.set('Content-Type', 'application/json');
      ctx.body = JSON.stringify({
        'last-request': Number(await redis.get('trackers.request')),
        'last-refresh': Number(await redis.get('trackers.refreshed')),
        'num-refresh': Number(await redis.get('trackers.numrefreshed')),
        'active-trackers': counts.activeTrackers,
        trackers: counts.trackers - counts.noDeviceTrackers,
        noDeviceTrackers: counts.noDeviceTrackers,
        tracks: counts.tracks,
      });
    },
  );
}

// Cache the counter value for COUNTER_STALE_AFTER_HOURS.
// Count queries are slow and we don't want them to run often.
async function getDatastoreCounts(): Promise<Counts> {
  const counts = {
    trackers: 0,
    noDeviceTrackers: 0,
    activeTrackers: 0,
    tracks: 0,
  };

  const maybeTs = await redis.get(LAST_COUNT_TIMESTAMP);
  let lastCountTs = maybeTs == null ? 0 : Number(maybeTs);

  if (lastCountTs < Date.now() - COUNTER_STALE_AFTER_HOURS * 3600 * 1000) {
    // Count up to one minute ago.
    lastCountTs = Date.now() - 60 * 1000;
    const lastCountDate = new Date(lastCountTs);

    counts.trackers = (
      await datastore.createQuery('Tracker').filter('created', '<=', lastCountDate).select('__key__').run()
    )[0].length;
    counts.noDeviceTrackers = (
      await datastore
        .createQuery('Tracker')
        .filter('created', '<=', lastCountDate)
        .filter('device', '=', 'no')
        .select('__key__')
        .run()
    )[0].length;
    counts.tracks =
      TRACK_OFFSET +
      (
        await datastore
          .createQuery('Track')
          .offset(TRACK_OFFSET)
          .filter('created', '<=', lastCountDate)
          .select('__key__')
          .run()
      )[0].length;
    // Store the counts.
    await Promise.all([
      redis.set(LAST_COUNT_TIMESTAMP, lastCountTs),
      redis.set(NO_DEVICE_TRACKER_COUNT, counts.noDeviceTrackers),
      redis.set(TRACKER_COUNT, counts.trackers),
      redis.set(TRACK_COUNT, counts.tracks),
    ]);

    return counts;
  }

  counts.activeTrackers = (
    await datastore.createQuery('Tracker').filter('active', '=', true).select('__key__').run()
  )[0].length;

  // Get the base counts from REDIS
  counts.noDeviceTrackers = Number((await redis.get(NO_DEVICE_TRACKER_COUNT)) ?? 0);
  counts.trackers = Number((await redis.get(TRACKER_COUNT)) ?? 0);
  counts.tracks = Number((await redis.get(TRACK_COUNT)) ?? 0);

  // Add the new entities since last count.
  const lastCountDate = new Date(lastCountTs);

  counts.trackers += (
    await datastore.createQuery('Tracker').filter('created', '>', lastCountDate).select('__key__').run()
  )[0].length;
  counts.noDeviceTrackers += (
    await datastore
      .createQuery('Tracker')
      .filter('created', '>', lastCountDate)
      .filter('device', '=', 'no')
      .select('__key__')
      .run()
  )[0].length;
  counts.tracks += (
    await datastore.createQuery('Track').filter('created', '>=', lastCountDate).select('__key__').run()
  )[0].length;

  return counts;
}
