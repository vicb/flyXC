// Unzip tiles to Google Cloud Storage.

import fs from 'node:fs';

import { Storage } from '@google-cloud/storage';
import { program } from 'commander';
import unzipper from 'unzipper';

program
  .option('-i, --input <file>', 'zip file', 'tiles.zip')
  .option('-b, --bucket <file>', 'bucket name', 'airsp')
  .option('-d, --diff <file>', 'Diff to apply', 'tiles-info-diff.json')
  .parse(process.argv);

const { input, bucket, diff } = program.opts();

console.log(`Expand configuration:`);
console.log(`input: ${input}`);
console.log(`bucket: ${bucket}`);
console.log(`diff: ${diff}`);
console.log(`\n`);

if (!fs.existsSync(input)) {
  throw new Error(`Input file not found`);
}

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

// Expand the passed .zip file to the given bucket.
//
// Errors are retried up to retries time.
//
// If paths are specified, only those are expanded.
async function expandZip(zipFile, bucketName, retries, paths: Set<string> | null = null) {
  const bucket = await getBucket(bucketName);
  const startTime = Date.now();

  let numFiles = 0;
  let numErrors = 0;
  const errorPaths = new Set<string>();

  fs.createReadStream(zipFile)
    .pipe(unzipper.Parse())
    .on('entry', function (entry) {
      const { path, type } = entry;
      if (type == 'File') {
        if (path.startsWith('tiles/')) {
          // Skip path not in paths when it is not null.
          if (paths != null) {
            if (!paths.has(path)) {
              entry.autodrain();
              return;
            }
          }
          // Expand the file.
          const file = bucket.file(path);
          entry
            .pipe(
              file.createWriteStream({
                resumable: false,
                gzip: true,
                cacheControl: 'public,max-age=360000,no-transform',
                contentType: 'application/x-protobuf',
              } as any),
            )
            .on('error', () => {
              numErrors++;
              console.error(`Error expanding ${path}`);
              errorPaths.add(path);
            })
            .on('finish', () => {
              numFiles++;
              if (numFiles % 10000 == 0) {
                console.log(`expanded ${numFiles} files...`);
              }
            });
        } else {
          numErrors++;
          console.error(`Invalid filename ${path}`);
          entry.autodrain();
        }
      } else {
        entry.autodrain();
      }
    })
    .on('finish', async () => {
      const minutes = Math.round((Date.now() - startTime) / (60 * 1000));
      console.log(`Expanded ${numFiles} files in ${minutes} minutes - ${numErrors} errors`);
      if (errorPaths.size > 0) {
        console.log(`Errors:\n ${Array.from(errorPaths).join('\n')}`);
        if (retries-- > 0) {
          console.log(`Retrying...`);
          await expandZip(zipFile, bucketName, retries, errorPaths);
        }
      }
    });
}

async function deleteFiles(files, bucketName, retries) {
  const bucket = await getBucket(bucketName);
  const errorFiles: string[] = [];

  for (const file of files) {
    const [response] = await bucket.file(file).delete({ ignoreNotFound: true });
    if (response.statusCode != 200) {
      errorFiles.push(file);
    }
  }

  if (retries > 0 && errorFiles.length > 0) {
    await deleteFiles(errorFiles, bucketName, --retries);
  }
}

function idToFilename(id) {
  const [z, x, y] = id.split('-');
  return `tiles/${z}/${x}/${y}.pbf`;
}

(async function () {
  let uploadFiles: Set<string> | null = null;

  if (diff != null) {
    if (!fs.existsSync(diff)) {
      throw new Error(`Diff file not found`);
    }

    const instructions = JSON.parse(fs.readFileSync(diff, 'utf8'));

    const files = instructions.deleted.map((id) => idToFilename(id));
    console.log(`Deleting ${files.length} files`);
    deleteFiles(files, bucket, 3);

    uploadFiles = new Set([...instructions.added, ...instructions.updated].map((id) => idToFilename(id)));
    console.log(`Uploading ${uploadFiles.size} files`);
  }

  await expandZip(input, bucket, 3, uploadFiles);
})();
