// Unzip tiles to Google Cloud Storage.

import { parallelTasksWithTimeout } from '@flyxc/common';
import { Storage } from '@google-cloud/storage';
import { program } from 'commander';
import fs from 'node:fs';
import path from 'node:path';

const LOG_EVERY_N_TILES = 1000;
const NUM_SLOTS = 100;

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

  const options = {
    resumable: false,
    gzip: true,
    cacheControl: 'public,max-age=360000,no-transform',
    contentType: 'application/x-protobuf',
  };

  const uploadOne = async (id: string, index: number) => {
    if (index % LOG_EVERY_N_TILES == 0) {
      console.log(`  added ${index} files`);
    }

    const filename = idToFilename(id);
    const srcPath = path.join(inputDir, filename);
    const dstPath = `tiles/${filename}`;

    for (let i = 0; i <= retries; i++) {
      try {
        const buffer = fs.readFileSync(srcPath);
        await bucket.file(dstPath).save(buffer, options);
      } catch (e) {
        console.error(`Error ${e} adding ${dstPath}`);
      }
    }
  };

  await parallelTasksWithTimeout(NUM_SLOTS, fileIds, uploadOne);
}

async function deleteFiles(fileIds: string[], bucketName: string, retries: number) {
  const bucket = await getBucket(bucketName);

  const deleteOne = async (id: string, index: number) => {
    if (index % LOG_EVERY_N_TILES == 0) {
      console.log(`  deleted ${index} files`);
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
