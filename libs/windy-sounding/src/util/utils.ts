import type { Fav } from '@windy/interfaces';

// Some models do not have the required parameters for soundings (i.e. surface only)
export const SUPPORTED_MODEL_PREFIXES = ['ecmwf', 'gfs', 'nam', 'icon', 'hrrr', 'ukv', 'arome'];
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
