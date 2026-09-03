import * as zlib from 'node:zlib';

import { protos } from '@flyxc/common';
import type { File } from '@google-cloud/storage';
import { Storage } from '@google-cloud/storage';
import { isBefore, lightFormat, parse, sub } from 'date-fns';

// Shared Google Cloud Storage client instance.
// Reusing a single client avoids instantiating new connections, authentication checks,
// and internal event listeners on every periodic state export/import cycle.
let storage: Storage | undefined;
function getStorage(): Storage {
  return (storage ??= new Storage());
}

// Loads the state from the storage.
//
// Throws if an error is encountered.
export async function importFromStorage(bucketName: string, filePath: string): Promise<protos.FetcherState> {
  const bucket = getStorage().bucket(bucketName);
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
    const bucket = getStorage().bucket(bucketName);
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
    const bucket = getStorage().bucket(bucketName);
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
