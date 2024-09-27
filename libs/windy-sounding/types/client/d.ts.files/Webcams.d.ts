import { LatLon } from '@windy/interfaces.d';
import { Timestamp } from '@windy/types.d';
import { HttpPayload } from '@windy/http.d';

export type WebcamCategoryType =
  | 'landscape'
  | 'traffic'
  | 'meteo'
  | 'uncategorized'
  | 'building'
  | 'indoor'
  | 'city'
  | 'water'
  | 'area'
  | 'forest'
  | 'mountain'
  | 'island'
  | 'beach'
  | 'airport'
  | 'park'
  | 'harbor'
  | 'pool'
  | 'golf'
  | 'lake'
  | 'bay'
  | 'square'
  | 'coast'
  | 'sportarea'
  | 'resort'
  | 'camping'
  | 'other'
  | 'xmasmarket'
  | 'underwater';

export type WebcamPositionType = 'fix' | 'rotating' | 'ptz';

export type WebcamDirectionType =
  | ''
  | 'north'
  | 'northeast'
  | 'east'
  | 'southeast'
  | 'south'
  | 'southwest'
  | 'west'
  | 'northwest';

export type WebcamStatusType =
  | 'active'
  | 'deleted'
  | 'disabled'
  | 'duplicate'
  | 'inactive'
  | 'rejected'
  | 'revoked'
  | 'unapproved';

export interface WebcamCategory {
  id: WebcamCategoryType;
  name: string;
}

export interface WebcamLocation extends LatLon {
  alt: number;
  city: string;
  continent: string;
  country: string;
  subcountry: string;
  title: string;
}

export interface WebcamImageUrls {
  full: string;
  icon: string;
  normal: string;
  original: string;
  preview: string;
  teaserbg: string;
  thumbnail: string;
  webcam: string;
}

export type WebcamImageSize = keyof WebcamImageUrls;

export type WebcamTimelapseType = 'day' | 'current' | 'all';
export interface WebcamDetail {
  categories: WebcamCategoryType[];
  contacts: { owner: string; caretaker: string };
  id: number;
  images: {
    current: WebcamImageUrls;
    daylight: WebcamImageUrls;
    sizes: { [S in keyof WebcamImageUrls]: { width: number; height: number } };
  };
  lastDaylight: Timestamp;
  lastUpdate: Timestamp;
  location: WebcamLocation;
  pageUrl: string;
  shortTitle: string;
  timelapseType: WebcamTimelapseType;
  title: string;
  views: Record<string, string>;
  viewCount: number;
  stream?: string;
  l10n?: {
    /** {[langIsoCode: string]: string} */
    country: Record<string, string>;
    /** {[langIsoCode: string]: string} */
    subcountry: Record<string, string>;
    /** {[langIsoCode: string]: string} */
    city: Record<string, string>;
    /** {[langIsoCode: string]: string} */
    shortTitle: Record<string, string>;
  };
}

export interface WebcamArchiveItem {
  timestamp: number;
  url: string;
}

export interface WebcamArchive {
  day: WebcamArchiveItem[];
  month: WebcamArchiveItem[];
  year: WebcamArchiveItem[];
  lifetime: WebcamArchiveItem[];
}

export type WebcamArchiveInterval = keyof WebcamArchive;

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

export interface WebcamMetadata {
  updateString: string;
  recencyClass: string;
  distanceString: string;
}
