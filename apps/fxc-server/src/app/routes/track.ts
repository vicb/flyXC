import { diffDecodeAirspaces, protos } from '@flyxc/common';
import { retrieveMetaTrackGroupByUrl, retrieveMetaTrackGroupsByIds } from '@flyxc/common-node';
import { Datastore } from '@google-cloud/datastore';
import { Request, Response, Router } from 'express';
import { UploadedFile } from 'express-fileupload';

import { parse, parseFromUrl, parseRoute } from '../parser/parser';

export function getTrackRouter(datastore: Datastore): Router {
  const router = Router();

  // Retrieves tracks by url.
  router.get('/byurl.pbf', async (req: Request, res: Response) => {
    const urls = [].concat(req.query.track as any);
    const trackGroups: protos.MetaTrackGroup[] = await Promise.all(urls.map((url) => parseFromUrl(datastore, url)));
    sendTracks(res, trackGroups);
  });

  // Retrieves tracks by datastore ids.
  router.get('/byid.pbf', async (req: Request, res: Response) => {
    const ids = [].concat(req.query.id as any);
    const trackGroups: protos.MetaTrackGroup[] = await retrieveMetaTrackGroupsByIds(datastore, ids);
    sendTracks(res, trackGroups);
  });

  // Upload tracks to the database.
  router.post('/upload.pbf', async (req: Request, res: Response) => {
    if (req.files?.track) {
      // Parse files as track.
      const fileObjects: UploadedFile[] = [].concat(req.files.track as any);
      const files: string[] = fileObjects.map((file) => file.data.toString());
      const tracks: protos.MetaTrackGroup[] = await Promise.all(files.map((file) => parse(datastore, file)));

      // Parses files as route.
      let route;
      for (const file of files) {
        route = parseRoute(file);
        if (route != null) {
          break;
        }
      }

      sendTracks(res, tracks, route);
      return;
    }
    res.sendStatus(400);
  });

  // Retrieves track metadata by datastore ids.
  router.get('/metadata.pbf', async (req: Request, res: Response) => {
    res.set('Cache-Control', 'no-store');
    if (req.query.ids == null || typeof req.query.ids != 'string') {
      res.sendStatus(204);
      return;
    }
    const ids = req.query.ids.split(',');
    const trackGroups: protos.MetaTrackGroup[] = await retrieveMetaTrackGroupsByIds(datastore, ids);
    const processedGroups: protos.MetaTrackGroup[] = [];
    trackGroups.forEach((group) => {
      if (group != null && group.numPostprocess > 0) {
        // Delete the tracks and keep only metadata.
        group.trackGroupBin = undefined;
        processedGroups.push(group);
      }
    });
    if (processedGroups.length > 0) {
      sendTracks(res, processedGroups);
    } else {
      res.sendStatus(204);
    }
  });

  // Returns the airspaces info for the first track in the group as JSON.
  // Returns 404 if the info are not available (/not ready yet).
  router.get('/airspaces.json', async (req: Request, res: Response) => {
    res.set('Access-Control-Allow-Origin', '*');
    const url = req.query.track;
    if (typeof url === 'string') {
      const metaGroup = await retrieveMetaTrackGroupByUrl(datastore, url);
      if (metaGroup?.airspacesGroupBin) {
        const aspGroup = protos.AirspacesGroup.fromBinary(new Uint8Array(metaGroup.airspacesGroupBin));
        if (aspGroup?.airspaces) {
          const airspaces = diffDecodeAirspaces(aspGroup.airspaces[0]);
          return res.json(airspaces);
        }
      }
    }
    return res.sendStatus(404);
  });

  return router;
}

// Sends the tracks as an encoded protocol buffer.
function sendTracks(res: Response, metaGroups: protos.MetaTrackGroup[], route?: protos.Route | null): void {
  res.set('Content-Type', 'application/x-protobuf');
  res.send(
    Buffer.from(protos.MetaTrackGroupsAndRoute.toBinary({ metaTrackGroups: metaGroups, route: route ?? undefined })),
  );
}
