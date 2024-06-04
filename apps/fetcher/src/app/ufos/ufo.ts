import type { UfoFleetNames } from '@flyxc/common';
import { LIVE_REFRESH_SEC, protos } from '@flyxc/common';
import type { ChainableCommander } from 'ioredis';

// Updates for a tick of a tracker type (InReach, Spot, ...).
export interface UfoFleetUpdates {
  fleetName: UfoFleetNames;
  // Global.
  errors: string[];
  // Per device delta (only required if there is a delta).
  deltas: Map<string, protos.LiveTrack>;
  // Duration of the fetch.
  startFetchSec: number;
  endFetchSec: number;
}

export class UfoFleetFetcher {
  constructor(protected state: protos.FetcherState, protected pipeline: ChainableCommander) {}

  // Fetches the delta and update tracker properties:
  // - requests and errors,
  // - last fix and fetch times,
  // - next fetch time.
  async refresh(fetchTimeoutSec: number): Promise<UfoFleetUpdates> {
    const updates: UfoFleetUpdates = {
      fleetName: this.getFleetName(),
      errors: [],
      deltas: new Map<string, protos.LiveTrack>(),
      startFetchSec: 0,
      endFetchSec: 0,
    };

    updates.startFetchSec = Math.round(Date.now() / 1000);
    await this.fetch(updates, fetchTimeoutSec);
    updates.endFetchSec = Math.round(Date.now() / 1000);

    const fleet = this.getFleet();
    fleet.lastFetchSec = updates.startFetchSec;
    this.incrementRequest(updates.errors.length > 0);
    fleet.nextFetchSec = updates.startFetchSec + this.getNextFetchAfterSec() - Math.round(LIVE_REFRESH_SEC / 2);

    return updates;
  }

  protected getFleetName(): UfoFleetNames {
    throw new Error('not implemented');
  }

  // Fetches delta for the fleet.
  //
  // The implementation should:
  // - populate updates with the delta when they exist (the name must be added to the livetrack),
  // - populate updates with the errors,
  // - populate updates with the fetched devices,
  // - respect the timeout.
  //
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected async fetch(updates: UfoFleetUpdates, timeoutSec: number): Promise<void> {
    throw new Error('not implemented');
  }

  // Returns the delay before the next fetch.
  //
  // The tracker last fix time and error counters have been updated before
  // this method is called.
  protected getNextFetchAfterSec(): number {
    const fleet = this.getFleet();
    if (fleet.numConsecutiveErrors > 30) {
      return 24 * 3600;
    }
    if (fleet.numConsecutiveErrors > 20) {
      return 3600;
    }
    if (fleet.numConsecutiveErrors > 5) {
      return fleet.numConsecutiveErrors * 60;
    }
    return 60;
  }

  protected shouldFetch(): boolean {
    return this.getFleet().nextFetchSec <= Math.round(Date.now() / 1000);
  }

  protected getFleet(): protos.UfoFleet {
    let fleet = this.state.ufoFleets[this.getFleetName()];
    if (fleet == null) {
      fleet = protos.UfoFleet.create();
      this.state.ufoFleets[this.getFleetName()] = fleet;
    }
    return fleet;
  }

  // Counts the number of requests and errors.
  private incrementRequest(hasError: boolean) {
    const fleet = this.getFleet();
    fleet.numRequests++;

    if (hasError) {
      fleet.numErrors++;
      fleet.numConsecutiveErrors++;
    } else {
      fleet.numConsecutiveErrors = 0;
    }

    if (fleet.numRequests > 1000 || fleet.numErrors > 1000) {
      fleet.numRequests = Math.round(fleet.numRequests / 2);
      fleet.numErrors = Math.round(fleet.numErrors / 2);
    }
  }
}
