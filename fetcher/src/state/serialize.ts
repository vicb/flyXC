import { FetcherState } from 'flyxc/common/protos/fetcher-state';
import zlib from 'zlib';

import { Storage } from '@google-cloud/storage';

// Loads the state from the storage.
//
// Throws if an error is encountered.
export async function importFromStorage(bucketName: string, fileName: string): Promise<FetcherState> {
  const storage = new Storage();
  const bucket = storage.bucket(bucketName);
  const [stateBuffer] = await bucket.file(fileName).download();
  return FetcherState.fromBinary(zlib.brotliDecompressSync(stateBuffer));
}

// Saves the state to the storage.
//
// Returns whether the export was successful.
export async function exportToStorage(
  state: Readonly<FetcherState>,
  bucketName: string,
  fileName: string,
): Promise<boolean> {
  let success = true;
  try {
    const storage = new Storage();
    const bucket = storage.bucket(bucketName);
    const buffer = Buffer.from(FetcherState.toBinary(state));
    await bucket.file(fileName).save(zlib.brotliCompressSync(buffer));
  } catch (e) {
    console.error(`Export to datastore failed: ${e}`);
    success = false;
  }
  return success;
}
