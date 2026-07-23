import { HttpPayload } from '@windy/http.d';
import { LatLon } from '@windy/interfaces.d';
import { Timestamp } from '@windy/types.d';

export type WebcamCategoryType =
  | 'airport'
  | 'beach'
  | 'building'
  | 'city'
  | 'coast'
  | 'forest'
  | 'indoor'
  | 'lake'
  | 'landscape'
  | 'meteo'
  | 'mountain'
  | 'observatory'
  | 'port'
  | 'river'
  | 'sportArea'
  | 'square'
  | 'traffic'
  | 'village';

export type WebcamDirectionType =
  | ''
  | 'north'
  | 'north-east'
  | 'east'
  | 'south-east'
  | 'south'
  | 'south-west'
  | 'west'
  | 'north-west';

export type WebcamStatusType = 'active' | 'inactive' | 'unapproved' | 'disabled' | 'rejected' | 'duplicate' | 'merged';

export interface WebcamCategory {
  id: WebcamCategoryType;
  name: string;
}

export interface WebcamLocation extends LatLon {
  alt: number;
  city: string;
  country: string;
  title: string;
}

export type WebcamImageSize = 'icon' | 'thumbnail' | 'preview' | 'normal' | 'mobile' | 'full';

export type WebcamTimelapseType = 'day' | 'current' | 'all';

// FIXME TODO: This type does not correspond to output form a backend. Fix the type
export interface WebcamDetail {
  id: number;
  images: {
    current: string;
    daylight: string;
  };
  availableArchiveTypes: WebcamArchiveInterval[];
  lastUpdate: Timestamp;
  lastDaylight?: Timestamp;
  location: WebcamLocation;
  pageUrl: string;
  shortTitle: string;
  timelapseType: WebcamTimelapseType;
  title: string;
  views: Record<string, string>;
  viewCount: number;
  stream?: string;
  promotion?: {
    title: string;
    description: string;
    pageUrl: string;
    logoUrl?: string;
    imageUrl?: string;
  };
}

export interface WebcamArchiveItem {
  timestamp: number;
  url: string;
}

export type WebcamArchiveInterval = 'day' | 'month' | 'year' | 'lifetime';

export interface WebcamsData {
  cams: WebcamDetail[];
  total: number;
}

export type WebcamsPayload = HttpPayload<WebcamsData>;

export interface WebcamsLoadingParams extends LatLon {
  forceReload?: boolean;
}

export interface GeneralWcAdminResponse {
  /** HTTP status code returned in response body */
  code?: number;
  status: 'FAILED' | 'OK';
  /** Error or success message */
  message: string | '';
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
}

export interface WebcamLastUpdatedOn {
  webcamId: number[];
  lastUpdatedOn: number[];
}

export interface WebcamImageRequestParams {
  webcamId: string | number;
  state?: 'current' | 'daylight';
  size?: WebcamImageSize;
}

export interface WebcamMetadata {
  updateString: string;
  recencyClass: string;
  distanceString: string;
}
