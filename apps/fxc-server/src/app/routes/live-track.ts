import crypto from 'node:crypto';
import * as zlib from 'node:zlib';

import csurf from '@dr.pogodin/csurf';
import type { AccountModel, LiveTrackEntity } from '@flyxc/common';
import { AccountFormModel, Keys, LiveDataRetentionSec, protos } from '@flyxc/common';
import type { BufferRedisClient, RedisClient } from '@flyxc/common-node';
import {
  FlyMeValidator,
  getBufferRedisClient,
  InreachValidator,
  LIVE_TRACK_TABLE,
  retrieveLiveTrackByGoogleId,
  SkylinesValidator,
  updateLiveTrackEntityFromModel,
} from '@flyxc/common-node';
import { Datastore } from '@google-cloud/datastore';
import type { Request, Response } from 'express';
import { Router } from 'express';
import { NoDomBinder } from 'vaadin-nodom';

import { getUserInfo, isLoggedIn, logout } from './session';

// Store the token in the session.
const csrfProtection = csurf();

/**
 * Checks if the buffer starts with the standard Gzip magic bytes (0x1f, 0x8b).
 *
 * @param buffer - The buffer or Uint8Array to test.
 * @returns `true` if the buffer has a Gzip magic header, `false` otherwise.
 */
export function isGzip(buffer: Buffer | Uint8Array | null | undefined): boolean {
  return buffer != null && buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b;
}

/**
 * Decompresses a buffer if it is gzip-compressed; otherwise returns it as-is.
 *
 * @param buffer - The raw or compressed buffer from Redis.
 * @returns The uncompressed buffer, or `null` if the input was null.
 */
export function ensureDecompressed(buffer: Buffer | null): Buffer | null {
  if (!buffer) {
    return null;
  }
  return isGzip(buffer) ? zlib.gunzipSync(buffer) : buffer;
}

/**
 * Resolves the appropriate Redis key for live tracks based on the client's last
 * update timestamp delta and requested history duration (in minutes).
 *
 * @param lastUpdateSec - Timestamp in seconds of the client's last update.
 * @param fetchMinutes - Requested duration of track history in minutes.
 * @param nowSec - Current timestamp in seconds (defaults to current time).
 * @returns The matching Redis key for incremental or full track data.
 */
export function resolveLiveTrackKey(
  lastUpdateSec: number,
  fetchMinutes: number,
  nowSec = Math.round(Date.now() / 1000),
): Keys {
  const deltaSec = nowSec - lastUpdateSec;

  // Pick the incremental proto if the last request was recent.
  if (deltaSec < LiveDataRetentionSec.IncrementalShort) {
    return Keys.fetcherShortIncrementalProto;
  }
  if (deltaSec < LiveDataRetentionSec.IncrementalLong) {
    return Keys.fetcherLongIncrementalProto;
  }

  // Otherwise, return full tracks for the requested history range.
  switch (fetchMinutes) {
    case 24 * 60:
      return Keys.fetcherFullProtoH24;
    case 48 * 60:
      return Keys.fetcherFullProtoH48;
    default:
      return Keys.fetcherFullProtoH12;
  }
}

/**
 * Sends a protobuf buffer to the client, handling Gzip transparently:
 * - If the buffer from Redis is gzipped and the client accepts gzip, sends with `Content-Encoding: gzip` (no server CPU decompression).
 * - If the buffer from Redis is gzipped and the client does not accept gzip, decompresses on-the-fly.
 * - If the buffer from Redis is uncompressed (legacy format during migration), sends as raw protobuf.
 *
 * @param req - Express request object used to check accepted encodings.
 * @param res - Express response object.
 * @param buffer - The protobuf buffer (gzipped, raw, or null).
 */
export function sendProtobufResponse(req: Request, res: Response, buffer: Buffer | null): void {
  res.set('Content-Type', 'application/x-protobuf');

  if (!buffer) {
    res.send(Buffer.alloc(0));
    return;
  }

  if (isGzip(buffer)) {
    if (req.acceptsEncodings('gzip') === 'gzip') {
      res.set('Content-Encoding', 'gzip');
      res.send(buffer);
    } else {
      res.send(zlib.gunzipSync(buffer));
    }
  } else {
    res.send(buffer);
  }
}

/** In-memory cache TTL for live track protobuf buffers in milliseconds. */
export const LIVE_TRACK_CACHE_TTL_MS = 20 * 1000;

