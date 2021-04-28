// Unzip tiles to Google Cloud Storage.

/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require('fs');
const prog = require('commander');
const unzipper = require('unzipper');
const { Storage } = require('@google-cloud/storage');
/* eslint-enable @typescript-eslint/no-var-requires */

prog.option('-i, --input <folder>', 'zip file').option('-b, --bucket <file>', 'bucket name', 'airspaces');
prog.parse(process.argv);

const { input, bucket } = prog.opts();

console.log(`Expand configuration:`);
console.log(`input: ${input}`);
console.log(`bucket: ${bucket}`);
console.log(`\n`);

if (!fs.existsSync(input)) {
  throw new Error(`Input file not found`);
}

async function expand(inputFile, bucketName, retries, paths = null) {
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
  const bucket = await storage.bucket(bucketName);
  const startTime = Date.now();
  const start = new Date();
  const ymd =
    String(start.getFullYear()) +
    String(start.getMonth() + 1).padStart(2, '0') +
    String(start.getDate()).padStart(2, '0');
  let numFiles = 0;
  let numErrors = 0;
  let errorPaths = new Set();

  fs.createReadStream(inputFile)
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
              }),
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
      const minutes = Math.round((Date.now() - startTime) / (60 * 1000), 1);
      console.log(`Expanded ${numFiles} files in ${minutes} minutes - ${numErrors} errors`);
      if (errorPaths.size > 0) {
        console.log(`Errors:\n ${Array.from(errorPaths).join('\n')}`);
        if (retries-- > 0) {
          console.log(`Retrying...`);
          await expand(inputFile, bucketName, retries, errorPaths);
        }
      }
    });
}

(async function () {
  await expand(input, bucket, 3);
})();
