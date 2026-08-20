import type { Fav } from '@windy/favs';
import type { LatLon } from '@windy/interfaces';

export const METEOBLUE_AI_MODEL = 'mblue';
export const DEFAULT_MODEL = 'ecmwf';

// Some models do not have the required parameters for soundings (i.e. surface only)
const SUPPORTED_MODELS = [
  /^ecmwf$/,
  /^gfs$/,
  /^nam/,
  /^icon/,
  /^hrrr/,
  /^ukv$/,
  /^arome\w+/, // "arome" is unsupported
  /^czeAladin$/,
  /^canHrdps$/,
  /^mblue$/,
];

export function injectStyles(styles: string) {
  const { head } = document;
  const style = document.createElement('style');
  head.appendChild(style);
  style.appendChild(document.createTextNode(styles));
}

export function getFavLabel(fav: Fav): string {
  return fav.title || '';
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
  return isSupportedModelName(windyModelName) ? windyModelName : DEFAULT_MODEL;
}

/**
 * Checks if a Windy model name is supported for soundings.
 *
 * Some models only include surface data and can not be used for soundings.
 *
 * @param windyModelName - The Windy model name to check.
 * @returns True if the model is supported, false otherwise.
 */
export function isSupportedModelName(windyModelName: string): boolean {
  return SUPPORTED_MODELS.some((prefix) => prefix.test(windyModelName));
}

/**
 * Returns the sorted list of supported model names for soundings at a given location.
 */
export function getAvailableModels(location: LatLon): string[] {
  const models = W.models.getAllPointProducts(location).filter((model: string) => isSupportedModelName(model));
  if (!models.includes(METEOBLUE_AI_MODEL)) {
    models.push(METEOBLUE_AI_MODEL);
  }
  return models.sort();
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
