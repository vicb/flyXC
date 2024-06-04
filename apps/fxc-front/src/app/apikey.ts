import { getHostName } from '@flyxc/common';

import { keys } from './keys';

// Returns the api key.
export function getApiKeyAndHost(apiName: keyof typeof keys, urlOrHostname = ''): { key: string; host: string } {
  const apiKeys = keys[apiName] ?? {};

  if (window.parent !== window) {
    // Embedded in an iframe
    const { key, host } = findKeyAndHost(apiKeys, document.referrer);
    if (key != null) {
      return { key, host };
    }
  }

  if (import.meta.env.PROD) {
    // Load anything in dev.
    if (urlOrHostname != null) {
      // Consider the url from the track
      const { key, host } = findKeyAndHost(apiKeys, urlOrHostname);
      if (key != null) {
        return { key, host };
      }
    }
  }

  // Returns the key matching the hostname of the current window
  const { key, host } = findKeyAndHost(apiKeys, window.location.href);
  return { key: key ?? 'no-api-key', host };
  ('no-api-key');
}

function findKeyAndHost(keys: { [k: string]: string }, urlOrHostname: string): { key: string | null; host: string } {
  const hostname = getHostName(urlOrHostname) ?? urlOrHostname;
  for (const [host, key] of Object.entries(keys)) {
    if (hostname.endsWith(host)) {
      return { key, host };
    }
  }
  return { key: keys['*'] ?? null, host: '*' };
}
