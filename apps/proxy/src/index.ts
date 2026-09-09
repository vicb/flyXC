import type http from 'node:http';
import { createServer } from 'node:http';

import { createProxy } from 'proxy';

const server = createProxy(createServer());

server.authenticate = (req: http.IncomingMessage) => {
  const auth = req.headers['proxy-authorization'];
  return auth === `Bearer ${SECRETS.PROXY_KEY}`;
};

const port = Number(process.env.PORT) || 80;

server.listen(port, () => console.info(`Started proxy on port ${port}.`));
