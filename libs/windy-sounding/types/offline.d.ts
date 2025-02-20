import type { Timestamp } from '@windy/types.d';

/**
 * Types of data that can be downloaded (for purpose of storage management)
 */
export type StorageDataType = 'criticalFiles' | 'images' | 'clientFiles' | 'forecastData';

export type Client2ServiceWorkerMessage = 'download' | 'ping' | 'cancel' | 'goOffline' | 'goOnline';

export type ServiceWorkerStatus = 'idle' | 'downloading' | 'offlineMode';

export type ServiceWorker2ClientMessage =
  | ServiceWorkerStatus
  | 'progress'
  | 'finished'
  | 'error'
  | 'cancelled'
  | 'readyForOfflineMode'
  | 'goingOnline';

export interface ServiceWorkerMessage extends Event {
  data: {
    type: ServiceWorker2ClientMessage;
    error?: string;
    downloadedInfo?: DownloadedInfo | void;
    expires?: Timestamp;
  };
}

export interface ClientMessage {
  type: Client2ServiceWorkerMessage;
  payload?: DownloadPayload;
}

export interface FileInfo {
  /**
   * Mangled or hash encoded URL, as sent to the backend
   */
  url: string;

  /**
   * Original pure URL
   */
  originalUrl: string;
}

/**
 * Request to download files from service worker
 */
export interface DownloadBatch {
  type: StorageDataType;

  /**
   * Should we delete all files in this cache before downloading?
   */
  deleteCache: boolean;

  /**
   * Files to download
   */
  files: FileInfo[];

  /**
   * Given URL's are not static, but rather backend generated API calls
   */
  apiRqst?: boolean;

  /**
   * serviceWorker tries twice (with CORS and no-CORS) to download files
   */
  tryTwice2DownloadFiles?: boolean;
}

export type ErrorsByType = Record<string, number>;

export interface DownloadPayload {
  assets: string;
  acceptHeader: string;
  numberOfFiles: number;
  batches: DownloadBatch[];
  mainEntryPoint: string;
}

export interface DownloadedInfo {
  assets: string;
  errors: number;
  errorsByType: ErrorsByType;
  downloaded: Timestamp;
  downloadeAsDate: string;
  mainEntryPoint: string;
}

export interface DownloadProgress {
  type: 'progress' | 'finished' | 'error';
  downloadedFiles: number;
  numberOfFiles: number;
  errors: number;
  errorUrls: string[];
  errorsByType: ErrorsByType;
}
