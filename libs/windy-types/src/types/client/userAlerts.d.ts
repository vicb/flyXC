import type { AlertResponse, AlertId, AlertRequest, AlertCheckResponse } from '@windy/alerts.d';
import type { LatLon } from '@windy/interfaces';
export declare function getAlertTimestamps(alertId: string): Promise<AlertCheckResponse>;
export declare function getAlerts(): Promise<AlertResponse[]>;
export declare function getAlert(alertId: string): Promise<AlertResponse | null>;
export declare function createAlert(data: AlertRequest): Promise<void>;
export declare function updateAlert(data: AlertRequest & {
    id: AlertId;
}): Promise<AlertRequest & {
    id: AlertId;
}>;
export declare function deleteAlert(alertId: string): Promise<void>;
export declare function getNearAlert(location: LatLon): Promise<AlertResponse | undefined>;
export declare function getNearAlerts(location: LatLon): Promise<AlertResponse[]>;
export declare function add(latLonAndName: LatLon & {
    locationName?: string;
}): void;
export declare function userHasAnyAlerts(): Promise<boolean>;
