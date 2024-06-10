import type { TrackerEntity, TrackerModel } from '@flyxc/common';
import { fetchResponse, validateInreachAccount, validateSkylinesAccount } from '@flyxc/common';
import { Secrets } from '@flyxc/secrets';
import type { Validator } from '@vaadin/nodom';

// Makes sure the account is not password protected.
export class InreachValidator implements Validator<TrackerModel> {
  public message = '';
  private currentEnabled = false;
  private currentAccount = '';

  constructor(inreach: TrackerEntity | undefined) {
    if (inreach != null) {
      this.currentAccount = inreach.account;
      this.currentEnabled = inreach.enabled;
    }
  }

  async validate(tracker: TrackerModel) {
    if (tracker.enabled === this.currentEnabled && tracker.account === this.currentAccount) {
      // No need to resolve again when not changing.
      return true;
    }

    if (tracker.enabled) {
      const url = validateInreachAccount(tracker.account);
      if (url !== false) {
        try {
          const response = await fetchResponse(url, { timeoutS: 10 });
          if (response.status == 401) {
            this.message =
              'Please remove the MapShare password on ' +
              '<a href="https://explore.garmin.com/Social" target="_blank" class="has-text-link">explore.garmin.com/Social</a>' +
              ' before enabling your InReach.';
            return { property: 'account' };
          }
        } catch (e: any) {
          // empty
        }
      }
    }

    return true;
  }
}

// Fetch the FlyMe server id for the username.
//
// Returns a numeric id when the username exists or undefined.
// Throws when there is a server error or a status code != 200.
async function getFlyMeId(username: string): Promise<string | undefined> {
  const url = `https://xcglobe.com/livetrack/flyxcRegisterUser?username=${encodeURIComponent(username)}&token=${
    Secrets.FLYME_TOKEN
  }`;

  let response: Response;

  try {
    response = await fetchResponse(url);
  } catch (e) {
    throw new Error(`Flyme server error`);
  }

  if (response.ok) {
    const matches = (await response.text()).match(/^ok:\s*(\d+)$/);
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

// Makes sure the account exists.
export class SkylinesValidator implements Validator<TrackerModel> {
  public message = '';
  private currentEnabled = false;
  private currentAccount = '';

  constructor(skylines: TrackerEntity | undefined) {
    if (skylines != null) {
      this.currentAccount = skylines.account;
      this.currentEnabled = skylines.enabled;
    }
  }

  async validate(tracker: TrackerModel) {
    if (tracker.enabled === this.currentEnabled && tracker.account === this.currentAccount) {
      // No need to resolve again when not changing.
      return true;
    }

    if (tracker.enabled) {
      const id = validateSkylinesAccount(tracker.account);
      if (id !== false) {
        const url = `https://skylines.aero/api/users/${id}`;
        try {
          const response = await fetchResponse(url, { timeoutS: 10 });
          if (response.status == 404) {
            this.message = `This skylines account does not exist.`;
            return { property: 'account' };
          }
        } catch (e: any) {
          // empty
        }
      }
    }

    return true;
  }
}
