/* eslint-disable @typescript-eslint/no-var-requires */
const DOMParser = require('xmldom').DOMParser;
const request = require('request-zero');
/* eslint-enable @typescript-eslint/no-var-requires */

export async function refresh(datastore: any, hour: number, timeout: number): Promise<number> {
  const start = Date.now();

  const query = datastore
    .createQuery('Tracker')
    .filter('device', '=', 'inreach')
    .filter('updated', '<', start - 3 * 60 * 1000)
    .order('updated', { descending: true });

  const devices = (await datastore.runQuery(query))[0];
  const startDate = new Date(start - hour * 3600 * 1000).toISOString();

  let numDevices = 0;
  let numActiveDevices = 0;
  for (; numDevices < devices.length; numDevices++) {
    const features: any[] = [];
    const device = devices[numDevices];
    const url: string = device.inreach;
    if (/^https?:\/\/[\w.]*?garmin.com\/Feed\/Share\/[^?]+/i.test(url)) {
      const response = await request(`${url}?d1=${startDate}`);

      if (response.code == 200) {
        console.log(`Refreshing inreach @ ${url}`);
        const dom = new DOMParser().parseFromString(response.body);
        const placemarks = dom.getElementsByTagName('Placemark');
        if (placemarks.length > 0) {
          numActiveDevices++;
        }
        for (let p = 0; p < placemarks.length; p++) {
          const placemark = placemarks[p];
          const coords = getChildNode(placemark.childNodes, 'Point.coordinates');
          const timestamp = getChildNode(placemark.childNodes, 'TimeStamp.when');
          const data = getData(getChildNode(placemark.childNodes, 'ExtendedData'));
          const msg = getChildNode(placemark.childNodes, 'description')?.firstChild?.nodeValue;
          if (coords && timestamp && data) {
            const [lon, lat, alt] = coords.firstChild.nodeValue
              .trim()
              .split(',')
              .map((v: string): number => Number(v));
            const ts = new Date(timestamp.firstChild.nodeValue).getTime();
            features.push({
              lon,
              lat,
              alt: Math.round(alt),
              ts,
              name: data['Name'],
              msg,
              speed: Number(data['Velocity'].replace(/^([\d]+).*/, '$1')),
              emergency: data['In Emergency'] != 'False',
            });
          }
        }
        if (features.length) {
          const line = features.map(f => [f.lon, f.lat]);
          features.push({ line });
        }
      } else {
        console.log(`Error refreshing inreach @ ${url}`);
      }
    }

    device.features = JSON.stringify(features);
    device.updated = Date.now();
    device.active = features.length > 0;

    datastore.save({
      key: device[datastore.KEY],
      data: device,
      excludeFromIndexes: ['features'],
    });

    if (Date.now() - start > timeout * 1000) {
      console.log(`Timeout for inreach devices (${timeout}s)`);
      break;
    }
  }
  console.log(`Refreshed ${numDevices} inreach in ${(Date.now() - start) / 1000}s`);
  return numActiveDevices;
}

function getData(extendedData: any): any {
  const data: { [k: string]: string } = {};
  const childNodes = extendedData?.childNodes || [];
  for (let d = 0; d < childNodes.length; d++) {
    const node = childNodes[d];
    if (node.tagName == 'Data' && node.childNodes) {
      const id = node.getAttribute('name');
      const value = getChildNode(node.childNodes, 'value')?.firstChild?.nodeValue;
      data[id] = value;
    }
  }
  return data;
}

function getChildNode(nodeList: any[], tagPath: string): any {
  const tagName = tagPath.split('.')[0];
  for (let i = 0; i < nodeList.length; i++) {
    if (nodeList[i].tagName == tagName) {
      if (tagName == tagPath) {
        return nodeList[i];
      }
      return getChildNode(nodeList[i].childNodes, tagPath.substr(tagName.length + 1));
    }
  }
  return null;
}
