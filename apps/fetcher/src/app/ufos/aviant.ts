// https://www.aviant.no/

import { fetchResponse, formatReqError, SecretKeys, UfoFleetNames } from '@flyxc/common';
import { LivePoint, makeLiveTrack } from '../trackers/live-track';
import { UfoFleetFetcher, UfoFleetUpdates } from './ufo';

export class AviantFetcher extends UfoFleetFetcher {
  protected getFleetName(): UfoFleetNames {
    return 'aviant';
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected async fetch(updates: UfoFleetUpdates, timeoutSec: number): Promise<void> {
    try {
      const response = await fetchResponse(SecretKeys.AVIANT_URL, { retry: 3, timeoutS: 5 });
      if (response.ok) {
        const positions = await response.json();
        for (const position of positions) {
          const points = parse(position, this.getFleetName());
          if (points.length > 0) {
            const track = makeLiveTrack(points);
            track.name = position.call_sign;
            updates.deltas.set(position.serial_nr, track);
          }
        }
      } else {
        updates.errors.push(`HTTP status ${response.status}`);
      }
    } catch (e) {
      updates.errors.push(`Error ${formatReqError(e)}`);
    }
  }
}

export function parse(position: any, fleetName: UfoFleetNames): LivePoint[] {
  if (!position.in_air) {
    return [];
  }
  const { lat, lon, alt, timestamp, vel } = position;
  if (lat == null || lon == null || alt == null || timestamp == null || vel == null) {
    return [];
  }
  const point: LivePoint = {
    lat,
    lon,
    alt: Math.round(alt),
    timestamp: Date.parse(timestamp),
    name: fleetName,
    speed: Math.round(vel * 3.6),
  };
  return [point];
}
