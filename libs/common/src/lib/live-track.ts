import type { LiveDifferentialTrack, LiveExtra } from '../protos/live-track';
import { LiveTrack } from '../protos/live-track';
import { diffDecodeArray, diffEncodeArray32bit, findIndexes } from './math';

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
  meshbir: 'Bircom',
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
  const len = track.timeSec.length;
  if (len === 0) {
    return LiveTrack.create({ name: track.name, id: track.id, idStr: track.idStr });
  }

  // Fast boundary checks in O(1):
  // 1. If timeSec is before or at the first fix, no fixes are strictly before timeSec.
  //    Return a new track with sliced arrays and cloned extra entries.
  if (timeSec <= track.timeSec[0]) {
    const extra: { [key: string]: LiveExtra } = {};
    for (const index in track.extra) {
      extra[index] = { ...track.extra[index] };
    }
    return {
      ...track,
      timeSec: track.timeSec.slice(),
      lat: track.lat.slice(),
      lon: track.lon.slice(),
      alt: track.alt.slice(),
      flags: track.flags.slice(),
      extra,
    };
  }

  // 2. If timeSec is strictly after the last fix, all fixes are dropped.
  if (timeSec > track.timeSec[len - 1]) {
    return LiveTrack.create({ name: track.name, id: track.id, idStr: track.idStr });
  }

  // Find the first index whose time is >= timeSec.
  const indexes = findIndexes(track.timeSec, timeSec);
  const numToDelete = indexes.afterIndex;

  const extra: { [key: string]: LiveExtra } = {};
  for (const index in track.extra) {
    const newIndex = Number(index) - numToDelete;
    if (newIndex >= 0) {
      extra[newIndex] = { ...track.extra[index] };
    }
  }

  return {
    ...track,
    timeSec: track.timeSec.slice(numToDelete),
    lat: track.lat.slice(numToDelete),
    lon: track.lon.slice(numToDelete),
    alt: track.alt.slice(numToDelete),
    flags: track.flags.slice(numToDelete),
    extra,
  };
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

/**
 * Finds the largest index where ascendingList[i] <= value using binary search.
 *
 * @param ascendingList - List of numbers in ascending order.
 * @param value - Search value.
 * @returns The largest index where ascendingList[i] <= value, or -1 if value is less than the first element.
 */
export function findLastIndexLessOrEqual(ascendingList: number[], value: number): number {
  const len = ascendingList.length;
  if (len === 0 || value < ascendingList[0]) {
    return -1;
  }
  if (value >= ascendingList[len - 1]) {
    return len - 1;
  }
  let low = 0;
  let high = len - 1;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (ascendingList[mid] <= value) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  return low;
}

/**
 * Checks whether a fix at the given index can be simplified (removed).
 *
 * Some points should never be removed:
 * - The first and last point of a track - unless a UFO,
 * - Emergency,
 * - Points with messages.
 *
 * `start` and `end` indexes could be passed to operate on a portion of the track only.
 *
 * @param track - The live track.
 * @param index - Index of the fix to check.
 * @param start - Starting boundary index (default 0).
 * @param end - Ending boundary index (default last fix index).
 * @returns True if the fix can be simplified.
 */
export function IsSimplifiableFix(track: LiveTrack, index: number, start = 0, end = track.timeSec.length - 1): boolean {
  const flags = track.flags[index];
  if ((!isUfo(flags) && index === start) || index === end) {
    return false;
  }
  if (isEmergencyFix(flags)) {
    return false;
  }
  if (track.extra[index]?.message) {
    return false;
  }
  return true;
}

/**
 * Removes simplifiable points that are less than `intervalSec` apart.
 *
 * Notes:
 * - Points from startSec inclusive are simplified.
 * - The track is simplified in place.
 *
 * Performance notes:
 * This function is invoked in the hot path across thousands of pilot tracks every minute (e.g. 4 times per
 * pilot per tick in the fetcher). It is optimized to:
 * 1. Avoid object allocations in boundary lookups (factored findLastIndexLessOrEqual instead of findIndexes()).
 * 2. Avoid array allocations and mutations when no points are removed (guarded .splice()).
 * 3. Prevent V8 object de-optimization by checking if extra is populated before accessing/deleting keys.
 *
 * @param track - The live track to simplify in place.
 * @param intervalSec - Minimum interval between kept fixes in seconds.
 * @param time - Optional time range boundaries ({ fromSec, toSec }).
 */
export function simplifyLiveTrack(
  track: LiveTrack,
  intervalSec: number,
  time?: { fromSec?: number; toSec?: number },
): void {
  const len = track.timeSec.length;
  // Fast path: tracks with 0 or 1 fix can never be simplified (boundary fixes are always preserved).
  if (len <= 1) {
    return;
  }

  const timeSecs = track.timeSec;
  const lastTime = timeSecs[len - 1];

  let startIndex = 0;
  if (time?.fromSec != null) {
    const fromSec = time.fromSec;
    if (fromSec > lastTime) {
      return;
    }
    const idx = findLastIndexLessOrEqual(timeSecs, fromSec);
    startIndex = Math.max(0, idx);
  }

  let simplifyUntilIndex = len - 1;
  if (time?.toSec != null) {
    const idx = findLastIndexLessOrEqual(timeSecs, time.toSec);
    if (idx < 0) {
      return;
    }
    simplifyUntilIndex = idx;
  }

  // If the target interval is out of range or only targets the last point (which is never simplifiable), exit early.
  if (startIndex > simplifyUntilIndex || startIndex >= len - 1) {
    return;
  }

  // Check if extra contains any properties using a fast for..in loop without allocating an array via Object.keys().
  // Most tracks have an empty extra object ({}). Bypassing property accesses and repeated `delete` calls on empty
  // objects keeps V8 objects in fast shape mode rather than de-optimizing them into slow dictionary mode.
  let hasExtra = false;
  for (const _ in track.extra) {
    hasExtra = true;
    break;
  }

  let dstIndex = startIndex;
  let previousTimeSec = timeSecs[startIndex] - 2 * intervalSec;

  for (let index = startIndex; index < len; index++) {
    const timeSec = timeSecs[index];
    if (index <= simplifyUntilIndex && timeSec - previousTimeSec < intervalSec && IsSimplifiableFix(track, index)) {
      if (hasExtra && index in track.extra) {
        delete track.extra[index];
      }
      continue;
    }

    // Point is kept: copy forward if preceding points were removed (index > dstIndex).
    if (index > dstIndex) {
      copyFix(track, index, track, dstIndex);
      // Only touch extra if present to avoid dictionary mode degradation.
      if (hasExtra && index in track.extra) {
        delete track.extra[index];
      }
    }

    dstIndex++;
    previousTimeSec = timeSec;
  }

  // Only mutate/truncate arrays if points were actually removed.
  // In JavaScript, arr.splice(len) creates and returns a new empty array []. Avoiding splice when dstIndex === len
  // prevents tens of thousands of useless array allocations and GC passes per minute.
  if (dstIndex < len) {
    track.lat.splice(dstIndex);
    track.lon.splice(dstIndex);
    track.alt.splice(dstIndex);
    timeSecs.splice(dstIndex);
    track.flags.splice(dstIndex);
  }
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
