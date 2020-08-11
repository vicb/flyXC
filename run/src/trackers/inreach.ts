/* eslint-disable @typescript-eslint/no-var-requires */
const request = require('request-zero');
/* eslint-enable @typescript-eslint/no-var-requires */

import { DOMParser } from 'xmldom';

import { createFeatures, Point, REFRESH_EVERY_MINUTES } from './trackers';

// Queries the datastore for the devices that have not been updated in REFRESH_EVERY_MINUTES.
// Queries the feeds until the timeout is reached and store the data back into the datastore.
export async function refresh(datastore: any, hour: number, timeoutSecs: number): Promise<number> {
  const start = Date.now();

  const query = datastore
    .createQuery('Tracker')
    .filter('device', '=', 'inreach')
    .filter('updated', '<', start - REFRESH_EVERY_MINUTES * 60 * 1000)
    .order('updated', { descending: true });

  const devices = (await datastore.runQuery(query))[0];
  const startDate = new Date(start - hour * 3600 * 1000).toISOString();

  let numDevices = 0;
  let numActiveDevices = 0;
  for (; numDevices < devices.length; numDevices++) {
    const points: Point[] = [];
    const device = devices[numDevices];
    let url: string = device.inreach;
    // Automatically inserts "Feed/Share" when missing in url.
    // That's missing for a lot of users.
    if (url.match(/Feed\/Share/i) == null) {
      const lastSlash = url.lastIndexOf('/');
      if (lastSlash > -1) {
        url = url.substr(0, lastSlash) + '/Feed/Share' + url.substr(lastSlash);
      }
    }
    if (/^https?:\/\/[\w.]*?garmin.com\/Feed\/Share\/[^?]+/i.test(url)) {
      const response = await request(`${url}?d1=${startDate}`);

      if (response.code == 200 && response.body.length > 0) {
        console.log(`Refreshing inreach @ ${url}`);
        const dom = new DOMParser({
          errorHandler: (level: string, msg: string): void => {
            if (level === 'error') {
              console.error(`InReach parse error (${msg})`);
            }
          },
        }).parseFromString(response.body);
        const placemarks = dom ? dom.getElementsByTagName('Placemark') : [];
        if (placemarks.length > 0) {
          numActiveDevices++;
        }
        for (let p = 0; p < placemarks.length; p++) {
          const placemark = placemarks[p];
          const coords = getChildNode(placemark.childNodes, 'Point.coordinates');
          const timestamp = getChildNode(placemark.childNodes, 'TimeStamp.when');
          const dataNode = getChildNode(placemark.childNodes, 'ExtendedData');
          const data = dataNode ? getData(dataNode) : null;
          const msg = getChildNode(placemark.childNodes, 'description')?.firstChild?.nodeValue ?? '';
          if (coords && timestamp && data && coords.firstChild?.nodeValue && timestamp.firstChild?.nodeValue) {
            const [lon, lat, alt] = coords.firstChild.nodeValue
              .trim()
              .split(',')
              .map((v: string): number => Number(v));
            const ts = new Date(timestamp.firstChild.nodeValue).getTime();
            points.push({
              lon,
              lat,
              alt: Math.round(alt),
              ts,
              name: data['Name'],
              msg,
              speed: Number(data['Velocity'].replace(/^([\d]+).*/, '$1')),
              emergency: data['In Emergency'] !== 'False',
              valid: data['Valid GPS Fix'] === 'True',
            });
          }
        }
      } else {
        console.log(
          `Error refreshing inreach @ ${url}. HTTP code = ${response.code}, length = ${response.body.length}`,
        );
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
      console.error(`Timeout for inreach devices (${timeoutSecs}s)`);
      break;
    }
  }
  console.log(`Refreshed ${numDevices} inreach in ${(Date.now() - start) / 1000}s`);
  return numActiveDevices;
}

function getData(extendedData: ChildNode): { [k: string]: string } {
  const data: { [k: string]: string } = {};
  const childNodes = extendedData?.childNodes || [];
  for (let d = 0; d < childNodes.length; d++) {
    const el = childNodes[d] as Element;
    if (el.tagName == 'Data' && el.childNodes) {
      const id = el.getAttribute('name');
      if (id != null) {
        const value = getChildNode(el.childNodes, 'value')?.firstChild?.nodeValue;
        data[id] = value ?? '';
      }
    }
  }
  return data;
}

function getChildNode(nodeList: NodeListOf<ChildNode>, tagPath: string): ChildNode | null {
  const tagName = tagPath.split('.')[0];
  for (let i = 0; i < nodeList.length; i++) {
    const el = nodeList[i] as Element;
    if (el.tagName == tagName) {
      if (tagName == tagPath) {
        return el;
      }
      return getChildNode(nodeList[i].childNodes, tagPath.substr(tagName.length + 1));
    }
  }
  return null;
}
