// Models and validation for user data.

import type { Validator } from '@vaadin/nodom';
import { _getPropertyModel, BooleanModel, NotBlank, NotNull, ObjectModel, Size, StringModel } from '@vaadin/nodom';

import type { TrackerNames } from './live-track';
import { trackerNames } from './live-track';
import type { LiveTrackEntity, TrackerEntity } from './live-track-entity';

// Client side model for an account.
export interface AccountModel {
  name: string;
  enabled: boolean;
  share: boolean;
  inreach: TrackerModel;
  spot: TrackerModel;
  skylines: TrackerModel;
  flyme: TrackerModel;
  flymaster: TrackerModel;
  ogn: TrackerModel;
  zoleo: TrackerModel;
  xcontest: TrackerModel;
  meshbir: TrackerModel;
}

// Form model for a client side account.
export class AccountFormModel extends ObjectModel<AccountModel> {
  static override createEmptyValue(): AccountModel {
    return {
      name: '',
      enabled: true,
      share: true,
      inreach: TrackerFormModel.createEmptyValue(),
      spot: TrackerFormModel.createEmptyValue(),
      skylines: TrackerFormModel.createEmptyValue(),
      flyme: TrackerFormModel.createEmptyValue(),
      flymaster: TrackerFormModel.createEmptyValue(),
      ogn: TrackerFormModel.createEmptyValue(),
      zoleo: TrackerFormModel.createEmptyValue(),
      xcontest: TrackerFormModel.createEmptyValue(),
      meshbir: TrackerFormModel.createEmptyValue(),
    };
  }

  static createFromEntity(entity: LiveTrackEntity): AccountModel {
    const trackerModels: Record<string, TrackerModel> = {};

    for (const prop of trackerNames) {
      const trackerEntity: TrackerEntity = entity[prop] ?? { enabled: false, account: '' };
      trackerModels[prop] = {
        enabled: trackerEntity.enabled,
        account: trackerEntity.account,
      };
      // Copy the optional account_resolved property (flyme).
      if (trackerEntity.account_resolved != null) {
        trackerModels[prop].account_resolved = trackerEntity.account_resolved;
      }
    }

    return {
      ...trackerModels,
      name: entity.name,
      enabled: entity.enabled,
      share: entity.share,
    } as AccountModel;
  }

  readonly name: StringModel = this[_getPropertyModel]('name', StringModel, [
    false,
    new NotBlank(),
    new Size({ min: 3, max: 30 }),
  ]);
  readonly enabled: BooleanModel = this[_getPropertyModel]('enabled', BooleanModel, [false, new NotNull()]);
  readonly share: BooleanModel = this[_getPropertyModel]('share', BooleanModel, [false, new NotNull()]);

  readonly inreach = this.createTrackerModel('inreach');
  readonly spot = this.createTrackerModel('spot');
  readonly skylines = this.createTrackerModel('skylines');
  readonly flyme = this.createTrackerModel('flyme');
  readonly flymaster = this.createTrackerModel('flymaster');
  readonly ogn = this.createTrackerModel('ogn');
  readonly zoleo = this.createTrackerModel('zoleo');
  readonly xcontest = this.createTrackerModel('xcontest');
  readonly meshbir = this.createTrackerModel('meshbir');

  private createTrackerModel(tracker: TrackerNames): TrackerFormModel {
    const validators = trackerValidators[tracker];
    return this[_getPropertyModel](tracker, TrackerFormModel, [false, ...validators]);
  }
}

// Client side model for a tracker.
export interface TrackerModel {
  // Account as entered by the user.
  account: string;
  enabled: boolean;
  // Account resolved on entity persisted (flyme).
  account_resolved?: string;
}

// Form model for a client side tracker.
export class TrackerFormModel extends ObjectModel<TrackerModel> {
  static override createEmptyValue(): TrackerModel {
    return {
      enabled: false,
      account: '',
    };
  }

  readonly enabled: BooleanModel = this[_getPropertyModel]('enabled', BooleanModel, [false, new NotNull()]);
  readonly account: StringModel = this[_getPropertyModel]('account', StringModel, [false, new Size({ max: 150 })]);
  readonly account_resolved: StringModel = this[_getPropertyModel]('account_resolved', StringModel, [true]);
}

