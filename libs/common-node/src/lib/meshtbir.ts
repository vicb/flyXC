import { z } from 'zod';

export const MESHBIR_MAX_MSG_SIZE = 250;
// Consume at max 1MB of memory
export const MESHBIR_MAX_MSG = Math.floor(1e6 / MESHBIR_MAX_MSG_SIZE);

export const positionSchema = z
  .object({
    type: z.literal('position'),
    user_id: z.string().uuid(),
    latitude: z.number(),
    longitude: z.number(),
    altitude: z.number(),
    time: z.number().min(0),
    ground_speed: z.number(),
  })
  .required();

export const textSchema = z
  .object({
    type: z.literal('message'),
    user_id: z.string().uuid(),
    time: z.number(),
    message: z.string(),
  })
  .required();

export type Position = z.infer<typeof positionSchema>;
export type Message = z.infer<typeof textSchema>;
export type MeshBirMessage = Position | Message;
