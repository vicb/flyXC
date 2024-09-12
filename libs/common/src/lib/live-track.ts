import type { LiveDifferentialTrack, LiveExtra } from '../protos/live-track';
import { LiveTrack } from '../protos/live-track';
import { diffDecodeArray, diffEncodeArray32bit, findIndexes } from './math';
import { deepCopy } from './util';

// Number of bits reserved for device names.
const DEVICE_TYPE_NUM_BITS = 5;
// 0 is unused
const MAX_NUM_DEVICES = 2 ** DEVICE_TYPE_NUM_BITS - 1;
const DEVICE_TYPE_BITMASK = 2 ** DEVICE_TYPE_NUM_BITS - 1;

export enum LiveDataRetentionSec {
  // Incremental updates
  IncrementalShort = 5 * 60,
  IncrementalLong = 20 * 60,
  // Full updates
  FullH12 = 12 * 3600,
  FullH24 = 24 * 3600,
  FullH48 = 48 * 3600,
  Max = FullH48,
  // UFO updates
  Ufo = 3600,
  // Export to partners (max H12)
  ExportToPartners = 5 * 60,
}

// Minium track point intervals.
export enum LiveDataIntervalSec {
  Recent = 5,
  H6ToH12 = 60,
  H12ToH24 = 3 * 60,
  AfterH24 = 6 * 60,
}

export const TRACKERS_MAX_FETCH_DURATION_SEC = 24 * 3600;

// Age for a point to be considered old.
export const LIVE_AGE_OLD_SEC = 6 * 3600;
// Minimum interval for old points points.
export const LIVE_OLD_INTERVAL_SEC = 3 * 60;

// Refresh interval (how often one update is triggered)
export const LIVE_REFRESH_SEC = 60;
// Timeout for fetching - need time for completing the transaction.
export const LIVE_FETCH_TIMEOUT_SEC = LIVE_REFRESH_SEC - 20;

// Break tracks if gap is more than.
export const TRACK_GAP_MIN = 60;

// Export to partners.
export const EXPORT_UPDATE_SEC = 5 * 60;

export const trackerNames = [
  'inreach',
  'spot',
  'skylines',
  'flyme',
  'flymaster',
  'ogn',
  'zoleo',
  'xcontest',
  'meshbir',
] as const;

if (trackerNames.length > MAX_NUM_DEVICES - 1) {
  throw new Error('Too many devices');
}

// ID for the tracking devices.
export type TrackerNames = (typeof trackerNames)[number];

// How to display the tracker name.
export const trackerDisplayNames: Readonly<Record<TrackerNames, string>> = {
  inreach: 'InReach',
  spot: 'Spot',
  skylines: 'Skylines',
  flyme: 'FlyMe (XCGlobe)',
  flymaster: 'Flymaster',
  ogn: 'OGN',
  zoleo: 'zoleo',
  xcontest: 'XContest',
  meshbir: 'Paratracker',
};

export const trackerIdByName: Record<TrackerNames, number> = {} as any;
export const trackerNameById: Record<number, TrackerNames> = {} as any;

trackerNames.forEach((name, index) => {
  trackerNameById[index + 1] = name;
  trackerIdByName[name] = index + 1;
});

export const ufoFleetNames = ['aviant'] as const;

export type UfoFleetNames = (typeof ufoFleetNames)[number];

if (ufoFleetNames.length > MAX_NUM_DEVICES - 1) {
  throw new Error('Too many devices');
}

export const ufoFleetDisplayNames: Readonly<Record<UfoFleetNames, string>> = {
  aviant: 'Aviant drone',
};

export const ufoFleetIdByName: Record<UfoFleetNames, number> = {} as any;
export const ufoFleetNameById: Record<number, UfoFleetNames> = {} as any;

ufoFleetNames.forEach((name, index) => {
  if (name in trackerIdByName) {
    throw new Error(`${name} is a tracker`);
  }
  ufoFleetNameById[index + 1] = name;
  ufoFleetIdByName[name] = index + 1;
});

