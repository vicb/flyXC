/**
 * @module query
 *
 * Controls the search input box
 */
import { Evented } from '@windy/Evented';
import type { PluginIdent } from '@windy/Plugin';
interface KeyEvents {
    keydown: [KeyboardEvent];
    requestFocus: [];
    inputBlurred: [e: Event];
}
/** Just emits keyboard events */
export declare const emitter: Evented<KeyEvents>;
/**
 * Set content of search input box.
 */
export declare const set: (text: string, inputHandler: PluginIdent) => void;
/**
 * Resets search input box content to empty string, but only if the plugin that requested reset is the same as the one that requested last change of the search input content. This is to prevent stealing text input focus when multiple plugins close/open at the same time.
 * @param inputHandler
 */
export declare const reset: (inputHandler: PluginIdent) => void;
/**
 * Get value of search input box
 *
 * @returns Search input box value
 */
export declare const get: () => string;
/** Show loader in search input */
export declare const showLoader: () => any;
/** Hide loader in search input */
export declare const hideLoader: () => any;
export {};
