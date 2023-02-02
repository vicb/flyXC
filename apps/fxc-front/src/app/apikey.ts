import { getHostName } from '@flyxc/common';
import { environment } from '../environments/environment';
import { keys } from './keys';

// Returns the api key.
export function getApiKey(apiName: string, urlOrHostname = ''): string {
  const apiKeys = keys[apiName] ?? {};

  if (window.parent !== window) {
    // Embedded in an iframe
    const key = findKey(apiKeys, document.referrer);
    if (key != null) {
      return key;
    }
  }

  if (environment.production) {
    // Load anything in dev.
    if (urlOrHostname != null) {
      // Consider the url from the track
      const key = findKey(apiKeys, urlOrHostname);
      if (key != null) {
        return key;
      }
    }
  }

  // Returns the key matching the hostname of the current window
  return findKey(apiKeys, window.location.href) ?? 'no-api-key';
}

function findKey(keys: { [k: string]: string }, urlOrHostname: string): string | null {
  const hostname = getHostName(urlOrHostname) ?? urlOrHostname;
  for (const [host, key] of Object.entries(keys)) {
    if (hostname.endsWith(host)) {
      return key;
    }
  }
  return keys['*'] ?? null;
}