export enum LiveTrackFlag {
  DeviceTypeMask = DEVICE_TYPE_BITMASK,
  Valid = 1 << 6,
  Emergency = 1 << 7,
  LowBat = 1 << 8,
  IsUfo = 1 << 9,
}

export function isValidFix(flags: number): boolean {
  return (flags & LiveTrackFlag.Valid) != 0;
}

export function isEmergencyFix(flags: number): boolean {
  return (flags & LiveTrackFlag.Emergency) != 0;
}

export function isEmergencyTrack(track: LiveTrack): boolean {
  return track.flags.some((f) => isEmergencyFix(f));
}

export function isLowBatFix(flags: number): boolean {
  return (flags & LiveTrackFlag.LowBat) != 0;
}

export function isUfo(flags: number): boolean {
  return (flags & LiveTrackFlag.IsUfo) != 0;
}

export function getTrackerName(flags: number): TrackerNames | UfoFleetNames {
  return flags & LiveTrackFlag.IsUfo
    ? ufoFleetNameById[flags & LiveTrackFlag.DeviceTypeMask]
    : trackerNameById[flags & LiveTrackFlag.DeviceTypeMask];
}

export function getTrackerDisplayName(flags: number): string {
  return flags & LiveTrackFlag.IsUfo
    ? ufoFleetDisplayNames[getTrackerName(flags) as UfoFleetNames]
    : trackerDisplayNames[getTrackerName(flags) as TrackerNames];
}

export function getFixMessage(track: LiveTrack, index: number): string | undefined {
  return track.extra[index]?.message;
}

export function getFixSpeed(track: LiveTrack, index: number): number {
  return track.extra[index]?.speed ?? 0;
}

export function getLastMessage(track: LiveTrack): { timeSec: number; text: string } | undefined {
  const extraIndexes = Object.keys(track.extra).map((v) => Number(v));
  extraIndexes.sort((a, b) => b - a);
  for (const index of extraIndexes) {
    const text = track.extra[index]?.message;
    if (text) {
      return {
        timeSec: track.timeSec[index],
        text,
      };
    }
  }
  return undefined;
}

export function getTrackerFlags(value: {
  valid: boolean;
  emergency?: boolean | null;
  lowBat?: boolean | null;
  device: TrackerNames | UfoFleetNames;
}): number {
  let flags = 0;
  if (value.valid === true) {
    flags |= LiveTrackFlag.Valid;
  }
  if (value.emergency === true) {
    flags |= LiveTrackFlag.Emergency;
  }
  if (value.lowBat === true) {
    flags |= LiveTrackFlag.LowBat;
  }
  if (value.device in ufoFleetIdByName) {
    flags |= LiveTrackFlag.IsUfo | ufoFleetIdByName[value.device as UfoFleetNames];
  } else {
    flags |= trackerIdByName[value.device as TrackerNames];
  }
  return flags;
}

// Delete all the fixes strictly before timeSec from the track.
// Note:
// - A new track is returned.
export function removeBeforeFromLiveTrack(track: LiveTrack, timeSec: number): LiveTrack {
  track = deepCopy(track);
  if (track.timeSec.length == 0) {
    return track;
  }
  const indexes = findIndexes(track.timeSec, timeSec);
  if (indexes.beforeAll) {
    return track;
  }
  let numToDelete = indexes.afterIndex;
  if (indexes.afterAll) {
    numToDelete = track.timeSec.length + 1;
  }
  track.lat.splice(0, numToDelete);
  track.lon.splice(0, numToDelete);
  track.alt.splice(0, numToDelete);
  track.timeSec.splice(0, numToDelete);
  track.flags.splice(0, numToDelete);
  if (numToDelete > 0) {
    const extra: { [key: string]: LiveExtra } = {};
    for (const [index, value] of Object.entries(track.extra)) {
      const newIndex = Number(index) - numToDelete;
      if (newIndex >= 0) {
        extra[newIndex] = value;
      }
    }
    track.extra = extra;
  }
  return track;
}

