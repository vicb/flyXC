import type { DownloadPayload, DownloadedInfo, FileInfo } from '../../types/offline';
export declare const cacheUrl: (
  cache: Cache,
  url: string,
  originalUrl: string,
  testIfUrlIsInCache?: boolean,
  tryTwice2DownloadFiles?: boolean,
) => Promise<boolean>;
export declare const cancelOngoingDownloads: () => boolean;
/**
 * Download all files in parallel
 * @param cache instance of Cache
 * @param urls list of rqrd URLs
 * @param checkIfUrlIsInCache Should we check if URL is in cache before attempting to download it?
 * @param calledOnDownloadedOneFile callback that is called each time one file is downloaded
 * @returns all Errored urls or null if task was cancelled
 */
export declare const downloadFilesInParallel: (
  cache: Cache,
  urls: FileInfo[],
  checkIfUrlIsInCache: boolean,
  tryTwice2DownloadFiles: boolean,
  calledOnDownloadedOneFile: () => void,
) => Promise<{
  result: 'downloadingCanceled' | 'ok';
  errors?: string[];
}>;
export declare function download({
  numberOfFiles,
  batches,
  assets,
  mainEntryPoint,
}: DownloadPayload): Promise<DownloadedInfo | void>;
