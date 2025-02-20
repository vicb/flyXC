import type { ClientMessage } from '../../types/offline';
/**
 * Sends message to service worker
 */
export declare const sendMessageToServiceWorker: (message: ClientMessage) => void;
export declare const installServiceWorker: () => void;
export declare const isServiceWorkerSupported: () => boolean;
export declare const getServiceWorkerError: () => string | null;
