import { getHostName } from '@flyxc/common';

export type API_NAME = 'GMAPS' | 'IGNFR' | 'ARCGIS';

const MISSING_KEY = 'missing-api-key';

// Returns the api key.
export function getApiKeyAndHost(api: API_NAME, urlOrHostname = ''): { key: string; host: string } {
  let keys: { [k: string]: string } = {};
  try {
    const json = import.meta.env[`VITE_${api}_API_KEY`];
    keys = json ? JSON.parse(json) : {};

    if (window.parent !== window) {
      // Embedded in an iframe
      const { key, host } = findKeyAndHost(keys, document.referrer);
      if (key !== MISSING_KEY) {
        return { key, host };
      }
    }

    if (import.meta.env.PROD && urlOrHostname != null) {
      const { key, host } = findKeyAndHost(keys, urlOrHostname);
      if (key != MISSING_KEY) {
        return { key, host };
      }
    }
  } catch (e) {
    console.error('Failed to parse API keys:', e);
  }
  // Returns the key matching the hostname of the current window
  return findKeyAndHost(keys, window.location.href);
}

function findKeyAndHost(keys: { [k: string]: string }, urlOrHostname: string): { key: string; host: string } {
  const hostname = getHostName(urlOrHostname) ?? urlOrHostname;
  for (const [host, key] of Object.entries(keys)) {
    if (hostname.endsWith(host)) {
      return { key, host };
    }
  }
  return { key: keys['*'] ?? MISSING_KEY, host: '*' };
}
