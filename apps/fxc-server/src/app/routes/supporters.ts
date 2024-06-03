import { Keys } from '@flyxc/common';
import type { Request, Response} from 'express';
import { Router } from 'express';
import type { Redis } from 'ioredis';

export function getSupportersRouter(redis: Redis): Router {
  const router = Router();

  // Returns the airspaces info for the first track in the group as JSON.
  // Returns 404 if the info are not available (/not ready yet).
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  router.get('/supporters.json', async (req: Request, res: Response) => {
    try {
      const [names, number, amount] = (
        await redis
          .pipeline()
          .lrange(Keys.supporterNames, 0, 100)
          .get(Keys.supporterNum)
          .get(Keys.supporterAmount)
          .exec()
      ).map(([_, v]) => v);
      return res.json({ names, number, amount });
    } catch (error) {
      return res.sendStatus(500);
    }
  });

  return router;
}
