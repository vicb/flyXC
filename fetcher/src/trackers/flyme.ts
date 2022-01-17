// XCGlobe Flyme tracker API.
//
// http://xcglobe.com/flyme/

import { Tracker } from 'flyxc/common/protos/fetcher-state';
import { SecretKeys } from 'flyxc/common/src/keys';
import { TrackerIds } from 'flyxc/common/src/live-track';
import { TrackerEntity } from 'flyxc/common/src/live-track-entity';
import { TrackerModel, validateFlymeAccount } from 'flyxc/common/src/models';
import { getTextRetry } from 'flyxc/common/src/superagent';
import { formatReqError } from 'flyxc/common/src/util';
import { Validator } from 'flyxc/common/src/vaadin/form/Validation';
import request from 'superagent';

import { LivePoint, makeLiveTrack } from './live-track';
import { TrackerFetcher, TrackerUpdates } from './tracker';

export class FlymeFetcher extends TrackerFetcher {
  protected getTrackerId(): TrackerIds {
    return TrackerIds.Flyme;
  }

  // All trackers are retrieved at once anyway.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected shouldFetch(tracker: Tracker) {
    return true;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected async fetch(devices: number[], updates: TrackerUpdates, timeoutSec: number): Promise<void> {
    // Fixes are id, lat, lon, alt, timeSec and username.
    const flymeIdToFix = new Map<number, [number, number, number, number, number, string]>();
    const url = `https://xcglobe.com/livetrack/flyxcPositions?token=${SecretKeys.FLYME_TOKEN}`;

    devices.forEach((id) => updates.fetchedTracker.add(id));

    try {
      const response = await getTextRetry(url);
      if (response.ok) {
        try {
          const fixes = JSON.parse(response.body);
          fixes.forEach((fix: [number, number, number, number, number, string]) => {
            const id = fix[0];
            flymeIdToFix.set(id, fix);
          });
        } catch (e) {
          updates.errors.push(`Error parsing JSON ${response.body}\n${e}`);
        }
      } else {
        updates.errors.push(`HTTP status ${response.status}`);
      }
    } catch (e) {
      updates.errors.push(`Error ${formatReqError(e)}`);
    }

    for (const id of devices) {
      const tracker = this.getTracker(id);
      if (tracker == null) {
        continue;
      }
      if (validateFlymeAccount(tracker.account) === false) {
        updates.trackerErrors.set(id, `Invalid account ${tracker.account}`);
        continue;
      }
      const fix = flymeIdToFix.get(Number(tracker.account));
      if (fix) {
        const livePoints: LivePoint[] = [
          {
            device: this.getTrackerId(),
            lat: fix[1],
            lon: fix[2],
            alt: fix[3],
            timestamp: fix[4] * 1000,
          },
        ];
        updates.trackerDeltas.set(id, makeLiveTrack(livePoints));
      }
    }
  }
}

// Fetch the FlyMe server id for the username.
//
// Returns a numeric id when the username exists or undefined.
// Throws when there is a server error or a status code != 200.
export async function getFlyMeId(username: string): Promise<string | undefined> {
  const url = `https://xcglobe.com/livetrack/flyxcRegisterUser?username=${encodeURIComponent(username)}&token=${
    SecretKeys.FLYME_TOKEN
  }`;

  let response: request.Response | undefined;

  try {
    response = await getTextRetry(url);
  } catch (e) {
    throw new Error(`Flyme server error`);
  }

  if (response.ok) {
    const matches = response.body.match(/^ok:\s*(\d+)$/);
    if (matches == null) {
      throw new Error(`The FlyMe account can not be found`);
    }
    return matches[1];
  }

  throw new Error(`Flyme server error`);
}

// Validates a Flyme account.
//
// Fetches the ID from the server when the device is enabled and config has changed.
export class FlyMeValidator implements Validator<TrackerModel> {
  public message = '';
  private currentEnabled = false;
  private currentAccount = '';

  constructor(flyme: TrackerEntity | undefined) {
    if (flyme != null) {
      this.currentAccount = flyme.account;
      this.currentEnabled = flyme.enabled;
    }
  }

  async validate(tracker: TrackerModel) {
    if (!tracker.enabled) {
      // Clear the resolved account when disabled.
      tracker.account_resolved = '';
      return true;
    }

    if (this.currentEnabled && tracker.account === this.currentAccount) {
      // No need to resolve again when not changing.
      return true;
    }

    try {
      tracker.account_resolved = await getFlyMeId(tracker.account);
      return true;
    } catch (e) {
      this.message = `${e}`;
      return { property: 'account' };
    }
  }
}