// Validates a TrackerModel using a callback.
class AccountSyncValidator implements Validator<TrackerModel> {
  constructor(public message: string, public callback: (account: string) => string | false) {}

  async validate(tracker: TrackerModel) {
    if (tracker.enabled && this.callback(tracker.account) === false) {
      return { property: 'account' };
    }
    return true;
  }
}

// Validators used on both the client and server sides.
export const trackerValidators: Readonly<Record<TrackerNames, AccountSyncValidator[]>> = {
  inreach: [new AccountSyncValidator('This InReach URL is invalid', validateInreachAccount)],
  spot: [new AccountSyncValidator('This Spot ID is invalid', validateSpotAccount)],
  skylines: [new AccountSyncValidator('This Skylines ID is invalid', validateSkylinesAccount)],
  flyme: [],
  flymaster: [new AccountSyncValidator('This Flymaster ID is invalid', validateFlymasterAccount)],
  ogn: [new AccountSyncValidator('This OGN ID is invalid', validateOgnAccount)],
  zoleo: [],
  xcontest: [new AccountSyncValidator('This XContest UUID is invalid', validateXContestAccount)],
  meshbir: [new AccountSyncValidator('This Meshtastic ID is invalid', validateMeshBirAccount)],
};

// Validates a Spot Id.
//
// Ids look like "0onlLopfoM4bG5jXvWRE8H0Obd0oMxMBq".
// They all seem to be 33 char long string starting with "0" but there is no doc about the exact format.
export function validateSpotAccount(id: string): string | false {
  id = id.trim();
  return /^\w{30,36}$/.test(id) ? id : false;
}

// Validates a SkyLines Id.
//
// Skylines uses numerical ids.
export function validateSkylinesAccount(id: string): string | false {
  id = id.trim();
  return /^\d+$/.test(id.trim()) ? id : false;
}

// Validate an inreach url.
//
// Supported urls are:
// - https://share.garmin.com/<username>
// - https://share.garmin.com/Feed/Share/<username>
//
// 'share' could also be 'eur.inreach', 'aur-share.inreach'.
//
// urls are transformed to the second form (with '/Feed/Share/').
export function validateInreachAccount(url: string): string | false {
  url = url.trim();

  // Insert '/Feed/Share' when missing.
  if (!/Feed\/Share/i.test(url)) {
    const lastSlash = url.lastIndexOf('/');
    if (lastSlash > -1) {
      url = url.substring(0, lastSlash) + '/Feed/Share' + url.substr(lastSlash);
    }
  }

  // Prefix with `https:// if missing`.
  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url;
  }

  // Check url validity.
  const m = url.match(/^(https?:\/\/[\w.-]*?garmin\.com)(\/Feed\/Share\/\w+$)/i);
  if (m) {
    return `${m[1].toLowerCase()}${m[2]}`;
  }

  return false;
}

// Validates a Flymaster Id.
//
// Flymaster uses numerical ids (last digit of the serial number).
export function validateFlymasterAccount(id: string): string | false {
  id = id.trim();
  return /^\d{3,}$/.test(id) ? id : false;
}

// Validates a Flyme Id.
//
// This is the resolved account for FlyMe.
export function validateFlymeAccount(id: string): string | false {
  id = id.trim();
  return /^\d+$/.test(id) ? id : false;
}

// Validates an OGN Id.
//
// 6 hexadecimal digits
export function validateOgnAccount(id: string): string | false {
  id = id.trim();
  return /^[0-9a-f]{6}$/i.test(id) ? id.toUpperCase() : false;
}

// Validates a zoleo IMEI.
export function validateZoleoAccount(imei: string): string | false {
  imei = imei.trim();
  return /^\d{15}$/i.test(imei) ? imei : false;
}

// Validates a XContest UUID.
//
// 28 letters/numbers (first char is always a letter).
export function validateXContestAccount(id: string): string | false {
  id = id.trim();
  return /^[a-z][a-z0-9]{27}$/i.test(id) ? id : false;
}

// Validates a Meshtastic ID.
//
// The format is UUID, with groups of hex digits: "8-4-4-4-12"
export function validateMeshBirAccount(id: string): string | false {
  id = id.trim();
  return /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(id) ? id.toUpperCase() : false;
}
