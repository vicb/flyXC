/**
 * Base class and data structures for fetching tracker updates.
 */

import type { protos, TrackerNames } from '@flyxc/common';
import { LIVE_REFRESH_SEC, TRACKERS_MAX_FETCH_DURATION_SEC } from '@flyxc/common';
import type { RedisClientMultiCmd } from '@flyxc/common-node';

/**
 * Updates collected during a single fetch tick for a tracker type (InReach, Spot, etc.).
 */
export interface TrackerUpdates {
  /** Tracker service name. */
  name: TrackerNames;
  /** Global errors encountered during the fetch (not specific to a single device). */
  errors: string[];
  /** Per-device track deltas (only populated when there is a delta). */
  trackerDeltas: Map<number, protos.LiveTrack>;
  /** Per-device error messages (no delta when there is an error). */
  trackerErrors: Map<number, string>;
  /** Set of device IDs that were fetched. */
  fetchedTracker: Set<number>;
  /** Timestamp in seconds when the fetch started. */
  startFetchSec: number;
  /** Timestamp in seconds when the fetch completed. */
  endFetchSec: number;
}

/**
 * Base class for fetching tracker updates for a specific tracker service.
 */
export class TrackerFetcher {
  /**
   * Creates a new tracker fetcher instance.
   *
   * @param state - The current fetcher state containing pilots and their trackers.
   * @param pipeline - Redis transaction/pipeline command batcher for queuing updates.
   */
  constructor(protected state: protos.FetcherState, protected pipeline: RedisClientMultiCmd) {}

  /**
   * Refreshes trackers by fetching deltas and updating tracker properties:
   * - Request and error counters,
   * - Last fix and fetch timestamps,
   * - Next scheduled fetch timestamp.
   *
   * @param fetchTimeoutSec - Maximum duration allowed for the fetch operation in seconds.
   * @returns The collected tracker updates for this tick.
   */
  async refresh(fetchTimeoutSec: number): Promise<TrackerUpdates> {
    const updates: TrackerUpdates = {
      name: this.getTrackerName(),
      errors: [],
      trackerDeltas: new Map<number, protos.LiveTrack>(),
      trackerErrors: new Map<number, string>(),
      fetchedTracker: new Set<number>(),
      startFetchSec: 0,
      endFetchSec: 0,
    };

    const devices = this.getDeviceIdsToFetch();
    updates.startFetchSec = Math.round(Date.now() / 1000);
    await this.fetch(devices, updates, fetchTimeoutSec);
    updates.endFetchSec = Math.round(Date.now() / 1000);

    for (const id of updates.fetchedTracker) {
      const tracker = this.getTracker(id);
      if (tracker == null) {
        continue;
      }
      tracker.lastFetchSec = updates.startFetchSec;

      this.incrementRequest(tracker, updates.trackerErrors.has(id));

      if (updates.trackerDeltas.has(id)) {
        const track = updates.trackerDeltas.get(id);
        if (track) {
          if (track.timeSec.length > 0) {
            tracker.lastFixSec = Math.max(tracker.lastFixSec, track.timeSec[track.timeSec.length - 1]);
          }
        }
      }

      // Subtracts LIVE_REFRESH_SEC / 2 to avoid skipping a tick.
      tracker.nextFetchSec =
        updates.startFetchSec + this.getNextFetchAfterSec(tracker) - Math.round(LIVE_REFRESH_SEC / 2);
    }

    return updates;
  }

  /**
   * Returns the tracker service name.
   *
   * Subclasses must implement this method.
   *
   * @returns The tracker name.
   */
  protected getTrackerName(): TrackerNames {
    throw new Error('not implemented');
  }

  /**
   * Fetches delta positions for the specified devices.
   *
   * The subclass implementation should:
   * - Populate `updates` with deltas when they exist,
   * - Populate `updates` with errors (global and per-device),
   * - Record all attempted devices in `updates.fetchedTracker`,
   * - Respect the timeout.
   *
   * @param devices - Array of pilot IDs to fetch.
   * @param updates - Object to populate with deltas, errors, and fetched device IDs.
   * @param timeoutSec - Maximum allowed duration for the fetch in seconds.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected async fetch(devices: number[], updates: TrackerUpdates, timeoutSec: number): Promise<void> {
    throw new Error('not implemented');
  }

  /**
   * Returns the delay before the next fetch attempt.
   *
   * The tracker's last fix time and error counters are updated before this method is called.
   *
   * @param tracker - The tracker to calculate next fetch delay for.
   * @returns Delay in seconds before the next fetch.
   */
  protected getNextFetchAfterSec(tracker: Readonly<protos.Tracker>): number {
    if (tracker.numConsecutiveErrors > 30) {
      return 24 * 3600;
    }
    if (tracker.numConsecutiveErrors > 20) {
      return 3600;
    }
    if (tracker.numConsecutiveErrors > 5) {
      return tracker.numConsecutiveErrors * 60;
    }
    return 60;
  }

