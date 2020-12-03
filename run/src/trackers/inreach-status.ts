// Fetch the latest inreach incidents.

/* eslint-disable @typescript-eslint/no-var-requires */
const Parser = require('rss-parser');

const STATUS_URL_RSS = 'https://status.inreach.garmin.com/history.rss';

const MAX_AGE_HOUR = 24;
const MAX_ENTRIES = 20;

export interface Incident {
  title: string;
  timestamp: number;
  link: string;
}

export async function fetchIncidents(): Promise<Incident[]> {
  const incidents: Incident[] = [];

  try {
    const parser = new Parser();
    const feed = await parser.parseURL(STATUS_URL_RSS);
    if (feed.items != null) {
      const oldestTimestamp = Date.now() - MAX_AGE_HOUR * 3600 * 1000;
      const numItems = Math.min(feed.items.length, MAX_ENTRIES);

      for (let i = 0; i < numItems; i++) {
        const item = feed.items[i];
        if (item.pubDate && item.title && item.link) {
          const timestamp = Date.parse(item.pubDate);
          if (timestamp < oldestTimestamp) {
            break;
          }
          incidents.push({
            title: item.title,
            link: item.link,
            timestamp,
          });
        }
      }
    }
  } catch (e) {
    console.error(`[InReach Status] Fetch error.`);
  }
  return incidents;
}
