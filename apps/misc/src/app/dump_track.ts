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
  const date =
    timestampSec != null && !Number.isNaN(timestampSec) ? new Date(timestampSec * 1000) : (fallbackDate ?? new Date());
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${sanitizedPilot}-${yyyy}${mm}${dd}.csv`;
}

/**
 * Decodes TrackGroup binary buffers into RuntimeTracks and converts all positions into CSV format.
 *
 * Header:
 * latitude,longitude,altitude,time,timestamp
 *
 * @param trackGroupBins - Raw binary TrackGroup protobuf buffer(s).
 * @param trackId - Track entity id(s).
 * @param fallbackDate - Fallback date for default file name generation.
 * @returns Formatted CSV string, default file name, and number of positions.
 */
export function flightToCsv(
  trackGroupBins: (Uint8Array | Buffer)[] | Uint8Array | Buffer,
  trackId: number | string | (number | string)[] = 0,
  fallbackDate?: Date,
): { csv: string; defaultFileName: string; numPositions: number } {
  const bins = Array.isArray(trackGroupBins) ? trackGroupBins : [trackGroupBins];
  const ids = Array.isArray(trackId) ? trackId : [trackId];
  const lines: string[] = ['latitude,longitude,altitude,time,timestamp'];
  let defaultFileName = createDefaultFileName(undefined, undefined, fallbackDate);
  let numPositions = 0;

  const runtimeTracks: RuntimeTrack[] = [];

  for (let groupIdx = 0; groupIdx < bins.length; groupIdx++) {
    const bin = bins[groupIdx];
    const baseId = ids[groupIdx] ?? ids[0] ?? groupIdx;
    const trackGroup = protos.TrackGroup.fromBinary(new Uint8Array(bin));

    for (let trackIdx = 0; trackIdx < trackGroup.tracks.length; trackIdx++) {
      runtimeTracks.push(
        protoToRuntimeTrack(createTrackId(Number(baseId), trackIdx), trackGroup.tracks[trackIdx], false),
      );
    }
  }

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
 * Retrieves Track entities from Datastore by ID(s), decodes them, and outputs a single aggregated CSV.
 *
 * If no output path is specified, saves to `<pilot name>-YYYYMMDD.csv` where pilot name
 * is the `name` property of the first runtime track.
 *
 * @param trackId - Datastore Track entity ID or array of IDs.
 * @param outputPath - Optional path to write CSV output to, or '-' for stdout.
 * @returns The CSV content and saved file path.
 */
export async function dumpTrack(
  trackId: string | number | (string | number)[],
  outputPath?: string,
): Promise<{ csv: string; filePath: string }> {
  const ids = Array.isArray(trackId) ? trackId : [trackId];
  if (ids.length === 0) {
    throw new Error('No track ID provided');
  }

  const datastore = getDatastore();
  const trackGroupBins: Buffer[] = [];
  let fallbackDate: Date | undefined;

  for (const id of ids) {
    const trackEntity = await retrieveTrackById(datastore, id);
    if (!trackEntity) {
      throw new Error(`Track ${id} not found in Datastore`);
    }
    if (!trackEntity.track_group) {
      throw new Error(`Track ${id} does not have track_group data`);
    }
    trackGroupBins.push(trackEntity.track_group);
    if (!fallbackDate && trackEntity.created) {
      fallbackDate = trackEntity.created;
    }
  }

  const { csv, defaultFileName, numPositions } = flightToCsv(trackGroupBins, ids, fallbackDate);

  if (outputPath === '-') {
    console.log(csv);
    return { csv, filePath: '-' };
  }

  const targetFile = outputPath ?? defaultFileName;
  writeFileSync(targetFile, csv, 'utf-8');
  console.log(`Saved ${numPositions} positions to ${targetFile}`);

  return { csv, filePath: targetFile };
}

/**
 * Parses command-line arguments to extract track IDs and optional output path.
 *
 * @param args - CLI arguments.
 * @returns Object with parsed IDs and optional outputPath.
 */
export function parseArgs(args: string[]): { ids: string[]; outputPath?: string } {
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

  return { ids, outputPath };
}

function printUsage(): void {
  console.error('Usage: node dump_track.js <track_id...> [output_file]');
  console.error('If output_file is omitted, writes to <pilot name>-YYYYMMDD.csv (use "-" for stdout)');
}

if (process.env.NODE_ENV !== 'test') {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
    printUsage();
    process.exit(args.length === 0 ? 1 : 0);
  }

  const { ids, outputPath } = parseArgs(args);

  if (ids.length === 0) {
    console.error('Error: No valid track ID provided.\n');
    printUsage();
    process.exit(1);
  }

  dumpTrack(ids, outputPath).catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
