import { Keys } from '@flyxc/common';
import type { Request, Response } from 'express';
import { Router } from 'express';
import type { Redis } from 'ioredis';

export function getSupportersRouter(redis: Redis): Router {
  const router = Router();

  // Returns the supporter info
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  router.get('/supporters.json', async (req: Request, res: Response) => {
    try {
      const [names, number, amount, amountLast3Months] = (
        await redis
          .pipeline()
          .lrange(Keys.supporterNames, 0, 100)
          .get(Keys.supporterNum)
          .get(Keys.supporterAmount)
          .get(Keys.supporterLast3MonthsAmount)
          .exec()
      ).map(([_, v]) => v);
      return res.json({ names, number, amount, amountLast3Months });
    } catch (error) {
      return res.sendStatus(500);
    }
  });

  return router;
}
