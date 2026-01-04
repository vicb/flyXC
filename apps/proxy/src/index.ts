import { fetchResponse, protos } from '@flyxc/common';
import type { Request, Response } from 'express';
import express from 'express';

const app = express().use(express.raw());

app.post('/get', async (req: Request, res: Response) => {
  const r = protos.Request.fromBinary(req.body);

  if (r.key != SECRETS.PROXY_KEY) {
    return res.status(400).send(`[proxy] Invalid key`);
  }

  try {
    const response = await fetchResponse(r.url, {
      retry: r.retry,
      timeoutS: r.timeoutS,
      retryOnTimeout: r.retryOnTimeout,
    });

    return res.status(response.status).send(await response.text());
  } catch (e) {
    return res.status(500).send(`[proxy] ${JSON.stringify(e)}`);
  }
});

const port = process.env.PORT || 80;

app.listen(port, () => console.info(`Started server on port ${port}.`));
