import { QueryStringSource } from '@windy/http.d';

export interface NotifHttpQsOptions extends QueryStringSource {
  pageSize: number;
  current: number;
  markAsViewed?: boolean;
}

export interface DeliveryInfo {
  deviceID: string;
  platform: string;
  type: string;
}

export interface NotificationObject {
  created: number;
  delivery: DeliveryInfo[];
  other: {
    fav: string;
    firstTimestamp: number;
  };
  type: string;
  updated: number;
  userID: string;
  wasReceived: boolean;
  wasViewed: boolean;
  _id: string;
}

export interface NotificationInfo {
  totalCount: number;
  newNotifications: unknown;
  newCount: number;
  data: NotificationObject[];
}

export interface NotificationTypes {
  canReceiveNotif: void;
}
