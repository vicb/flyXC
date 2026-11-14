// Web Worker for 3D airspace tile fetching, MVT decoding, multi-tile polygon union, and 2D footprint building.

import { Airspace3dProcessor, type AirspaceWorkerRequest } from './airspace3d-processor';

const processor = new Airspace3dProcessor();

addEventListener('message', async (event: MessageEvent<AirspaceWorkerRequest>) => {
  try {
    await processor.process(event.data, (progress) => {
      postMessage(progress);
    });
  } catch (error) {
    console.error('Airspace3d Worker error:', error);
    postMessage({
      id: event.data?.id ?? -1,
      items: [],
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
