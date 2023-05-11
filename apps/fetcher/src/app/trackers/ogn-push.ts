import { AprsPosition, findIndexes, generateAprsPosition, getFixSpeed, getTrackerName, protos } from '@flyxc/common';
import { getRhumbLineBearing } from 'geolib';
import { OgnClient } from './ogn-client';

// Don't push obsolete fixes.
const RECENT_FIX_AGE_SEC = 10 * 60;
// Search for OGN fixes for:
const OGN_WINDOWS_SEC = 15 * 60;

export class OgnPusher {
  protected lastPushSecByDsId = new Map<number, number>();

  constructor(protected ognClient: OgnClient, protected state: protos.FetcherState) {}

  // Set the devices to push.
  registerDsIds(dsIds: Set<number>) {
    // Add devices to the maps.
    for (const dsId of dsIds) {
      if (!this.lastPushSecByDsId.has(dsId)) {
        this.lastPushSecByDsId.set(dsId, 0);
      }
    }
    // Remove untracked devices.
    for (const dsId of this.lastPushSecByDsId.keys()) {
      if (!dsIds.has(dsId)) {
        this.lastPushSecByDsId.delete(dsId);
      }
    }
  }

  push() {
    for (const [dsId, lastPushSec] of this.lastPushSecByDsId.entries()) {
      const track = this.state.pilots[dsId].track;
      if (track.timeSec.length == 0) {
        // No known position.
        continue;
      }
      const lastFixSec = track.timeSec.at(-1);
      if (lastPushSec >= lastFixSec) {
        // The last available fix was already pushed.
        continue;
      }
      const nowSec = Math.round(Date.now() / 1000);
      if (lastFixSec < nowSec - RECENT_FIX_AGE_SEC) {
        // No recent fix to push.
        continue;
      }
      let hasOgn = false;
      const { beforeIndex } = findIndexes(track.timeSec, nowSec - OGN_WINDOWS_SEC);
      for (let i = beforeIndex; i < track.timeSec.length; i++) {
        if (getTrackerName(track.flags[i]) == 'ogn') {
          hasOgn = true;
          break;
        }
      }
      if (hasOgn) {
        // Skip pushing if there is a recent OGN position.
        continue;
      }
      const ognId = this.state.pilots[dsId].ogn.account;
      // glidertracker.org displays faded icons for course = 0.
      let course = 1;
      if (track.timeSec.length >= 2) {
        course = getRhumbLineBearing(
          { lat: track.lat.at(-2), lon: track.lon.at(-2) },
          { lat: track.lat.at(-1), lon: track.lon.at(-1) },
        );
      }
      const position: AprsPosition = {
        lat: track.lat.at(-1),
        lon: track.lon.at(-1),
        timeSec: lastFixSec,
        alt: track.alt.at(-1),
        speed: getFixSpeed(track, track.timeSec.length - 1),
        course,
      };
      this.ognClient.write(generateAprsPosition(position, ognId));
      this.lastPushSecByDsId.set(dsId, lastFixSec);
    }
  }
}
