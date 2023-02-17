// Delete old GCP artifacts

import { Storage } from '@google-cloud/storage';

const storage = new Storage();

async function deleteOldFiles(bucketName: string, keepDays: number) {
  const bucket = storage.bucket(bucketName);
  const [files] = await bucket.getFiles();
  for (const file of files) {
    const [metadata] = await file.getMetadata();
    const createdMs = metadata.timeCreated ? Date.parse(metadata.timeCreated) : Date.now();
    const ageDays = Math.floor((Date.now() - createdMs) / (1000 * 3600 * 24));
    if (ageDays <= keepDays) {
      console.log(`Keeping ${file.name} (${ageDays} days old)`);
    } else {
      console.log(`Deleting ${file.name} (${ageDays} days old)`);
      await file.delete();
    }
  }
}

(async function () {
  await deleteOldFiles('us.artifacts.fly-xc.appspot.com', 30);
  await deleteOldFiles('artifacts.fly-xc.appspot.com', 30);
})();
