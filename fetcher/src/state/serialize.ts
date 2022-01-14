import { FetcherState } from 'flyxc/common/protos/fetcher-state';
import zlib from 'zlib';

import { Storage, File } from '@google-cloud/storage';

import { lightFormat, parse, sub, isBefore } from 'date-fns';

// Loads the state from the storage.
//
// Throws if an error is encountered.
export async function importFromStorage(bucketName: string, filePath: string): Promise<FetcherState> {
  const storage = new Storage();
  const bucket = storage.bucket(bucketName);
  const [stateBuffer] = await bucket.file(filePath).download();
  return FetcherState.fromBinary(zlib.brotliDecompressSync(stateBuffer));
}

// Saves the state to the storage.
//
// Returns whether the export was successful.
export async function exportToStorage(
  state: Readonly<FetcherState>,
  bucketName: string,
  filePath: string,
): Promise<boolean> {
  let success = true;
  try {
    const storage = new Storage();
    const bucket = storage.bucket(bucketName);
    const buffer = Buffer.from(FetcherState.toBinary(state));
    await bucket.file(filePath).save(zlib.brotliCompressSync(buffer));
  } catch (e) {
    console.error(`Export to datastore failed: ${e}`);
    success = false;
  }
  return success;
}

// Creates an archive file.
//
// 'YYYY-MM-DD' gets replaced by the date in the file name.
//
// Delete old archives files.
export async function createStateArchive(
  state: Readonly<FetcherState>,
  bucketName: string,
  folderName: string,
  fileName: string,
): Promise<void> {
  // Create a new archive.
  const now = new Date(state.lastTickSec * 1000);
  fileName = fileName.replace('YYYY-MM-DD', lightFormat(now, 'yyyy-MM-dd'));
  await exportToStorage(state, bucketName, `${folderName}/${fileName}`);
  // Delete old archives.
  try {
    const storage = new Storage();
    const bucket = storage.bucket(bucketName);
    const [files] = await bucket.getFiles({ prefix: `${folderName}/` });
    const oldestDateToKeep = sub(now, { days: 30 });
    const filesToDelete: File[] = [];
    for (const file of files) {
      const m = file.name.match(/(\d{4}-\d{2}-\d{2})/);
      if (m == null) {
        continue;
      }
      const date = parse(m[1], 'yyyy-MM-dd', new Date());
      if (isBefore(date, oldestDateToKeep)) {
        filesToDelete.push(file);
      }
    }

    await Promise.allSettled(filesToDelete.map((f) => f.delete()));
  } catch (e) {}
}
