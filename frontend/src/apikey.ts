import { keys } from './keys';

// Returns the api key.
export function getApiKey(apiName: string, extraUrl?: string | null): string {
  const allKeys = keys[apiName];
  let key: string | null = null;

  if (allKeys != null) {
    // - checks the top most window first (i.e. when embedded in an iframe),
    // - checks the window location otherwise.
    const location = window.top?.location.href || window.location.href;
    key = findKey(allKeys, location);
    if (key == null && extraUrl) {
      key = findKey(allKeys, extraUrl);
    }
  }

  return key || 'no-api-key';
}

function findKey(keys: { [k: string]: string }, url: string): string | null {
  const a = document.createElement('a');
  a.href = url;
  const hostname = a.hostname;
  if (hostname in keys) {
    return keys[hostname];
  }
  if ('*' in keys) {
    return keys['*'];
  }
  return null;
}
