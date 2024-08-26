import type { Fav } from '@windy/interfaces';

// Some models do not have the required parameters for soundings (i.e. surface only)
export const SUPPORTED_MODEL_PREFIXES = [
  'ecmwf',
  'gfs',
  'nam',
  'icon',
  'hrrr',
  'ukv',
  'arome',
  'czeAladin',
  'canHrdps',
];
export const DEFAULT_MODEL = 'ecmwf';

export function injectStyles(styles: string) {
  const { head } = document;
  const style = document.createElement('style');
  head.appendChild(style);
  style.appendChild(document.createTextNode(styles));
}

export function getFavLabel(fav: Fav): string {
  return fav.title || fav.name || '';
}

export function formatTimestamp(ts: number) {
  return new Date(ts).toLocaleString([], {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Returns the supported model name based on the provided windy model name.
 *
 * Some models only include surface data and can not be used for soundings.
 */
export function getSupportedModelName(windyModelName: string): string {
  return SUPPORTED_MODEL_PREFIXES.some((prefix) => windyModelName.startsWith(prefix)) ? windyModelName : DEFAULT_MODEL;
}

/**
 * Returns a code from a location (lat, lon).
 *
 * There is a bug in windy when lat or lon are strings (infinite loop).
 * And sometimes favorites location are strings.
 */
export function latLon2Str({ lat, lon }: { lat: string | number; lon: string | number }): string {
  return W.utils.latLon2str({ lat: Number(lat), lon: Number(lon) });
}
