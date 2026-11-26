// Upload PMTiles archives to Cloudflare R2 via the S3-compatible API (aws4fetch).
// Requires R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY (in env or secrets.env).

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { AIRSPACE_3D_PMTILES_FILENAME, AIRSPACE_PMTILES_FILENAME } from '@flyxc/common';
import { AwsClient } from 'aws4fetch';
import { program } from 'commander';

import { getAppFolderFromDist } from '../util';

const defaultInputFolder = resolve(join(getAppFolderFromDist(dirname(fileURLToPath(import.meta.url))), 'assets/tiles'));

program
  .option('-i, --input <folder>', 'input folder', defaultInputFolder)
  .option('-b, --bucket <name>', 'R2 bucket name', 'flyxc-airspaces')
  .parse(process.argv);

const { input, bucket } = program.opts<{ input: string; bucket: string }>();

const accountId = process.env.R2_ACCOUNT_ID || SECRETS.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID || SECRETS.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || SECRETS.R2_SECRET_ACCESS_KEY;

const r2 = new AwsClient({
  accessKeyId,
  secretAccessKey,
  service: 's3',
  region: 'auto',
  retries: 3,
  initRetryMs: 200,
});

for (const filename of [AIRSPACE_PMTILES_FILENAME, AIRSPACE_3D_PMTILES_FILENAME]) {
  const srcPath = join(input, filename);
  if (!existsSync(srcPath)) {
    throw new Error(`Missing PMTiles archive: ${srcPath}`);
  }
  const url = `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${filename}`;
  console.log(`Uploading ${srcPath} -> r2://${bucket}/${filename}...`);
  const res = await r2.fetch(url, {
    method: 'PUT',
    body: readFileSync(srcPath),
    headers: {
      'Content-Type': 'application/vnd.pmtiles',
      'Cache-Control': 'public,max-age=3600,no-transform',
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to upload ${filename}: HTTP ${res.status} ${await res.text()}`);
  }
}

console.log('Upload complete.');
