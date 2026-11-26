// Lightweight static HTTP server with Range (206) and CORS support for local PMTiles development.

import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import express from 'express';

const __dirname = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT ?? 8084);
const rootDir = resolve(process.argv[2] ?? join(__dirname, '../../../assets/tiles'));

const app = express();

app.use((req, res, next) => {
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Range, If-None-Match',
    'Access-Control-Expose-Headers': 'Content-Range, Content-Length, ETag',
  });
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

app.use(express.static(rootDir, { maxAge: 0 }));

app.listen(port, () => {
  console.log(`Serving airspace tiles from ${rootDir} on http://localhost:${port}`);
});
