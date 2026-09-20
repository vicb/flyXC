import type { HttpOptions } from './d.ts.files/http';
import type { LocationEntity } from './d.ts.files/liveAlerts.d';
export declare function getLocationEntity(locationEntityId: string): Promise<LocationEntity>;
export declare function upsertLocationEntity(locationEntityId: string, request: Partial<LocationEntity>, options?: HttpOptions): Promise<LocationEntity>;
export declare function sendTestNotification(locationEntityId: string): Promise<void>;
