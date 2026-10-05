/**
 * Dashboards things that are needed in the core.
 *
 * Shapes mostly mirror `node-dashboards` and `account` entities.
 */
import type { ColorIdent } from '@windy/Color';
import type { ColorGradient, ISOCountryCode, StationId, UserInterest } from '@windy/types';
import type { Overlays, Pois, Products } from '@windy/rootScope.d';
import type { RouteAsString } from '@windy/favs';
import type { AlertCondition, GlobalProductWithWaves } from '@windy/alerts';
import type { UploadType } from '@windy-types/node-imaker';
/**
 * User group entity
 */
export interface Group {
    id: string;
    name: string;
    isDefault?: true;
}
/**
 * Organization entity
 */
export interface Organization {
    id: string;
    name: string;
    logoUrl?: string | null;
    groups: Group[];
}
export interface LastActiveOrganizationSnapshot {
    id: string;
    name: string;
    logoUrl?: string | null;
}
export interface Dashboard {
    id: string;
    groupId: string;
    title: string;
    isPublic: boolean;
    /** `-1` if the dashboard was created by the system. */
    createdByUserId: number;
    createdAt: Date;
    updatedAt: Date;
}
export interface ItemTitleDescription {
    title: string;
    description: string;
}
/**
 * Base item interface. Common fields shared by every item type.
 */
export interface DashboardItem extends ItemTitleDescription {
    id: string;
    dashboardId: string;
    order: number;
    createdByUserId: number;
    createdAt: Date;
    updatedAt: Date;
}
export interface ColorItemPayload {
    type: 'color_palette';
    overlay: ColorIdent;
    gradient: ColorGradient;
}
export interface ViewItemPayload {
    type: 'view';
    overlay: Overlays;
    pois: Pois;
    model: Products;
    icon: string;
    boundaries: {
        lat: number;
        lon: number;
        zoom: number;
    };
}
type FavItemPayloadBase = {
    type: 'fav';
    version: string;
    lat: number;
    lon: number;
    pin2top: 0;
    pin2homepage: 0;
    /** Lowercase ISO 2 letter CC or xx if fav is in the ocean for example */
    cc?: ISOCountryCode | 'xx';
};
export type FavItemPayload = FavItemPayloadBase & ({
    favType: 'fav';
} | {
    favType: 'airport';
    icao: string;
} | {
    favType: 'station';
    stationId: StationId;
} | {
    favType: 'webcam';
    webcamId: number;
} | {
    favType: 'route';
    route: RouteAsString;
});
/**
 * An external (unreviewed) plugin published on windy-plugins.com, pinned to a dashboard.
 */
export interface ExtPluginItemPayload {
    type: 'plugin';
    url: string;
}
export type CreateItemPayload = (ColorItemPayload | {
    type: 'view';
} | AlertItemPayload | FavItemPayload | ExtPluginItemPayload | {
    type: 'upload';
} | {
    type: 'dynamic_upload';
}) & Partial<ItemTitleDescription>;
export interface ViewItem extends DashboardItem, ViewItemPayload {
}
export interface AlertItemPayload {
    type: 'alert';
    lat: number;
    lon: number;
    locationName: string;
    priority: number;
    hasCustomDescription: boolean;
    conditions: AlertCondition[];
    userInterest?: UserInterest;
    model: GlobalProductWithWaves | null;
    suspended: boolean;
    clientVersion: string;
}
export interface AlertItem extends DashboardItem, AlertItemPayload {
    /**
     * Whether the requesting user is subscribed to this alert's notifications,
     * server-computed per viewer.
     */
    dashboardAlertSubscribed: boolean;
}
export type FavItem = DashboardItem & FavItemPayload;
export interface ColorPaletteItem extends DashboardItem, ColorItemPayload {
}
export interface ExtPluginItem extends DashboardItem, ExtPluginItemPayload {
}
export interface UploadItem extends DashboardItem {
    type: 'upload';
    uploadType: UploadType;
    fileName: string;
    name: string;
    size: number;
    showSpeed: boolean;
    contentUrl: string;
    thumbnailUrl?: string;
    avatar: string;
    username: string;
}
export interface CreateUploadItemInput {
    type: 'upload';
    title: string;
    description: string;
    uploadType: UploadType;
    fileName: string;
    name: string;
    size: number;
    showSpeed: boolean;
    content: string;
    avatar: string;
    username: string;
}
export interface DynamicUploadItemPayload {
    type: 'dynamic_upload';
    url: string;
    contentUrl: string;
    uploadType: UploadType;
    lastFetchedAt: string;
    minUpdateInterval: number;
}
export interface DynamicUploadItem extends DashboardItem, DynamicUploadItemPayload {
}
/**
 * Union of every concrete item type.
 */
export type AnyDashboardItem = ViewItem | AlertItem | FavItem | ColorPaletteItem | ExtPluginItem | UploadItem | DynamicUploadItem;
export type DashboardItemNoUpload = ViewItem | AlertItem | FavItem | ColorPaletteItem | ExtPluginItem | DynamicUploadItem;
export {};
