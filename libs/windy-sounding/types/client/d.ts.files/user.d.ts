import { SubscriptionInfo } from '@plugins/_shared/subscription-services/subscription-services.d';
import { User } from '@windy/dataSpecifications.d';
import { SubTier } from '@windy/types.d';

/**
 * user info as it's returned from account or node users
 */
export interface UserInfo {
  /**
   * true if user is authenticated
   */
  auth?: boolean;

  /**
   * aka userToken in storage
   */
  token?: string;

  /**
   * @deprecated
   * tier level of user premium - TODO remove
   */
  subscription?: SubTier;

  /** Detail info about subscription. It is undefined if no subscription is available for the user. */
  subscriptionInfo?: SubscriptionInfo;

  /**
   * user as in storage definition
   */
  userInfo?: User;
}

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
