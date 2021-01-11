// Models and validation for user data.

import { _getPropertyModel, BooleanModel, ObjectModel, StringModel } from '@vaadin/form/Models';
import { Validator } from '@vaadin/form/Validation';
import { NotBlank, NotNull, Size } from '@vaadin/form/Validators';

import { TrackerIds, trackerPropNames } from './live-track';
// TODO: make sure this is not pulling things in the front
import { LiveTrackEntity, TrackerEntity } from './live-track-entity';

// Client side model for an account.
export interface AccountModel {
  name: string;
  enabled: boolean;
  share: boolean;
  inreach: TrackerModel;
  spot: TrackerModel;
  skylines: TrackerModel;
  flyme: TrackerModel;
}

// Form model for a client side account.
export class AccountFormModel extends ObjectModel<AccountModel> {
  static createEmptyValue(): AccountModel {
    return {
      name: '',
      enabled: true,
      share: true,
      inreach: TrackerFormModel.createEmptyValue(),
      spot: TrackerFormModel.createEmptyValue(),
      skylines: TrackerFormModel.createEmptyValue(),
      flyme: TrackerFormModel.createEmptyValue(),
    };
  }

  static createFromEntity(entity: LiveTrackEntity): AccountModel {
    const trackerModels: Record<string, TrackerModel> = {};

    for (const [trackerKey, prop] of Object.entries(trackerPropNames)) {
      const trackerEntity: TrackerEntity = (entity as any)[prop];
      const transformer: AccountTransformer = (accountTransformers as any)[trackerKey];
      (trackerModels as any)[prop] = {
        enabled: trackerEntity.enabled,
        account: transformer.toClientAccount(trackerEntity.account),
      };
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

  private createTrackerModel(tracker: TrackerIds): TrackerFormModel {
    const validators = trackerValidators[tracker];
    return this[_getPropertyModel](trackerPropNames[tracker] as any, TrackerFormModel, [false, ...validators]);
  }
}

// Client side model for a tracker.
export interface TrackerModel {
  account: string;
  enabled: boolean;
}

// Form model for a client side tracker.
export class TrackerFormModel extends ObjectModel<TrackerModel> {
  static createEmptyValue(): TrackerModel {
    return {
      enabled: false,
      account: '',
    };
  }

  readonly enabled: BooleanModel = this[_getPropertyModel]('enabled', BooleanModel, [false, new NotNull()]);
  readonly account: StringModel = this[_getPropertyModel]('account', StringModel, [false]);
}

// Validates a TrackerModel using a callback.
class TrackerCallbackValidator implements Validator<TrackerModel> {
  constructor(
    public message: string,
    public callback: (account: string) => string | false,
    protected property = 'account',
  ) {}

  async validate(value: TrackerModel) {
    if (value.enabled && (await Promise.resolve(this.callback(value.account))) === false) {
      return { property: this.property };
    }
    return true;
  }
}

// Validators used on both the client and server sides.
export const trackerValidators: Readonly<Record<TrackerIds, Validator<TrackerModel>[]>> = {
  [TrackerIds.Inreach]: [new TrackerCallbackValidator('This InReach URL is invalid', validateInreachAccount)],
  [TrackerIds.Spot]: [new TrackerCallbackValidator('This Spot ID is invalid', validateSpotAccount)],
  [TrackerIds.Skylines]: [new TrackerCallbackValidator('This Skylines ID is invalid', validateSkylinesAccount)],
  [TrackerIds.Flyme]: [],
};

// Transforms a tracker `account` property (server <-> client).
export interface AccountTransformer {
  toClientAccount(serverValue?: string): string;
  toServerAccount(clientValue?: string): string;
}

// Most accounts are the same on the client and server side.
const noOpAccountTransformer: AccountTransformer = {
  toClientAccount: (account?: string) => account ?? '',
  toServerAccount: (account?: string) => account ?? '',
};

// Account for trackers having a server id.
// The server id is derived from the user facing value.
// The object is serialized as JSON to the DB.
export interface TrackerAccountWithServerId {
  // User facing value.
  value: string;
  // Internal value (i.e. server id) that is retrieved async.
  id?: string;
  // Number of retries.
  retries?: number;
}

// Some accounts needs more info (typically an ID) to be retrieved.
// Extra info are encoded in the account field (JSON).
const accountWithServerIdTransformer: AccountTransformer = {
  toClientAccount(account?: string) {
    if (account == null) {
      return '';
    }
    try {
      const serverAccount: TrackerAccountWithServerId = JSON.parse(account);
      return serverAccount.value ?? '';
    } catch (e) {
      return '';
    }
  },
  toServerAccount(clientValue?: string) {
    const serverAccount: TrackerAccountWithServerId = {
      value: clientValue || '',
      retries: 0,
    };
    return JSON.stringify(serverAccount);
  },
};

export const accountTransformers: Readonly<Record<TrackerIds, AccountTransformer>> = {
  [TrackerIds.Inreach]: noOpAccountTransformer,
  [TrackerIds.Spot]: noOpAccountTransformer,
  [TrackerIds.Skylines]: noOpAccountTransformer,
  [TrackerIds.Flyme]: accountWithServerIdTransformer,
};

// Validates a Spot Id.
//
// Ids look like "0onlLopfoM4bG5jXvWRE8H0Obd0oMxMBq".
// They all seem to be 33 char long string starting with "0" but there is no doc about the exact format.
export function validateSpotAccount(id: string): string | false {
  return /^[\w]{30,36}$/.test(id) ? id : false;
}

// Validates a SkyLines Id.
//
// Skylines uses numerical ids.
export function validateSkylinesAccount(id: string): string | false {
  return /^\d+$/.test(id) ? id : false;
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
  // Insert '/Feed/Share' when missing.
  if (!/Feed\/Share/i.test(url)) {
    const lastSlash = url.lastIndexOf('/');
    if (lastSlash > -1) {
      url = url.substr(0, lastSlash) + '/Feed/Share' + url.substr(lastSlash);
    }
  }
  // Prefix with `https:// if missing`.
  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url;
  }
  // Check url validity.
  if (/^https?:\/\/[\w.-]*?garmin.com\/Feed\/Share\/\w+$/i.test(url)) {
    return url;
  }

  return false;
}
