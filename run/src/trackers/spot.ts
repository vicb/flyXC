/* eslint-disable @typescript-eslint/no-var-requires */
const request = require('request-zero');
/* eslint-enable @typescript-eslint/no-var-requires */

import { createFeatures, Point, REFRESH_EVERY_MINUTES } from './trackers';

// Queries the datastore for the devices that have not been updated in REFRESH_EVERY_MINUTES.
// Queries the feeds until the timeout is reached and store the data back into the datastore.
export async function refresh(datastore: any, hour: number, timeoutSecs: number): Promise<number> {
  const start = Date.now();

  const query = datastore
    .createQuery('Tracker')
    .filter('device', '=', 'spot')
    .filter('updated', '<', start - REFRESH_EVERY_MINUTES * 60 * 1000)
    .order('updated', { descending: true });

  const devices = (await datastore.runQuery(query))[0];
  const startDate = new Date(start - hour * 3600 * 1000).toISOString().substring(0, 19) + '-0000';

  let numDevices = 0;
  let numActiveDevices = 0;
  for (; numDevices < devices.length; numDevices++) {
    const points: Point[] = [];
    const device = devices[numDevices];
    const id: string = device.spot;
    if (/^\w+$/i.test(id)) {
      const url = `https://api.findmespot.com/spot-main-web/consumer/rest-api/2.0/public/feed/${id}/message.json?startDate=${startDate}`;
      let response;
      try {
        response = await request(url);
      } catch (e) {
        console.error(`Error refreshing spot @ ${id} = ${e.message}`);
        continue;
      }
      if (response.code != 200) {
        console.error(`Error refreshing spot @ ${id}`);
        continue;
      }
      console.log(`Refreshing spot @ ${id}`);
      const fixes = JSON.parse(response.body)?.response?.feedMessageResponse?.messages?.message;
      if (fixes && Array.isArray(fixes)) {
        numActiveDevices++;
        fixes.forEach((f: any) => {
          points.push({
            lon: f.longitude,
            lat: f.latitude,
            ts: f.unixTime * 1000,
            alt: f.altitude,
            name: f.messengerName,
            emergency: f.messageType == 'HELP',
            msg: f.messageContent,
          });
        });
      }
    }

    device.features = JSON.stringify(createFeatures(points));
    device.updated = Date.now();
    device.active = points.length > 0;

    datastore.save({
      key: device[datastore.KEY],
      data: device,
      excludeFromIndexes: ['features'],
    });

    if (Date.now() - start > timeoutSecs * 1000) {
      console.error(`Timeout for spot devices (${timeoutSecs}s)`);
      break;
    }
  }
  console.log(`Refreshed ${numDevices} spot in ${(Date.now() - start) / 1000}s`);
  return numActiveDevices;
}
