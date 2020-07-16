// Only refreshes tracker after 3 minutes.
export const REFRESH_EVERY_MINUTES = 3;

// Fetch 24h of data from the trackers.
export const REFRESH_MAX_HOURS = 24;

// Do not fetch for more than 40 seconds.
export const REFRESH_TIMEOUT_SECONDS = 40;

export interface Point {
  lat: number;
  lon: number;
  alt: number;
  // Timestamps in milliseconds.
  ts: number;
  name: string;
  emergency: boolean;
  msg: string;
  // speed is supported by inreach only.
  speed?: number;
  // Whether the gps fix is valid - inreach only.
  valid?: boolean;
}

export interface LineString {
  // Array of [lon, lat].
  line: number[][];
  // Timestamp of the first fix in milliseconds.
  first_ts: number;
}
