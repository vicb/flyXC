// Fetch the latest inreach incidents.

/* eslint-disable @typescript-eslint/no-var-requires */
const Parser = require('rss-parser');
/* eslint-enable @typescript-eslint/no-var-requires */

const STATUS_URL_RSS = 'https://status.inreach.garmin.com/history.rss';

const MAX_AGE_HOURS = 24;

export interface Incident {
  title: string;
  ts: number;
  link: string;
}

export async function fetchIncidents(): Promise<Incident[]> {
  const incidents: Incident[] = [];

  try {
    const parser = new Parser();
    const feed = await parser.parseURL(STATUS_URL_RSS);
    if (feed.items != null) {
      const oldestTimestamp = Date.now() - MAX_AGE_HOURS * 24 * 3600 * 1000;

      for (let i = 0; i < feed.items.length; i++) {
        const item = feed.items[i];
        if (item.pubDate && item.title && item.link) {
          const ts = Date.parse(item.pubDate);
          if (ts < oldestTimestamp) {
            break;
          }
          incidents.push({
            title: item.title,
            link: item.link,
            ts,
          });
        }
      }
    }
  } catch (e) {
    console.error(`Error while retrieving inreach status.`);
  }
  return incidents;
}
