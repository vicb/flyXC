// https://thermal.kk7.ch

export const AIRWAYS_TILE_URL = 'https://thermal.kk7.ch/tiles/skyways_all/{z}/{x}/{y}.png?src={domain}'.replace(
  '{domain}',
  window.location.hostname,
);

export const AIRWAYS_TILE_MIN_ZOOM = 0;
export const AIRWAYS_TILE_MAX_ZOOM = 0;
