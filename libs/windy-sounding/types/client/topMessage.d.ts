/**
 * Top message service that displays messages at the top of the screen
 * Ensures only one top message is displayed at a time
 */
import { Window } from '@windy/Window';
import type { HTMLString } from '@windy/types';
export interface TopMessageOptions {
    /** Type of the massage */
    type: 'success' | 'error' | 'warning';
    /** HTML content of the message */
    html: HTMLString;
    /** Auto-close timeout in milliseconds */
    timeout?: number;
    /** Called on message click */
    onclick?: () => void;
}
/**
 * Display a top message. If another message is currently displayed, it will be closed first.
 * @param options Configuration for the top message
 * @returns Promise that resolves when the message is displayed
 */
export declare const displayTopMessage: ({ html, timeout, onclick, type, }: TopMessageOptions) => Promise<Window>;
