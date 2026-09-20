import type { AppsFlyerPlugin } from 'appsflyer-capacitor-plugin/src/definitions';
declare const appsFlyer: AppsFlyerPlugin;
export { appsFlyer };
export declare const appsFlyerPromise: Promise<void>;
export declare function withAppsFlyer(fn: (af: AppsFlyerPlugin) => Promise<unknown> | void): Promise<void>;
export declare function logAppsFlyerProductChange(): Promise<void>;