type CacheEntry = { data: Buffer | null; expiresAtMs: number } | { inFlight: Promise<Buffer | null> };

const protoCache = new Map<string, CacheEntry>();

/**
 * Retrieves a live track buffer from the in-memory cache or falls back to Redis.
 * Deduplicates concurrent in-flight requests for the same key.
 *
 * @param bufferRedis - Redis client configured for binary buffers.
 * @param key - Redis key to retrieve.
 * @param ttlMs - Cache TTL in milliseconds (defaults to 20s).
 * @param nowMs - Current timestamp in milliseconds (defaults to Date.now()).
 * @returns The protobuf buffer or null.
 */
export async function getCachedProto(
  bufferRedis: BufferRedisClient,
  key: string,
  ttlMs = LIVE_TRACK_CACHE_TTL_MS,
  nowMs = Date.now(),
): Promise<Buffer | null> {
  const cached = protoCache.get(key);
  if (cached) {
    if ('data' in cached && cached.expiresAtMs > nowMs) {
      return cached.data;
    }
    if ('inFlight' in cached) {
      return cached.inFlight;
    }
  }

  const inFlightPromise = (async () => {
    try {
      const data = (await bufferRedis.get(key)) as Buffer | null;
      protoCache.set(key, { data, expiresAtMs: nowMs + ttlMs });
      return data;
    } catch (err) {
      protoCache.delete(key);
      throw err;
    }
  })();

  protoCache.set(key, { inFlight: inFlightPromise });
  return inFlightPromise;
}

/**
 * Clears the in-memory live track buffer cache. Useful for testing.
 */
export function clearProtoCache(): void {
  protoCache.clear();
}

/**
 * Handles authorized partner token requests (e.g. FlyMe, Wing, Zipline).
 *
 * @param req - Express request object.
 * @param res - Express response object.
 * @param token - The partner authorization token.
 * @param bufferRedis - Redis client configured for binary buffers.
 */
export async function handlePartnerTokenRequest(
  req: Request,
  res: Response,
  token: string,
  bufferRedis: BufferRedisClient,
): Promise<void> {
  switch (token) {
    case SECRETS.FLYME_TOKEN: {
      const groupProto = await getCachedProto(bufferRedis, Keys.fetcherExportFlymeProto);
      if (req.header('accept') === 'application/json') {
        const uncompressed = ensureDecompressed(groupProto);
        const track = uncompressed
          ? protos.LiveDifferentialTrackGroup.fromBinary(uncompressed)
          : protos.LiveDifferentialTrackGroup.create();
        res.json(protos.LiveDifferentialTrackGroup.toJson(track));
      } else {
        sendProtobufResponse(req, res, groupProto);
      }
      break;
    }
    case SECRETS.WING_TOKEN:
    case SECRETS.ZIPLINE_TOKEN: {
      const liveGroupProto = await getCachedProto(bufferRedis, Keys.fetcherFullProtoH12);
      const uncompressed = ensureDecompressed(liveGroupProto);

      const liveGroup = uncompressed
        ? protos.LiveDifferentialTrackGroup.fromBinary(uncompressed)
        : protos.LiveDifferentialTrackGroup.create();

      const anonTracks: protos.LiveDifferentialTrack[] = liveGroup.tracks.map(
        ({ lat, lon, alt, timeSec, id, idStr }) => {
          // Anonymizes the track by hashing the id with a salt.
          const sha1 = crypto.createHash('sha1');
          sha1.update(String(idStr ?? id) + SECRETS.EXPORT_ID_SALT);

          return {
            idStr: sha1.digest('hex'),
            name: '',
            flags: [],
            extra: {},
            lat,
            lon,
            alt,
            timeSec,
          };
        },
      );
      const anonGroup: protos.LiveDifferentialTrackGroup = {
        tracks: anonTracks,
        incremental: false,
        remoteId: [],
      };

      if (req.header('accept') === 'application/json') {
        res.json(protos.LiveDifferentialTrackGroup.toJson(anonGroup));
      } else {
        res.set('Content-Type', 'application/x-protobuf');
        res.send(protos.LiveDifferentialTrackGroup.toBinary(anonGroup));
      }
      break;
    }
    default:
      res.sendStatus(400);
  }
}

/**
 * Creates and configures the Express router for live tracking endpoints.
 *
 * @param redis - Redis client instance.
 * @param datastore - Google Cloud Datastore client instance.
 * @returns Configured Express Router.
 */
