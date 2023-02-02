import { getDatastore } from '@flyxc/common-node';
import express, { Request, Response } from 'express';
import { postProcessTrack } from './app/process';

const app = express().use(express.json());

app.post('/process', async (req: Request, res: Response) => {
  if (req.body.message.data) {
    let id: string;
    try {
      id = JSON.parse(Buffer.from(req.body.message.data, 'base64').toString()).id;
      console.log(`Post processing id = ${id}`);
      await postProcessTrack(getDatastore(), id);
      return res.sendStatus(200);
    } catch (e) {
      console.error(`Error processing id = ${id}`, e);
    }
  }

  return res.sendStatus(400);
});

const port = process.env.PORT || 8080;
const server = app.listen(port, () => console.info(`Started server on port ${port}.`));

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

function shutdown() {
  console.log('Shutting down...');
  server.close(() => {
    process.exit(0);
  });

  setTimeout(() => {
    process.exit(1);
  }, 10000);
}
