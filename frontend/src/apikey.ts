import { keys } from './keys';

// Returns the api key.
export function getApiKey(apiName: string, extraUrl?: string | null): string {
  const allKeys = keys[apiName];
  let key: string | null = null;

  if (allKeys != null) {
    const location = window.top == window ? window.location.href : document.referrer;
    key = findKey(allKeys, location);
    if (extraUrl != null && key == null) {
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
