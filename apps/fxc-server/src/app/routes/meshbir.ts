import { Keys } from '@flyxc/common';
import type { MeshBirMessage } from '@flyxc/common-node';
import { MESHBIR_MAX_MSG, MESHBIR_MAX_MSG_SIZE, positionSchema, pushListCap, textSchema } from '@flyxc/common-node';
import { Secrets } from '@flyxc/secrets';
import type { Request, Response } from 'express';
import { Router } from 'express';
import type Redis from 'ioredis';
import { ZodError } from 'zod';

export function getMeshBirRouter(redis: Redis): Router {
  const router = Router();

  // Hook called by meshbir.
  router.post('/push', async (req: Request, res: Response) => {
    const [bearer, value] = req.headers.authorization.split(' ');
    if (bearer.toLowerCase() !== 'bearer' || value !== Secrets.MESHBIR_AUTH_TOKEN) {
      return res.sendStatus(403);
    }

    let message: MeshBirMessage;
    try {
      message = parseMessage(req.body);
    } catch (e) {
      return res.sendStatus(400);
    }

    try {
      if ((await redis.llen(Keys.meshBirMsgQueue)) >= MESHBIR_MAX_MSG) {
        return res.status(429).send(`Exceeding ${MESHBIR_MAX_MSG} messages per minute`);
      }
      const pipeline = redis.pipeline();
      pushListCap(pipeline, Keys.meshBirMsgQueue, [JSON.stringify(message)], MESHBIR_MAX_MSG, MESHBIR_MAX_MSG_SIZE);
      await pipeline.exec();
      return res.sendStatus(200);
    } catch (e) {
      console.error(e);
      return res.sendStatus(500);
    }
  });

  return router;
}

// Parses meshbir messages.
// Throws when the message is invalid.
export function parseMessage(message: unknown): MeshBirMessage {
  try {
    return textSchema.or(positionSchema).parse(message);
  } catch (e) {
    if (e instanceof ZodError) {
      throw new Error(`Invalid message format`);
    }
    throw new Error(`Unexpected error during message parsing`);
  }
}
