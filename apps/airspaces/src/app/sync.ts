// Unzip tiles to Google Cloud Storage.

import { Storage } from '@google-cloud/storage';
import { program } from 'commander';
import fs from 'node:fs';
import path from 'node:path';

const LOG_EVERY_N_TILES = 1000;

program
  .option('-i, --input <folder>', 'input folder', 'tiles')
  .option('-b, --bucket <file>', 'bucket name', 'airsp')
  .option('-d, --diff <file>', 'Diff to apply', 'tiles-info-diff.json')
  .parse(process.argv);

const { input, bucket, diff } = program.opts();

console.log(`Sync configuration:`);
console.log(`input: ${input}`);
console.log(`bucket: ${bucket}`);
console.log(`diff: ${diff}`);
console.log(`\n`);

async function getBucket(bucketName) {
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
  return await storage.bucket(bucketName);
}

async function addFiles(inputDir: string, fileIds: string[], bucketName: string, retries: number) {
  const bucket = await getBucket(bucketName);
  const errorIds: string[] = [];

  const options = {
    resumable: false,
    gzip: true,
    cacheControl: 'public,max-age=360000,no-transform',
    contentType: 'application/x-protobuf',
  };

  let count = 0;

  for (const id of fileIds) {
    const filename = idToFilename(id);
    const srcPath = path.join(inputDir, filename);
    const dstPath = `tiles/${filename}`;

    try {
      const buffer = fs.readFileSync(srcPath);
      await bucket.file(dstPath).save(buffer, options);
    } catch (e) {
      console.error(`Error ${e} adding ${dstPath}`);
      errorIds.push(id);
    }

    if (++count % LOG_EVERY_N_TILES == 0) {
      console.log(`  added ${count} files`);
    }
  }

  if (retries > 0 && errorIds.length > 0) {
    console.log(`${errorIds.length} error, retrying...`);
    addFiles(inputDir, errorIds, bucketName, --retries);
  }
}

async function deleteFiles(fileIds: string[], bucketName: string, retries: number) {
  const bucket = await getBucket(bucketName);
  const errorIds: string[] = [];

  let count = 0;

  for (const id of fileIds) {
    const filename = idToFilename(id);
    const path = `tiles/${filename}`;

    const [response] = await bucket.file(path).delete({ ignoreNotFound: true });

    // https://github.com/googleapis/nodejs-storage/issues/2182
    const statusCode = response?.statusCode ?? 200;

    if (statusCode < 200 && statusCode > 299) {
      console.error(`  Error ${statusCode} deleting ${path}`);
      errorIds.push(id);
    }

    if (++count % LOG_EVERY_N_TILES == 0) {
      console.log(`  deleted ${count} files`);
    }
  }

  if (retries > 0 && errorIds.length > 0) {
    console.log(`${errorIds.length} error, retrying...`);
    await deleteFiles(errorIds, bucketName, --retries);
  }
}

function idToFilename(id: string): string {
  const [z, x, y] = id.split('-');
  return `${z}/${x}/${y}.pbf`;
}

(async function () {
  if (diff != null) {
    if (!fs.existsSync(diff)) {
      throw new Error(`Diff file not found`);
    }

    if (!fs.existsSync(input)) {
      throw new Error(`Input directory not found`);
    }

    const instructions = JSON.parse(fs.readFileSync(diff, 'utf8'));

    console.log(`# Deleting ${instructions.deleted.length} old tiles...`);
    await deleteFiles(instructions.deleted, bucket, 3);

    console.log(`# Adding ${instructions.added.length} new tiles...`);
    await addFiles(input, instructions.added, bucket, 3);

    console.log(`# Updating ${instructions.updated.length} existing tiles...`);
    await addFiles(input, instructions.updated, bucket, 3);

    console.log(`# Done`);
  }
})();
