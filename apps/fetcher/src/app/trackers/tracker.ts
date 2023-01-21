// Base class for fetching tracker updates.

import { LIVE_REFRESH_SEC, LIVE_RETENTION_SEC, protos, TrackerNames } from '@flyxc/common';
import { ChainableCommander } from 'ioredis';

// Updates for a tick of a tracker type (InReach, Spot, ...).
export interface TrackerUpdates {
  trackerName: TrackerNames;
  // Global.
  errors: string[];
  // Per device delta (only required if there is a delta).
  trackerDeltas: Map<number, protos.LiveTrack>;
  // Per device errors (no delta when there is an error).
  trackerErrors: Map<number, string>;
  // All devices that have been fetched.
  fetchedTracker: Set<number>;
  // Duration of the fetch.
  startFetchSec: number;
  endFetchSec: number;
}

export class TrackerFetcher {
  constructor(protected state: protos.FetcherState, protected pipeline: ChainableCommander) {}

  // Fetches the delta and update tracker properties:
  // - requests and errors,
  // - last fix and fetch times,
  // - next fetch time.
  async refresh(fetchTimeoutSec: number): Promise<TrackerUpdates> {
    const updates: TrackerUpdates = {
      trackerName: this.getTrackerName(),
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

  protected getTrackerName(): TrackerNames {
    throw new Error('not implemented');
  }

  // Fetches delta for the devices.
  //
  // The implementation should:
  // - populate updates with the delta when they exist,
  // - populate updates with the errors (global and per device),
  // - populate updates with the fetched devices,
  // - respect the timeout.
  //
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected async fetch(devices: number[], updates: TrackerUpdates, timeoutSec: number): Promise<void> {
    throw new Error('not implemented');
  }

  // Returns the delay before the next fetch.
  //
  // The tracker last fix time and error counters have been updated before
  // this method is called.
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

  // Fetches only when nextFetchSec is over.
  //
  // Some tracker override this to fetch all devices regardless of the time ( i.e. when fetching devices is cheap).
  protected shouldFetch(tracker: protos.Tracker) {
    return tracker.nextFetchSec <= Math.round(Date.now() / 1000);
  }

  // Returns the tracker given its id.
  protected getTracker(id: number): protos.Tracker | undefined {
    const pilot = this.state.pilots[String(id)];
    return pilot ? pilot[this.getTrackerName()] : undefined;
  }

  // Computes the start time for a fetch.
  // The start time is the last fetch minus the padding or now minus the padding.
  // The start time is then adjusted to never request more than LIVE_RETENTION_SEC.
  protected getTrackerFetchFromSec(id: number, startSec: number, paddingSec: number): number {
    const tracker = this.getTracker(id);
    const nowSec = Math.round(Date.now() / 1000);
    const lastFetchSec = tracker ? tracker.lastFetchSec : nowSec;
    return Math.max(startSec - LIVE_RETENTION_SEC, lastFetchSec - paddingSec);
  }

  // Counts the number of requests and errors.
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

  // Returns a list of devices to fetch ordered by ascending fetch time.
  private getDeviceIdsToFetch(): number[] {
    const propName = this.getTrackerName();
    const devices: { id: number; nextFetchSec: number }[] = [];

    // Get all the trackers that are enabled and need to be fetched.
    for (const [idStr, pilot] of Object.entries(this.state.pilots)) {
      const id = Number(idStr);
      if (pilot.enabled) {
        const tracker = pilot[propName];
        if (tracker?.enabled && this.shouldFetch(tracker)) {
          devices.push({ id, nextFetchSec: tracker.nextFetchSec });
        }
      }
    }

    // Order by oldest next fetch first.
    devices.sort((a, b) => a.nextFetchSec - b.nextFetchSec);

    return devices.map((d) => d.id);
  }
}
