/**
 * catches all runtimes exceptions and sends them to kibana on backend.
 * Defines global `logError( moduleName, msg, errObj )` for custom err leggin.
 */
import type { Overlays } from '@windy/rootScope.d';
import type { Device, Platform, Timestamp } from '@windy/types';
type RunningPhase = '1_loading' | '2_dependenciesResolved' | '3_redrawFinished' | 'documentIsHidden';
type ErrorTypes = 'error' | 'customLogError' | 'unhandledRejection';
/** Payload sent to backend */
interface ErrorPayload {
  errorID: string;
  type: ErrorTypes;
  platform: Platform;
  device: Device;
  ver: string;
  target: 'index' | 'mobile' | 'embed' | 'lib';
  msg: string;
  timestamp: Timestamp;
  runningMinutes: number;
  runningPhase: RunningPhase;
  overlay: Overlays;
  url: string;
  module?: string;
  line?: number;
  col?: number;
  script?: string;
  stack?: string;
  repeated?: number;
  latestBcast?: string;
  network?: Record<string, string | number>;
}
/**
 * Array of all errors reported to kibana, to show them in debug mode
 * plugin
 */
export declare const sentErrors: ErrorPayload[];
/**
 * Suspend further error reporting (for example after launching 3rd party plugin, that may cause errors)
 */
export declare const suspendErrorLogging: () => void;
/**
 * Get NetworkInformation from navigator.connection if available
 * https://developer.mozilla.org/en-US/docs/Web/API/Network_Information_API
 * https://caniuse.com/netinfo
 * @returns NetworkInformation or empty object
 */
export declare function getNetworkInformation(): {
  downlink: any;
  downlinkMax: any;
  effectiveType: any;
  rtt: any;
  saveData: any;
  type: any;
};
export {};
