// Unzip tiles to Google Cloud Storage.

import { existsSync, readFileSync } from 'node:fs';
import path, { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parallelTasksWithTimeout } from '@flyxc/common';
import type { Bucket } from '@google-cloud/storage';
import { Storage } from '@google-cloud/storage';
import { program } from 'commander';

import { getAppFolderFromDist, printOnCurrentLine } from '../util';

const LOG_EVERY_N_TILES = 100;
const NUM_SLOTS = 30;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const defaultInputFolder = resolve(join(getAppFolderFromDist(__dirname), '/src/assets/airspaces/tiles'));
const defaultDiffFile = resolve(join(getAppFolderFromDist(__dirname), '/src/assets/airspaces/tiles-info-diff.json'));

program
  .option('-i, --input <folder>', 'input folder', defaultInputFolder)
  .option('-b, --bucket <file>', 'bucket name', 'airspaces')
  .option('-d, --diff <file>', 'Diff to apply', defaultDiffFile)
  .parse(process.argv);

const { input, bucket, diff } = program.opts();

console.log(`Sync configuration:`);
console.log(`input: ${input}`);
console.log(`bucket: ${bucket}`);
console.log(`diff: ${diff}`);
console.log(`\n`);

function getBucket(bucketName: string): Bucket {
  const config = process.env.GCP_PRIVATE_KEY
    ? {
        projectId: process.env.GCP_PROJECT_ID,
        credentials: {
          client_email: process.env.GCP_CLIENT_EMAIL,
          // Make sure the private key is properly formatted.
          private_key: process.env.GCP_PRIVATE_KEY.replace(/\\n/gm, '\n'),
        },
      }
    : {};
  const storage = new Storage(config);
  return storage.bucket(bucketName);
}

// Upload files by id.
async function addFiles(inputDir: string, fileIds: string[], bucketName: string, retries: number) {
  const bucket = getBucket(bucketName);

  const options = {
    resumable: false,
    gzip: true,
    cacheControl: 'public,max-age=360000,no-transform',
    contentType: 'application/x-protobuf',
  };

  const uploadOne = async (id: string, index: number) => {
    if (index % LOG_EVERY_N_TILES == 0) {
      printOnCurrentLine(`  added ${index} files`);
    }

    const filename = idToFilename(id);
    const srcPath = path.join(inputDir, filename);
    const srcBuffer = readFileSync(srcPath);
    const dstPath = `tiles/${filename}`;

    for (let i = 0; i <= retries; i++) {
      try {
        await bucket.file(dstPath).save(srcBuffer, options);
        break;
      } catch (e) {
        console.error(`Error ${e} adding ${dstPath}`);
      }
    }
  };

  await parallelTasksWithTimeout(NUM_SLOTS, fileIds, uploadOne);
  printOnCurrentLine('');
}

// Delete files by id.
async function deleteFiles(fileIds: string[], bucketName: string, retries: number) {
  const bucket = getBucket(bucketName);

  const deleteOne = async (id: string, index: number) => {
    if (index % LOG_EVERY_N_TILES == 0) {
      printOnCurrentLine(`  deleted ${index} files`);
    }

    const filename = idToFilename(id);
    const path = `tiles/${filename}`;

    for (let i = 0; i <= retries; i++) {
      const [response] = await bucket.file(path).delete({ ignoreNotFound: true });
      // https://github.com/googleapis/nodejs-storage/issues/2182
      const statusCode = response?.statusCode ?? 200;

      if (statusCode >= 200 && statusCode <= 299) {
        return;
      }

      console.error(`  Error ${statusCode} deleting ${path}`);
    }
  };

  await parallelTasksWithTimeout(NUM_SLOTS, fileIds, deleteOne);
  printOnCurrentLine('');
}

// Converts a file id to a filename.
// id is "zoom-x-y".
function idToFilename(id: string): string {
  const [z, x, y] = id.split('-');
  return `${z}/${x}/${y}.pbf`;
}

(async function () {
  if (diff != null) {
    if (!existsSync(diff)) {
      throw new Error(`Diff file not found`);
    }

    if (!existsSync(input)) {
      throw new Error(`Input directory not found`);
    }

    const instructions = JSON.parse(readFileSync(diff, 'utf8'));

    console.log(`# Deleting ${instructions.deleted.length} old tiles...`);
    await deleteFiles(instructions.deleted, bucket, 5);

    console.log(`# Adding ${instructions.added.length} new tiles...`);
    await addFiles(input, instructions.added, bucket, 5);

    console.log(`# Updating ${instructions.updated.length} existing tiles...`);
    await addFiles(input, instructions.updated, bucket, 5);

    console.log(`# Done`);
  }
})();
