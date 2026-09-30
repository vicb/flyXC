import { writeFileSync } from 'node:fs';

import type { RuntimeTrack } from '@flyxc/common';
import { createTrackId, protos, protoToRuntimeTrack, round } from '@flyxc/common';
import { getDatastore, retrieveTrackById } from '@flyxc/common-node';

/**
 * Formats a timestamp in seconds to UTC time string (hh:mm:ss).
 *
 * @param timestampSec - Epoch time in seconds.
 * @returns Time string in hh:mm:ss UTC.
 */
export function formatUtcTime(timestampSec: number): string {
  const date = new Date(timestampSec * 1000);
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

/**
 * Creates default file name in the format: <pilot name>-YYYYMMDD.csv
 *
 * @param pilot - Pilot name (the `name` property of the runtime track).
 * @param timestampSec - Epoch time in seconds of the flight start.
 * @param fallbackDate - Fallback date if timestamp is missing.
 * @returns Generated file name.
 */
export function createDefaultFileName(pilot?: string, timestampSec?: number, fallbackDate?: Date): string {
  const sanitizedPilot = (pilot?.trim() || 'pilot').replace(/[/\\?%*:|"<>]/g, '_');
  const date = timestampSec != null && timestampSec > 0 ? new Date(timestampSec * 1000) : fallbackDate ?? new Date();
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${sanitizedPilot}-${yyyy}${mm}${dd}.csv`;
}

/**
 * Decodes a TrackGroup binary buffer into RuntimeTracks and converts all positions into CSV format.
 *
 * Header:
 * latitude,longitude,altitude,time,timestamp
 *
 * @param trackGroupBin - Raw binary TrackGroup protobuf buffer.
 * @param trackId - Track entity id.
 * @param fallbackDate - Fallback date for default file name generation.
 * @returns Formatted CSV string, default file name, and number of positions.
 */
export function flightToCsv(
  trackGroupBin: Uint8Array | Buffer,
  trackId: number | string = 0,
  fallbackDate?: Date,
): { csv: string; defaultFileName: string; numPositions: number } {
  const trackGroup = protos.TrackGroup.fromBinary(new Uint8Array(trackGroupBin));
  const lines: string[] = ['latitude,longitude,altitude,time,timestamp'];
  let defaultFileName = createDefaultFileName(undefined, undefined, fallbackDate);
  let numPositions = 0;

  const runtimeTracks: RuntimeTrack[] = trackGroup.tracks.map((protoTrack, i) =>
    protoToRuntimeTrack(createTrackId(Number(trackId), i), protoTrack, false),
  );

  if (runtimeTracks.length > 0) {
    const firstTrack = runtimeTracks[0];
    defaultFileName = createDefaultFileName(firstTrack.name, firstTrack.minTimeSec, fallbackDate);
  }

  for (const track of runtimeTracks) {
    const numPoints = track.lat.length;

    for (let i = 0; i < numPoints; i++) {
      const lat = round(track.lat[i], 6);
      const lon = round(track.lon[i], 6);
      const alt = Math.round(track.alt[i]);
      const timeSec = Math.round(track.timeSec[i]);
      const timeUtc = formatUtcTime(timeSec);

      lines.push(`${lat},${lon},${alt},${timeUtc},${timeSec}`);
      numPositions++;
    }
  }

  return {
    csv: lines.join('\n'),
    defaultFileName,
    numPositions,
  };
}

/**
 * Retrieves a Track entity from Datastore by ID, decodes it, and outputs CSV.
 *
 * If no output path is specified, saves to `<pilot name>-YYYYMMDD.csv` where pilot name
 * is the `name` property of the runtime track.
 *
 * @param trackId - Datastore Track entity ID.
 * @param outputPath - Optional path to write CSV output to, or '-' for stdout.
 * @returns The CSV content and saved file path.
 */
export async function dumpTrack(
  trackId: string | number,
  outputPath?: string,
): Promise<{ csv: string; filePath: string }> {
  const datastore = getDatastore();
  const trackEntity = await retrieveTrackById(datastore, trackId);

  if (!trackEntity) {
    throw new Error(`Track ${trackId} not found in Datastore`);
  }

  if (!trackEntity.track_group) {
    throw new Error(`Track ${trackId} does not have track_group data`);
  }

  const { csv, defaultFileName, numPositions } = flightToCsv(trackEntity.track_group, trackId, trackEntity.created);

  if (outputPath === '-') {
    console.log(csv);
    return { csv, filePath: '-' };
  }

  const targetFile = outputPath ?? defaultFileName;
  writeFileSync(targetFile, csv, 'utf-8');
  console.log(`Saved ${numPositions} positions to ${targetFile}`);

  return { csv, filePath: targetFile };
}

if (process.env.NODE_ENV !== 'test') {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
    console.error('Usage: node dump_track.js <track_id...> [output_file]');
    console.error('If output_file is omitted, writes to <pilot name>-YYYYMMDD.csv (use "-" for stdout)');
    process.exit(args.length === 0 ? 1 : 0);
  }

  const ids: string[] = [];
  let outputPath: string | undefined;

  for (const arg of args) {
    if (arg.includes('id=')) {
      const parsedIds = [...arg.matchAll(/(?:^|[?&])id=(\d+)/g)].map((m) => m[1]);
      if (parsedIds.length > 0) {
        ids.push(...parsedIds);
        continue;
      }
    }
    if (/^\d+$/.test(arg)) {
      ids.push(arg);
    } else {
      outputPath = arg;
    }
  }

  (async () => {
    for (const trackId of ids) {
      await dumpTrack(trackId, ids.length === 1 ? outputPath : undefined);
    }
  })().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
