/**
 * This module relies on being loaded as a non-async <script type="module">,
 * which browsers defer until after DOM parsing. Do NOT add `async` to the
 * script tag, or top-level DOM access in imported modules will break.
 */
export * from './commonExports';
export * as mobile from './capacitor/mobile';
export * as mobileUtils from './capacitor/mobileUtils';
export * as nativeStorage from './capacitor/nativeStorage';
export * as pushNotifications from './capacitor/pushNotifications';
export * as appsFlyer from './capacitor/appsFlyer';
export * as showableErrorsService from './capacitor/showableErrorsService';
