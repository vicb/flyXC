import { SubscriptionInfo } from '@plugins/_shared/subscription-services/subscription-services.d';
import { SubTier, type ExternalPluginIdent } from '@windy/types.d';
import { FavFragment } from '@windy/favs';
import type { PluginsOpenParams } from '@windy/plugin-params';

export interface User {
  avatar?: string;
  email?: string;
  fullname?: string;
  id: number;
  username: string;
  userslug: string;
  verifiedEmail?: string;

  /** Based on user location, cookie consent can be shown to the user if needed */
  requiresCookieConsent: boolean;

  /** TimeStamp of user registration */
  joindate?: number;

  /** TimeStamp of user last login */
  logindate?: number;
}

/**
 * user info as it's returned from account or node users
 */
export type UserInfo = {
  /** aka userToken in storage */
  token: string;
} & (
  | {
      auth: false;
      userInfo: {
        requiresCookieConsent: boolean;
      };
    }
  | {
      /** true if user is authenticated */
      auth: true;

      /** @deprecated */
      subscription?: SubTier;

      /** Detail info about subscription. It is undefined if no subscription is available for the user. */
      subscriptionInfo?: SubscriptionInfo;

      /**
       * user as in storage definition
       */
      userInfo: User;
    }
);

/**
 * @typedef {Object} LoginResponse login response as it's returned from account or node login
 * @property {string} message custom message to be used in errors (or 'ok' if no error)
 * @property {string} authHash as in storage definition
 */

/**
 * login response as it's returned from account or node login
 */
export interface AccountLoginResponse {
  /**
   * custom message to be used in errors (or 'ok' if no error)
   */
  message: string;

  /**
   * userInfo as information to be stored
   */
  userInfo: UserInfo;

  /**
   * authHash as in storage definition
   */
  authHash: string;
}

/**
 * In order to motivate users to register/login, we show login/register popup
 * in certain situations. This object contains
 *
 */
export type LoginAndFinishAction =
  | {
      action: 'addFav';
      params: FavFragment;
    }
  | {
      action: 'alerts-edit';
      params: PluginsOpenParams['alerts-edit'];
    }
  | {
      action: 'uploader';
      params: PluginsOpenParams['uploader'];
    }
  | {
      action: 'favs';
      params: PluginsOpenParams['favs'];
    }
  | {
      action: 'colors';
      params: PluginsOpenParams['colors'];
    }
  | {
      action: 'openExternalPlugin';
      params: {
        name: ExternalPluginIdent;
        openParams: PluginsOpenParams['windy-external-plugin'];
      };
    };