  /**
   * Determines whether a tracker is due to be fetched.
   *
   * Fetches only when `nextFetchSec` has elapsed. Some trackers override this
   * to fetch all devices regardless of time (e.g. when fetching devices in bulk is cheap).
   *
   * @param tracker - The tracker to check.
   * @returns `true` if the tracker is due for a fetch.
   */
  protected shouldFetch(tracker: protos.Tracker) {
    return tracker.nextFetchSec <= Math.round(Date.now() / 1000);
  }

  /**
   * Returns the tracker for a given pilot ID.
   *
   * @param id - The pilot ID.
   * @returns The tracker configuration, or undefined if not found.
   */
  protected getTracker(id: number): protos.Tracker | undefined {
    const pilot = this.state.pilots[String(id)];
    return pilot ? pilot[this.getTrackerName()] : undefined;
  }

  /**
   * Computes the start time for a fetch request.
   *
   * The start time is calculated from the last fetch minus `maxLookbackSec` (or current time minus `maxLookbackSec`).
   *
   * If the tracker has a recent fix within that window, the window is reduced to start from
   * `lastFixSec - fixOverlapSec` to avoid fetching redundant history and minimize elevation patching overhead.
   *
   * The result is bounded by `fetchStartSec - TRACKERS_MAX_FETCH_DURATION_SEC`.
   *
   * @param id - The pilot ID.
   * @param fetchStartSec - Current fetch start time in seconds.
   * @param maxLookbackSec - Maximum lookback duration in seconds to fetch when no recent fix is available.
   * @param fixOverlapSec - Overlap buffer in seconds subtracted from the last fix (default: 5 minutes).
   * @returns The start timestamp in seconds.
   */
  protected getTrackerFetchFromSec(
    id: number,
    fetchStartSec: number,
    maxLookbackSec: number,
    fixOverlapSec = 5 * 60,
  ): number {
    const tracker = this.getTracker(id);
    let fromSec = (tracker?.lastFetchSec ?? Math.round(Date.now() / 1000)) - maxLookbackSec;

    if (tracker?.lastFixSec) {
      // Guard against future timestamps due to device clock skew.
      const lastFixSec = Math.min(tracker.lastFixSec, fetchStartSec);
      fromSec = Math.max(fromSec, lastFixSec - fixOverlapSec);
    }

    return Math.max(fetchStartSec - TRACKERS_MAX_FETCH_DURATION_SEC, fromSec);
  }

  /**
   * Updates the request and error counters on a tracker.
   *
   * Resets consecutive errors on success. Halves counters when either exceeds 1000
   * to maintain a rolling metric.
   *
   * @param tracker - The tracker to update.
   * @param hasError - Whether the fetch resulted in an error.
   */
  private incrementRequest(tracker: protos.Tracker, hasError: boolean) {
    tracker.numRequests++;

    if (hasError) {
      tracker.numErrors++;
      tracker.numConsecutiveErrors++;
    } else {
      tracker.numConsecutiveErrors = 0;
    }

    if (tracker.numRequests > 1000 || tracker.numErrors > 1000) {
      tracker.numRequests = Math.round(tracker.numRequests / 2);
      tracker.numErrors = Math.round(tracker.numErrors / 2);
    }
  }

  /**
   * Returns a list of device IDs to fetch, ordered by ascending scheduled fetch time.
   *
   * Only includes enabled trackers from enabled pilots where `shouldFetch` returns true.
   *
   * @returns Array of pilot IDs ready to be fetched.
   */
  private getDeviceIdsToFetch(): number[] {
    const propName = this.getTrackerName();
    const devices: { id: number; nextFetchSec: number }[] = [];

    // Get all the trackers that are enabled and need to be fetched.
    for (const idStr in this.state.pilots) {
      const pilot = this.state.pilots[idStr];
      if (pilot.enabled) {
        const tracker = pilot[propName];
        if (tracker?.enabled && this.shouldFetch(tracker)) {
          devices.push({ id: Number(idStr), nextFetchSec: tracker.nextFetchSec });
        }
      }
    }

    // Order by oldest next fetch first.
    devices.sort((a, b) => a.nextFetchSec - b.nextFetchSec);

    return devices.map((d) => d.id);
  }
}
