import crypto from 'node:crypto';
import * as zlib from 'node:zlib';

import csurf from '@dr.pogodin/csurf';
import type { AccountModel, LiveTrackEntity } from '@flyxc/common';
import { AccountFormModel, Keys, LiveTrackDurationSec, protos } from '@flyxc/common';
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
 * Decompresses a gzipped protobuf buffer from Redis.
 *
 * @param buffer - Gzip-compressed buffer from Redis.
 * @returns Decompressed buffer, or `null` if the input was null.
 */
export function decompressProto(buffer: Buffer | null): Buffer | null {
  return buffer ? zlib.gunzipSync(buffer) : null;
}

/**
 * Resolves the appropriate Redis key for live tracks based on the requested
 * history duration or incremental window (in seconds).
 *
 * @param fetchSec - Requested duration in seconds.
 * @returns The matching Redis key for incremental or full track data.
 */
export function resolveLiveTrackKey(fetchSec: number): Keys {
  switch (fetchSec) {
    case LiveTrackDurationSec.M5:
      return Keys.fetcherIncrementalProtoM5;
    case LiveTrackDurationSec.M20:
      return Keys.fetcherIncrementalProtoM20;
    case LiveTrackDurationSec.H24:
      return Keys.fetcherFullProtoH24;
    case LiveTrackDurationSec.H48:
      return Keys.fetcherFullProtoH48;
    case LiveTrackDurationSec.H12:
    default:
      return Keys.fetcherFullProtoH12;
  }
}

/**
 * Sends a gzipped protobuf buffer to the client:
 * - If the client accepts gzip, sends with `Content-Encoding: gzip` directly (zero server CPU decompression).
 * - If the client does not accept gzip, decompresses on the fly.
 *
 * @param req - Express request object used to check accepted encodings.
 * @param res - Express response object.
 * @param buffer - The gzipped protobuf buffer (or null).
 */
export function sendProtobufResponse(req: Request, res: Response, buffer: Buffer | null): void {
  res.set('Content-Type', 'application/x-protobuf');

  if (!buffer) {
    res.send(Buffer.alloc(0));
    return;
  }

  if (req.acceptsEncodings('gzip') === 'gzip') {
    res.set('Content-Encoding', 'gzip');
    res.send(buffer);
  } else {
    res.send(zlib.gunzipSync(buffer));
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
): Promise<Response> {
  switch (token) {
    case SECRETS.FLYME_TOKEN:
    case SECRETS.WING_TOKEN:
    case SECRETS.ZIPLINE_TOKEN: {
      const liveGroupProtoGzip = await getCachedProto(bufferRedis, Keys.fetcherPartnersProtoM30);
      const liveGroupProto = decompressProto(liveGroupProtoGzip);

      const liveGroup = liveGroupProto
        ? protos.LiveDifferentialTrackGroup.fromBinary(liveGroupProto)
        : protos.LiveDifferentialTrackGroup.create();

      const idToSha = new Map<string, string>();

      const anonTracks: protos.LiveDifferentialTrack[] = liveGroup.tracks.map(
        ({ lat, lon, alt, gndAlt, timeSec, id, idStr }) => {
          return {
            idStr: anonymizeId(idStr ?? id, idToSha),
            name: '',
            flags: [],
            extra: {},
            lat,
            lon,
            alt,
            gndAlt,
            timeSec,
          };
        },
      );
      const anonGroup = protos.LiveDifferentialTrackGroup.create({
        tracks: anonTracks,
      });

      if (req.header('accept') === 'application/json') {
        return res.json(protos.LiveDifferentialTrackGroup.toJson(anonGroup));
      }

      return res
        .set('Content-Type', 'application/x-protobuf')
        .send(protos.LiveDifferentialTrackGroup.toBinary(anonGroup));
    }
    default:
      return res.sendStatus(400);
  }
}

/**
 * Anonymizes a track ID by hashing it with a salt to ensure privacy.
 *
 * @param id - The original track ID (string or number).
 * @param idToSha - A map storing previously anonymized IDs to avoid recomputation.
 * @returns The anonymized ID as a string.
 */
function anonymizeId(id: string | number, idToSha: Map<string, string>): string {
  const idStr = String(id);
  if (idToSha.has(idStr)) {
    return idToSha.get(idStr)!;
  }
  const sha1 = crypto.createHash('sha1');
  sha1.update(idStr + SECRETS.EXPORT_ID_SALT);
  const hashed = sha1.digest('hex');
  idToSha.set(idStr, hashed);
  return hashed;
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
    // 1. Handle partner token requests (e.g. FlyMe, Wing, Zipline).
    const token = req.header('token');
    if (token) {
      res.set('Cache-Control', 'no-store');
      return await handlePartnerTokenRequest(req, res, token, bufferRedis);
    }

    // 2. Handle public live track requests based on requested duration in seconds.
    res.set('Cache-Control', 'public, max-age=30').vary('Accept-Encoding');
    const sec = Number(req.query.sec ?? 0);
    const key = resolveLiveTrackKey(sec);
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
