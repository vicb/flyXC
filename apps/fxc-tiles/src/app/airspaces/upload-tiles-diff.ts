// Unzip tiles to Google Cloud Storage.

import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path, { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parallelTasksWithTimeout } from '@flyxc/common';
import type { Bucket } from '@google-cloud/storage';
import { Storage } from '@google-cloud/storage';
import { program } from 'commander';

import { getAppFolderFromDist, printOnCurrentLine } from '../util';

const LOG_EVERY_N_TILES = 100;
const NUM_SLOTS = 150;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const defaultInputFolder = resolve(join(getAppFolderFromDist(__dirname), 'assets/tiles'));
const defaultDiffFile = resolve(join(getAppFolderFromDist(__dirname), 'assets/tiles-info-diff.json'));
const defaultDateFile = resolve(join(getAppFolderFromDist(__dirname), 'assets/airspaces-date.json'));

program
  .option('-i, --input <folder>', 'input folder', defaultInputFolder)
  .option('-b, --bucket <file>', 'bucket name', 'airspaces')
  .option('-d, --diff <file>', 'Diff to apply', defaultDiffFile)
  .option('--date <file>', 'airspace date file', defaultDateFile)
  .parse(process.argv);

const { input, bucket, diff, date: dateFile } = program.opts();

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
async function addFiles(inputDir: string, fileIds: string[], bucketName: string, retries: number): Promise<string[]> {
  const bucket = getBucket(bucketName);
  const failedIds: string[] = [];

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
    const dstPath = `tiles/${filename}`;

    for (let i = 0; i <= retries; i++) {
      try {
        const srcBuffer = await readFile(srcPath);
        await bucket.file(dstPath).save(srcBuffer, options);
        return;
      } catch (e) {
        if (i === retries) {
          console.error(`Failed to add ${dstPath} after ${retries + 1} attempts: ${e}`);
          failedIds.push(id);
        } else {
          console.error(`Error adding ${dstPath} (attempt ${i + 1}/${retries + 1}): ${e}`);
        }
      }
    }
  };

  await parallelTasksWithTimeout(NUM_SLOTS, fileIds, uploadOne);
  printOnCurrentLine('');
  return failedIds;
}

// Delete files by id.
async function deleteFiles(fileIds: string[], bucketName: string, retries: number): Promise<string[]> {
  const bucket = getBucket(bucketName);
  const failedIds: string[] = [];

  const deleteOne = async (id: string, index: number) => {
    if (index % LOG_EVERY_N_TILES == 0) {
      printOnCurrentLine(`  deleted ${index} files`);
    }

    const filename = idToFilename(id);
    const path = `tiles/${filename}`;

    for (let i = 0; i <= retries; i++) {
      try {
        await bucket.file(path).delete({ ignoreNotFound: true });
        return;
      } catch (e) {
        if (i === retries) {
          console.error(`Failed to delete ${path} after ${retries + 1} attempts: ${e}`);
          failedIds.push(id);
        } else {
          console.error(`Error deleting ${path} (attempt ${i + 1}/${retries + 1}): ${e}`);
        }
      }
    }
  };

  await parallelTasksWithTimeout(NUM_SLOTS, fileIds, deleteOne);
  printOnCurrentLine('');
  return failedIds;
}

// Converts a file id to a filename.
// id is "zoom-x-y" or "zoom-x-y-variant".
function idToFilename(id: string): string {
  const parts = id.split('-');
  if (parts.length === 4) {
    const [z, x, y, variant] = parts;
    return `${z}/${x}/${y}-${variant}.pbf`;
  }
  const [z, x, y] = parts;
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
    const failedDeletions = await deleteFiles(instructions.deleted, bucket, 5);

    console.log(`# Adding ${instructions.added.length} new tiles...`);
    const failedAdditions = await addFiles(input, instructions.added, bucket, 5);

    console.log(`# Updating ${instructions.updated.length} existing tiles...`);
    const failedUpdates = await addFiles(input, instructions.updated, bucket, 5);

    const totalErrors = failedDeletions.length + failedAdditions.length + failedUpdates.length;
    if (totalErrors > 0) {
      console.error(`\nCompleted with ${totalErrors} error(s):`);
      if (failedDeletions.length > 0) {
        console.error(`  - ${failedDeletions.length} tile(s) failed to delete`);
      }
      if (failedAdditions.length > 0) {
        console.error(`  - ${failedAdditions.length} tile(s) failed to add`);
      }
      if (failedUpdates.length > 0) {
        console.error(`  - ${failedUpdates.length} tile(s) failed to update`);
      }
      process.exitCode = 1;
      return;
    }

    if (dateFile && existsSync(dateFile)) {
      console.log(`# Uploading airspaces-date.json...`);
      const bucketObj = getBucket(bucket);
      await bucketObj.file('airspaces-date.json').save(readFileSync(dateFile), {
        resumable: false,
        gzip: true,
        metadata: {
          cacheControl: 'public,max-age=3600,must-revalidate',
          contentType: 'application/json',
        },
      });
    }

    console.log(`# Done`);
  }
})();
