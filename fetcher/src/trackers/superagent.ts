import request from 'superagent';

// Get an url with retires and timeout.
//
// The response is in the body property (as text).
export async function getTextRetry(
  url: string,
  { timeoutSec }: { timeoutSec: number } = { timeoutSec: 5 },
): Promise<request.Response> {
  return await request
    .get(url)
    .retry(3)
    .timeout(timeoutSec * 1000)
    .buffer(true)
    .parse(textParser);
}

// Copies the text to the body property for consistency.
function textParser(res: request.Response, fn: (error: Error | null, body: any) => void): void {
  let text = '';
  res.setEncoding('utf8');
  res.on('data', (chunk: string) => {
    text += chunk;
  });
  res.on('end', () => fn(null, text));
}
