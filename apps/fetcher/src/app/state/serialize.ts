import { protos } from '@flyxc/common';
import type { File} from '@google-cloud/storage';
import { Storage } from '@google-cloud/storage';
import { isBefore, lightFormat, parse, sub } from 'date-fns';
import * as zlib from 'node:zlib';

// Loads the state from the storage.
//
// Throws if an error is encountered.
export async function importFromStorage(bucketName: string, filePath: string): Promise<protos.FetcherState> {
  const storage = new Storage();
  const bucket = storage.bucket(bucketName);
  const [stateBuffer] = await bucket.file(filePath).download();
  return protos.FetcherState.fromBinary(zlib.brotliDecompressSync(stateBuffer));
}

// Saves the state to the storage.
//
// Returns whether the export was successful.
export async function exportToStorage(
  state: Readonly<protos.FetcherState>,
  bucketName: string,
  filePath: string,
): Promise<boolean> {
  let success = true;
  try {
    const storage = new Storage();
    const bucket = storage.bucket(bucketName);
    const buffer = Buffer.from(protos.FetcherState.toBinary(state));
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
  state: Readonly<protos.FetcherState>,
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
  } catch (e) {
    // empty
  }
}