export function getTrackerRouter(redis: RedisClient, datastore: Datastore): Router {
  const router = Router();
  const bufferRedis = getBufferRedisClient(redis);

  // Get the live tracks (in protobuf or JSON format).
  router.get('/tracks.pbf', async (req: Request, res: Response) => {
    res.set('Cache-Control', 'no-store');

    // 1. Handle partner token requests (e.g. FlyMe, Wing, Zipline).
    const token = req.header('token');
    if (token) {
      await handlePartnerTokenRequest(req, res, token, bufferRedis);
      return;
    }

    // 2. Handle public live track requests based on client time delta and history range.
    const lastUpdateSec = Number(req.query.s ?? 0);
    const fetchMin = Number(req.query.fm ?? 0);
    const key = resolveLiveTrackKey(lastUpdateSec, fetchMin);
    const protoBuffer = await getCachedProto(bufferRedis, key);
    sendProtobufResponse(req, res, protoBuffer);
  });

  // Get the account information.
  router.get('/account.json', csrfProtection, async (req: Request, res: Response) => {
    res.set('Cache-Control', 'no-store');
    if (!isLoggedIn(req)) {
      res.sendStatus(403);
      return;
    }

    try {
      const userInfo = getUserInfo(req);
      if (!userInfo) {
        res.sendStatus(500);
        return;
      }

      const { name, token } = userInfo;
      let account: AccountModel;
      const entity = await retrieveLiveTrackByGoogleId(datastore, token);

      if (!entity) {
        account = AccountFormModel.createEmptyValue();
        account.name = name;
      } else {
        account = AccountFormModel.createFromEntity(entity);
      }

      res.set('xsrf-token', (req as any).csrfToken());
      res.json(account);
    } catch (e) {
      res.sendStatus(400);
    }
  });

  // Updates the tracker information.
  router.post('/account.json', csrfProtection, async (req: Request, res: Response) => {
    if (!isLoggedIn(req)) {
      return res.sendStatus(403);
    }

    const userInfo = getUserInfo(req);
    if (!userInfo) {
      return res.sendStatus(500);
    }
    const { email, token } = userInfo;
    const entity = await retrieveLiveTrackByGoogleId(datastore, token);
    return createOrUpdateLiveTrack(datastore, entity, req, res, email, token, redis);
  });

  // Logout.
  router.post('/logout', async (req: Request, res: Response) => {
    await logout(req);
    return res.sendStatus(200);
  });

  return router;
}

/**
 * Creates or updates a LiveTrack entity from validated form POST data.
 *
 * @param datastore - Google Cloud Datastore client instance.
 * @param entity - Existing LiveTrack entity if available.
 * @param req - Express request object.
 * @param res - Express response object.
 * @param email - User email address.
 * @param googleId - User Google ID token.
 * @param redis - Redis client instance.
 * @returns JSON response indicating success or validation/server errors.
 */
export async function createOrUpdateLiveTrack(
  datastore: Datastore,
  entity: LiveTrackEntity | undefined,
  req: Request,
  res: Response,
  email: string,
  googleId: string,
  redis: RedisClient,
) {
  try {
    const account: AccountModel = req.body;
    const binder = new NoDomBinder(AccountFormModel);
    binder.read(account);

    // Server side validators.
    const model = binder.model;
    binder.for(model.flyme).addValidator(new FlyMeValidator(entity?.flyme, SECRETS.FLYME_TOKEN));
    binder.for(model.inreach).addValidator(new InreachValidator(entity?.inreach));
    binder.for(model.skylines).addValidator(new SkylinesValidator(entity?.skylines));

    // Sends error to the client.
    const validationErrorData = (await binder.validate()).map(({ property, message }) => ({
      parameterName: property,
      message,
    }));

    if (validationErrorData.length) {
      return res.json({
        error: `The form contains invalid values!`,
        validationErrorData,
      });
    }

    entity = updateLiveTrackEntityFromModel(entity, account, email, googleId);

    try {
      await datastore.save({
        key: entity[Datastore.KEY] ?? datastore.key([LIVE_TRACK_TABLE]),
        data: entity,
      });
      // Sends a command to the fetcher to sync from the DB.
      await redis.incr(Keys.fetcherCmdSyncIncCount);
      return res.json({ error: false });
    } catch (e) {
      console.error(`Error saving the account ${email}`);
      return res.json({ error: `An error has occurred, please try again later.` });
    }
  } catch (e) {
    console.error(`Error updating an account: ${e}`);
    return res.sendStatus(400);
  }
}
