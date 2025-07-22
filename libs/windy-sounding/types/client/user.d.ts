/**
 * # @windy/user
 *
 * 1) Wrapper for the user store object.
 * 2) Loads user info from the server.
 * 3) Handles user authentication.
 *
 * it's to avoid unnecessary render of "login" button when the user is logged in, but we still wait for the server response
 *
 * @module user
 */
import '@windy/liveAlerts';
import type { HttpPayload } from './d.ts.files/http.d';
import type { AccountLoginResponse, UserInfo, User, LoginAndFinishAction } from './d.ts.files/user.d';
/**
 * Quick check is user is loggedIn.
 */
export declare const isLoggedIn: () => boolean;
export declare const getInfo: () => User | null;
export declare const emptyAvatar = '<!-- @echo IMG_ABSOLUTE_PATH -->/avatar.jpg';
/**
 * Safe way how to retrieve use avatar
 * @returns link to user avatar or default avatar
 */
export declare const getAvatar: () => string;
export declare const getEmail: () => string;
export declare const getUsername: () => string;
export declare const getUserId: () => number;
/**
 * Open login plugin so that user can log in
 */
export declare const login: (finishAction?: LoginAndFinishAction) => void;
export declare const register: () => void;
/**
 * Log out the user - remove credentials and reload all things that depends on logged-in user
 */
export declare const logout: () => Promise<void>;
/**
 * Check if we have received valid auth object and if yes, save it and open user plugin
 *
 * @param userInfo user info from account or node users
 * @param handleConsent should we handle analytics consent (api/info endpoint)
 * @returns true if user is authenticated
 */
export declare const checkAuth: (userInfoPayload: UserInfo, handleConsent: boolean) => Promise<boolean>;
/**
 * Get info about current user from account
 *
 * @returns Pending HttpPayload with UserInfo or null if not authenticated
 * @throws An exception when HTTP request fails
 */
export declare const reloadInfo: () => Promise<HttpPayload<UserInfo> | null>;
export declare const handleLoginResponse: (
  response: HttpPayload<AccountLoginResponse>,
  provider: string,
) => Promise<void>;
