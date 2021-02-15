import deepcopy from 'ts-deepcopy';

import { LiveDifferentialTrack, LiveExtra, LiveTrack } from '../protos/live-track';
import { diffDecodeArray, diffEncodeArray, findIndexes } from './math';

// How long to retain live tracking positions.
export const LIVE_RETENTION_SEC = 24 * 3600;
// Minimum interval between points.
export const LIVE_MINIMAL_INTERVAL_SEC = 30;
// Refresh interval (how often one update is triggered)
export const LIVE_REFRESH_SEC = 2 * 60;
// Timeout for fetching - need time for completing the transaction.
export const LIVE_FETCH_TIMEOUT_SEC = LIVE_REFRESH_SEC - 30;

// How often to refresh InReach.
export const INREACH_REFRESH_INTERVAL_SEC = 3 * 60;
// How often to refresh Spot.
export const SPOT_REFRESH_INTERVAL_SEC = 3 * 60;

// Split segments if the gap is longer than.
export const GAP_FOR_SEGMENT_MIN = 60;

// Break tracks if gap is more than.
export const TRACK_GAP_MIN = 60;

// Incremental updates.
export const INCREMENTAL_UPDATE_SEC = 3600;
// Export to partners.
export const EXPORT_UPDATE_SEC = 5 * 60;

// ID for the tracking devices.
export const enum TrackerIds {
  Inreach = 1,
  Spot = 2,
  Skylines = 3,
  Flyme = 4,
}

// The property names should be in sync with LiveTrackEntity.
export const trackerPropNames: Readonly<Record<TrackerIds, string>> = {
  [TrackerIds.Inreach]: 'inreach',
  [TrackerIds.Spot]: 'spot',
  [TrackerIds.Skylines]: 'skylines',
  [TrackerIds.Flyme]: 'flyme',
};

// How to display the tracker name.
export const trackerDisplayNames: Readonly<Record<TrackerIds, string>> = {
  [TrackerIds.Inreach]: 'InReach',
  [TrackerIds.Spot]: 'Spot',
  [TrackerIds.Skylines]: 'Skylines',
  [TrackerIds.Flyme]: 'FlyMe',
};

export const enum LiveTrackFlag {
  // Reserve 5 bits for the device.
  DeviceTypeMask = (1 << 6) - 1,
  Valid = 1 << 6,
  Emergency = 1 << 7,
  LowBat = 1 << 8,
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

export function getFixDevice(flags: number): TrackerIds {
  return flags & LiveTrackFlag.DeviceTypeMask;
}

export function getFixMessage(track: LiveTrack, index: number): string | undefined {
  return track.extra[index]?.message;
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
  device: TrackerIds;
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
  if ((value.device & LiveTrackFlag.DeviceTypeMask) !== value.device) {
    throw new Error(`device out of range`);
  }
  flags |= value.device;
  return flags;
}

// Delete all the fixes strictly before timeSec from the track.
export function removeBeforeFromLiveTrack(track: LiveTrack, timeSec: number): LiveTrack {
  track = deepcopy(track);
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
  } else {
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
export function removeDeviceFromLiveTrack(track: LiveTrack, device: TrackerIds): LiveTrack {
  const outTrack = LiveTrack.create();

  let dstIdx = 0;
  for (let srcIdx = 0; srcIdx < track.timeSec.length; srcIdx++) {
    const flags = track.flags[srcIdx];
    if (getFixDevice(flags) != device) {
      copyFix(track, srcIdx, outTrack, dstIdx++);
    }
  }

  return outTrack;
}

// Some points should never be removed:
// - The first and last point of a track,
// - Emergency,
// - Points with messages
//
// `start` and `end` indexes could be passed to operate on a portion of the track only.
export function IsSimplifiableFix(track: LiveTrack, index: number, start = 0, end = track.timeSec.length - 1): boolean {
  if (index == start || index == end) {
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
// Note: Points from startSec inclusive are simplified.
export function simplifyLiveTrack(track: LiveTrack, intervalSec: number, startSec?: number): void {
  let startIndex = 0;
  if (startSec != undefined) {
    const indexes = findIndexes(track.timeSec, startSec);
    if (indexes.afterAll) {
      return;
    }
    startIndex = Math.max(0, indexes.beforeIndex);
  }
  let dstIndex = startIndex;
  let previousTime = track.timeSec[startIndex] - 2 * intervalSec;
  for (let index = startIndex; index < track.timeSec.length; index++) {
    const time = track.timeSec[index];
    if (IsSimplifiableFix(track, index) && time - previousTime < intervalSec) {
      delete track.extra[index];
      continue;
    }
    // Nothing to do if dstIndex == index.
    if (index > dstIndex) {
      copyFix(track, index, track, dstIndex);
      delete track.extra[index];
    }
    dstIndex++;
    previousTime = time;
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
      let device = getFixDevice(flags1);
      // Try to find a valid source for coordinates.
      if (!valid && isValidFix(flags2)) {
        valid = true;
        device = getFixDevice(flags2);
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
export function differentialEncodeLiveTrack(track: LiveTrack, id: number, name: string): LiveDifferentialTrack {
  const lon = diffEncodeArray(track.lon, 1e5);
  const lat = diffEncodeArray(track.lat, 1e5);
  const timeSec = diffEncodeArray(track.timeSec, 1, false);
  const alt = diffEncodeArray(track.alt);

  return { ...track, lat, lon, timeSec, alt, id, name };
}

// id and name are populated from the differential track.
export function differentialDecodeLiveTrack(track: LiveDifferentialTrack): LiveTrack {
  const lon = diffDecodeArray(track.lon, 1e5);
  const lat = diffDecodeArray(track.lat, 1e5);
  const timeSec = diffDecodeArray(track.timeSec);
  const alt = diffDecodeArray(track.alt);

  return { ...track, lat, lon, timeSec, alt, id: track.id, name: track.name };
}