// Delete all the fixes from the specified device.
export function removeDeviceFromLiveTrack(track: LiveTrack, device: TrackerNames | UfoFleetNames): LiveTrack {
  const outTrack = LiveTrack.create();

  let dstIdx = 0;
  for (let srcIdx = 0; srcIdx < track.timeSec.length; srcIdx++) {
    const flags = track.flags[srcIdx];
    if (getTrackerName(flags) != device) {
      copyFix(track, srcIdx, outTrack, dstIdx++);
    }
  }

  return outTrack;
}

// Some points should never be removed:
// - The first and last point of a track - unless an UFO,
// - Emergency,
// - Points with messages
//
// `start` and `end` indexes could be passed to operate on a portion of the track only.
export function IsSimplifiableFix(track: LiveTrack, index: number, start = 0, end = track.timeSec.length - 1): boolean {
  const ufo = isUfo(track.flags[index]);
  if ((!ufo && index == start) || index == end) {
    return false;
  }
  const flags = track.flags[index];
  if (isEmergencyFix(flags)) {
    return false;
  }
  if (track.extra[index]?.message) {
    return false;
  }
  return true;
}

// Removes simplifiable points that are less than `intervalSec` apart.
// Notes:
// - Points from startSec inclusive are simplified.
// - The track is simplified in place.
export function simplifyLiveTrack(
  track: LiveTrack,
  intervalSec: number,
  time?: { fromSec?: number; toSec?: number },
): void {
  if (track.timeSec.length == 0) {
    return;
  }

  let startIndex = 0;
  if (time?.fromSec != undefined) {
    const indexes = findIndexes(track.timeSec, time.fromSec);
    if (indexes.afterAll) {
      return;
    }
    startIndex = Math.max(startIndex, indexes.beforeIndex);
  }
  let simplifyUntilIndex = track.timeSec.length;
  if (time?.toSec != undefined) {
    const indexes = findIndexes(track.timeSec, time.toSec);
    if (indexes.beforeAll) {
      return;
    }
    simplifyUntilIndex = Math.min(simplifyUntilIndex, indexes.beforeIndex);
  }
  let dstIndex = startIndex;
  let previousTimeSec = track.timeSec[startIndex] - 2 * intervalSec;
  for (let index = startIndex; index < track.timeSec.length; index++) {
    const timeSec = track.timeSec[index];
    if (index <= simplifyUntilIndex && IsSimplifiableFix(track, index) && timeSec - previousTimeSec < intervalSec) {
      delete track.extra[index];
      continue;
    }
    // Nothing to do if dstIndex == index.
    if (index > dstIndex) {
      copyFix(track, index, track, dstIndex);
      delete track.extra[index];
    }
    dstIndex++;
    previousTimeSec = timeSec;
  }
  // Remove excess points.
  track.lat.splice(dstIndex);
  track.lon.splice(dstIndex);
  track.alt.splice(dstIndex);
  track.timeSec.splice(dstIndex);
  track.flags.splice(dstIndex);
}

// Copies a fix from a track to an other.
function copyFix(fromTrack: LiveTrack, fromIndex: number, toTrack: LiveTrack, toIndex: number): void {
  toTrack.lat[toIndex] = fromTrack.lat[fromIndex];
  toTrack.lon[toIndex] = fromTrack.lon[fromIndex];
  toTrack.alt[toIndex] = fromTrack.alt[fromIndex];
  toTrack.timeSec[toIndex] = fromTrack.timeSec[fromIndex];
  toTrack.flags[toIndex] = fromTrack.flags[fromIndex];
  if (fromIndex in fromTrack.extra) {
    toTrack.extra[toIndex] = fromTrack.extra[fromIndex];
  }
}

