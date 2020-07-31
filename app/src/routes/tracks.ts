/* eslint-disable @typescript-eslint/no-var-requires */
const multer = require('@koa/multer');
/* eslint-enable @typescript-eslint/no-var-requires */

import Pbf from 'pbf';

import Router, { RouterContext } from '@koa/router';

import { key_symbol, retrieveMetaTrackGroupsByIds, TrackEntity } from '../../../common/datastore';
import { ProtoMetaTrackGroup } from '../../../common/track';
import * as protos from '../../../common/track_proto';
import { getTracksMostRecentFirst, parse, parseFromUrl } from '../parser/parser';

const upload = multer();

export function registerTrackRoutes(router: Router): void {
  // Retrieves tracks by url.
  router.get(
    '/_download',
    async (ctx: RouterContext): Promise<void> => {
      const urls = [].concat(ctx.query.track);
      const trackGroups: ProtoMetaTrackGroup[] = await Promise.all(urls.map(parseFromUrl));
      sendTracks(ctx, trackGroups);
    },
  );

  // Retrieves tracks by datastore ids.
  router.get(
    '/_history',
    async (ctx: RouterContext): Promise<void> => {
      const ids = [].concat(ctx.query.id);
      const trackGroups: ProtoMetaTrackGroup[] = await retrieveMetaTrackGroupsByIds(ids);
      sendTracks(ctx, trackGroups);
    },
  );

  // Retrieves the list of tracks.
  // The `tracks` query parameter set the number of tracks to retrieve.
  router.get(
    '/_archives',
    async (ctx: RouterContext): Promise<void> => {
      const tracks: TrackEntity[] = await getTracksMostRecentFirst(ctx.query.tracks || 10);

      ctx.body = JSON.stringify(
        tracks.map((track) => ({
          id: track[key_symbol].id,
          city: track.city,
          country: track.country,
          path: track.path,
          created: track.created,
        })),
      );
    },
  );

  // Upload tracks to the database.
  router.post(
    '/_upload',
    upload.array('track'),
    async (ctx: RouterContext): Promise<unknown> => {
      const request = ctx.request as any;
      const files: string[] = request.files.map((file: any) => file.buffer.toString());
      const tracks: ProtoMetaTrackGroup[] = await Promise.all(files.map((file) => parse(file)));
      sendTracks(ctx, tracks);
      return;
    },
  );

  // Retrieves track metadata by datastore ids.
  router.get(
    '/_metadata',
    async (ctx: RouterContext): Promise<void> => {
      if (ctx.query.ids == null) {
        ctx.status = 200;
      }
      const ids = ctx.query.ids.split(',');
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
        sendTracks(ctx, processedGroups);
      } else {
        ctx.body = '';
      }
    },
  );
}

// Sends the tracks as an encoded protocol buffer.
function sendTracks(ctx: RouterContext, metaGroups: ProtoMetaTrackGroup[]): void {
  if (metaGroups.length == 0) {
    ctx.throw(400);
  }
  const metaGroupsBin = metaGroups.map((group) => {
    const pbf = new Pbf();
    (protos.MetaTrackGroup as any).write(group, pbf);
    return pbf.finish();
  });
  const pbf = new Pbf();
  (protos.MetaTracks as any).write({ meta_track_groups_bin: metaGroupsBin }, pbf);
  ctx.set('Content-Type', 'application/x-protobuf');
  ctx.body = Buffer.from(pbf.finish());
}
