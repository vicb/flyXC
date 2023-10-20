import { PubSub } from '@google-cloud/pubsub';

// Publish the created track to PubSub for further processing.
const pubsubClient = new PubSub();

// Queue the task post-processing to add altitude and airspaces.
export async function queueTrackPostProcessing(trackId: number) {
  await pubsubClient.topic('projects/fly-xc/topics/track.upload').publishMessage({ json: { id: trackId } });
}
