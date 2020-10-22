import async from 'async';
import { IncomingMessage } from 'http';
import { get } from 'https';
import { Stream } from 'stream';

export async function httpsGet(url: string): Promise<Buffer> {
  // Retry up to 3 times.
  // Note the cast is needed because of an error in the types.
  const msg = ((await async.retry({ times: 3, interval: 50 }, async () =>
    httpsGetStream(url),
  )) as unknown) as IncomingMessage;
  return await bufferStream(msg);
}

// Makes an https GET request.
async function httpsGetStream(url: string): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    const req = get(url, (incomingMessage: IncomingMessage) => {
      const statusCode = incomingMessage.statusCode || -1;
      if (statusCode < 200 || statusCode > 300) {
        reject(new Error(`https GET status = ${statusCode}`));
      } else {
        resolve(incomingMessage);
      }
      req.on('error', (e: Error) => reject(e));
    });
  });
}

// Convert a stream to a Buffer.
async function bufferStream(stream: Stream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream
      .on('data', (chunk) => {
        chunks.push(chunk);
      })
      .on('end', () => {
        resolve(Buffer.concat(chunks));
      })
      .on('error', (e: Error) => reject(e));
  });
}
