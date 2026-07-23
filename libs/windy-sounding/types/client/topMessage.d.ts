/**
 * Top message service that displays messages at the top of the screen
 * Ensures only one top message is displayed at a time
 */
import { Window } from '@windy/Window';
import type { HTMLString } from '@windy/types';
import type { WindowClosingOptions } from '@windy/interfaces.d';
export interface TopMessageButton {
  /** Button label (HTML allowed) */
  label: HTMLString;
  /** When set, the button renders as a link pointing to this URL */
  href?: string;
  /** Called on button click */
  onclick?: () => void;
  /** Close the top message after the button is clicked */
  closeOnClick?: boolean;
  /** Render as the primary action: solid fill instead of a transparent outline */
  primary?: boolean;
}
export interface TopMessageOptions {
  /** Type of the massage */
  type: 'success' | 'error' | 'warning';
  /** HTML content of the message */
  html: HTMLString;
  /** Auto-close timeout in milliseconds */
  timeout?: number;
  /** Called on message click */
  onclick?: () => void;
  /**
   * Called when the message is closed. Receives the closing options, so callers can
   * distinguish a user-initiated close (`opts.ev` set, e.g. closing-x) from a
   * programmatic one (another top message replacing this one).
   */
  onclose?: (opts?: WindowClosingOptions) => void;
  /** Optional action buttons rendered on the right side of the message */
  buttons?: TopMessageButton[];
  /** Hide the closing X, leaving the message to be dismissed by its buttons */
  hideClosingX?: boolean;
}
/**
 * Display a top message. If another message is currently displayed, it will be closed first.
 * @param options Configuration for the top message
 * @returns Promise that resolves when the message is displayed
 */
export declare const displayTopMessage: ({
  html,
  timeout,
  onclick,
  onclose,
  type,
  buttons,
  hideClosingX,
}: TopMessageOptions) => Promise<Window>;
