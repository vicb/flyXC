import { Datastore, Key } from '@google-cloud/datastore';

export interface TrackerEntity {
  enabled: boolean;
  // Account as entered by the user.
  account: string;
  // Resolved account (i.e. the id retrieved from the account for flyme).
  account_resolved?: string;
}

// A tracker user in the DataStore.
export interface LiveTrackEntity {
  [Datastore.KEY]: Key;
  email: string;
  name: string;
  google_id: string;
  created: Date;
  updated: Date;
  // Whether to share positions with partners.
  share: boolean;
  // Whether to display the user on flyxc.
  enabled: boolean;
  // Trackers.
  // The name must be in sync with TrackerProps.
  inreach: TrackerEntity;
  spot: TrackerEntity;
  skylines: TrackerEntity;
  flyme: TrackerEntity;
  flymaster: TrackerEntity;
  ogn: TrackerEntity;
}
