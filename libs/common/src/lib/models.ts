// Models and validation for user data.

import {
  BooleanModel,
  NotBlank,
  NotNull,
  Null,
  ObjectModel,
  Size,
  StringModel,
  Validator,
  _getPropertyModel,
} from '@vaadin/nodom';
import { TrackerIds, trackerPropNames } from './live-track';
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
    };
  }

  static createFromEntity(entity: LiveTrackEntity): AccountModel {
    const trackerModels: Record<string, TrackerModel> = {};

    for (const prop of Object.values(trackerPropNames)) {
      const trackerEntity: TrackerEntity = (entity as any)[prop] ?? { enabled: false, account: '' };
      trackerModels[prop] = {
        enabled: trackerEntity.enabled,
        account: trackerEntity.account,
      };
      // Copy the optional account_resolved property.
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

  readonly inreach = this.createTrackerModel(TrackerIds.Inreach);
  readonly spot = this.createTrackerModel(TrackerIds.Spot);
  readonly skylines = this.createTrackerModel(TrackerIds.Skylines);
  readonly flyme = this.createTrackerModel(TrackerIds.Flyme);
  readonly flymaster = this.createTrackerModel(TrackerIds.Flymaster);

  private createTrackerModel(tracker: TrackerIds): TrackerFormModel {
    const validators = trackerValidators[tracker];
    return this[_getPropertyModel](trackerPropNames[tracker] as any, TrackerFormModel, [false, ...validators]);
  }
}

// Client side model for a tracker.
export interface TrackerModel {
  // Account as entered by the user.
  account: string;
  // Account resolved on entity persisted.
  account_resolved?: string;
  enabled: boolean;
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
  readonly account_enabled: StringModel = this[_getPropertyModel]('account_resolved', StringModel, [true, new Null()]);
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
export const trackerValidators: Readonly<Record<TrackerIds, Validator<TrackerModel>[]>> = {
  [TrackerIds.Inreach]: [new AccountSyncValidator('This InReach URL is invalid', validateInreachAccount)],
  [TrackerIds.Spot]: [new AccountSyncValidator('This Spot ID is invalid', validateSpotAccount)],
  [TrackerIds.Skylines]: [new AccountSyncValidator('This Skylines ID is invalid', validateSkylinesAccount)],
  [TrackerIds.Flyme]: [],
  [TrackerIds.Flymaster]: [new AccountSyncValidator('This Flymaster ID is invalid', validateFlymasterAccount)],
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
