import type { HttpOptions } from '@windy/http';
import type { LocationEntity } from '@windy/liveAlerts.types';
export declare function getLocationEntity(locationEntityId: string): Promise<LocationEntity>;
export declare function upsertLocationEntity(
  locationEntityId: string,
  request: Partial<LocationEntity>,
  options?: HttpOptions,
): Promise<LocationEntity>;
export declare function sendTestNotification(locationEntityId: string): Promise<void>;