// Merges two tracks.
// Keep messages, emergency and low battery.
export function mergeLiveTracks(track1: LiveTrack, track2: LiveTrack): LiveTrack {
  const toTrack = LiveTrack.create({ name: track1.name ?? track2.name, id: track1.id ?? track2.id });

  let index1 = 0;
  let index2 = 0;
  const len1 = track1.timeSec.length;
  const len2 = track2.timeSec.length;

  // eslint-disable-next-line no-constant-condition
  for (let toIndex = 0; true; toIndex++) {
    // Copy the rest of track2 when track 1 is done.
    if (index1 == len1) {
      for (; index2 < len2; index2++, toIndex++) {
        copyFix(track2, index2, toTrack, toIndex);
      }
      break;
    }
    // Copy the rest of track1 when track2 is done.
    if (index2 == len2) {
      for (; index1 < len1; index1++, toIndex++) {
        copyFix(track1, index1, toTrack, toIndex);
      }
      break;
    }
    // Copy whichever comes first or track1.
    const time1 = track1.timeSec[index1];
    const time2 = track2.timeSec[index2];
    if (time1 <= time2) {
      copyFix(track1, index1, toTrack, toIndex);
      index1++;
    } else {
      copyFix(track2, index2, toTrack, toIndex);
      index2++;
    }
    // Merge track2 if both fixes have the same time.
    if (time1 == time2) {
      const flags1 = toTrack.flags[toIndex];
      const flags2 = track2.flags[index2];
      let valid = isValidFix(flags1);
      let device = getTrackerName(flags1);
      // Try to find a valid source for coordinates.
      if (!valid && isValidFix(flags2)) {
        valid = true;
        device = getTrackerName(flags2);
        toTrack.lat[toIndex] = track2.lat[index2];
        toTrack.lon[toIndex] = track2.lon[index2];
        toTrack.alt[toIndex] = track2.alt[index2];
      }
      // Merge extras field by field.
      if (index2 in track2.extra) {
        const extra2 = track2.extra[index2];
        if (toIndex in toTrack.extra) {
          const toExtra = toTrack.extra[toIndex];
          toExtra.speed = toExtra.speed ?? extra2.speed;
          toExtra.message = toExtra.message ?? extra2.message;
          toExtra.gndAlt = toExtra.gndAlt ?? extra2.gndAlt;
        } else {
          toTrack.extra[toIndex] = extra2;
        }
      }
      // Merge flags.
      toTrack.flags[toIndex] = getTrackerFlags({
        valid,
        emergency: isEmergencyFix(flags1) || isEmergencyFix(flags2),
        lowBat: isLowBatFix(flags1) || isLowBatFix(flags2),
        device,
      });
      index2++;
    }
  }

  return toTrack;
}

// The name and id are required to send over the wire.
export function differentialEncodeLiveTrack(
  track: LiveTrack,
  id: number | string,
  name?: string,
): LiveDifferentialTrack {
  const lon = diffEncodeArray32bit(track.lon, 1e5);
  const lat = diffEncodeArray32bit(track.lat, 1e5);
  const timeSec = diffEncodeArray32bit(track.timeSec, 1, false);
  const alt = diffEncodeArray32bit(track.alt);

  const diffTrack = { ...track, lat, lon, timeSec, alt, name: track.name ?? name ?? '' };
  if (typeof id === 'string') {
    diffTrack.idStr = id;
  } else {
    diffTrack.id = id;
  }
  return diffTrack;
}

// id and name are populated from the differential track.
export function differentialDecodeLiveTrack(diffTrack: LiveDifferentialTrack): LiveTrack {
  const lon = diffDecodeArray(diffTrack.lon, 1e5);
  const lat = diffDecodeArray(diffTrack.lat, 1e5);
  const timeSec = diffDecodeArray(diffTrack.timeSec);
  const alt = diffDecodeArray(diffTrack.alt);

  return { ...diffTrack, lat, lon, timeSec, alt };
}
