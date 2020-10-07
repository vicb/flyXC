import express, { Request, Response, Router } from 'express';
import { UploadedFile } from 'express-fileupload';
import Pbf from 'pbf';

import {
  key_symbol,
  retrieveMetaTrackGroupByUrl,
  retrieveMetaTrackGroupsByIds,
  TrackEntity,
} from '../../../common/datastore';
import { diffDecodeAirspaces, ProtoMetaTrackGroup } from '../../../common/track';
import * as protos from '../../../common/track_proto';
import { getTracksMostRecentFirst, parse, parseFromUrl } from '../parser/parser';

export function getTrackRouter(): Router {
  const router = express.Router();

  // Retrieves tracks by url.
  router.get('/_download', async (req: Request, res: Response) => {
    const urls = [].concat(req.query.track as any);
    const trackGroups: ProtoMetaTrackGroup[] = await Promise.all(urls.map(parseFromUrl));
    sendTracks(res, trackGroups);
  });

  // Retrieves tracks by datastore ids.
  router.get('/_history', async (req: Request, res: Response) => {
    const ids = [].concat(req.query.id as any);
    const trackGroups: ProtoMetaTrackGroup[] = await retrieveMetaTrackGroupsByIds(ids);
    sendTracks(res, trackGroups);
  });

  // Retrieves the list of tracks.
  // The `tracks` query parameter set the number of tracks to retrieve.
  router.get('/_archives', async (req: Request, res: Response) => {
    const tracks: TrackEntity[] = await getTracksMostRecentFirst((req.query.tracks as any) || 10);

    res.json(
      tracks.map((track) => ({
        id: track[key_symbol].id,
        city: track.city,
        country: track.country,
        path: track.path,
        created: track.created,
      })),
    );
  });

  // Upload tracks to the database.
  router.post('/_upload', async (req: Request, res: Response) => {
    if (req.files?.track) {
      const fileObjects: UploadedFile[] = [].concat(req.files.track as any);
      const files: string[] = fileObjects.map((file) => file.data.toString());
      const tracks: ProtoMetaTrackGroup[] = await Promise.all(files.map((file) => parse(file)));
      sendTracks(res, tracks);
      return;
    }
    res.sendStatus(400);
  });

  // Retrieves track metadata by datastore ids.
  router.get('/_metadata', async (req: Request, res: Response) => {
    if (req.query.ids == null || typeof req.query.ids != 'string') {
      res.sendStatus(200);
      return;
    }
    const ids = req.query.ids.split(',');
    const trackGroups: Array<ProtoMetaTrackGroup> = await retrieveMetaTrackGroupsByIds(ids);
    const processedGroups: ProtoMetaTrackGroup[] = [];
    trackGroups.forEach((group) => {
      if (group != null && group.num_postprocess > 0) {
        // Delete the tracks and keep only metadata.
        group.track_group_bin = undefined;
        processedGroups.push(group);
      }
    });
    if (processedGroups.length > 0) {
      sendTracks(res, processedGroups);
    } else {
      res.sendStatus(200);
    }
  });

  // Returns the airspaces info for the first track in the group as JSON.
  // Returns 404 if the info are not available (/not ready yet).
  router.get('/_airspaces', async (req: Request, res: Response) => {
    res.set('Access-Control-Allow-Origin', '*');
    const url = req.query.track;
    if (typeof url === 'string') {
      const metaGroup = await retrieveMetaTrackGroupByUrl(url);
      if (metaGroup?.airspaces_group_bin) {
        const aspGroup = (protos.AirspacesGroup as any).read(new Pbf(metaGroup.airspaces_group_bin));
        if (aspGroup?.airspaces) {
          const airspaces = diffDecodeAirspaces(aspGroup.airspaces[0]);
          res.json(airspaces);
          return;
        }
      }
    }
    res.sendStatus(404);
  });

  return router;
}

// Sends the tracks as an encoded protocol buffer.
function sendTracks(res: Response, metaGroups: ProtoMetaTrackGroup[]): void {
  if (metaGroups.length == 0) {
    res.sendStatus(400);
    return;
  }
  const metaGroupsBin = metaGroups.map((group) => {
    const pbf = new Pbf();
    (protos.MetaTrackGroup as any).write(group, pbf);
    return pbf.finish();
  });
  const pbf = new Pbf();
  (protos.MetaTracks as any).write({ meta_track_groups_bin: metaGroupsBin }, pbf);
  res.set('Content-Type', 'application/x-protobuf');
  res.send(Buffer.from(pbf.finish()));
}
