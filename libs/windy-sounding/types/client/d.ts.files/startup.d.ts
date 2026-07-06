import type { SemVersion, Timestamp } from '@windy/types';

export type WhatsNewObsolete = {
  minVersion: SemVersion;
  published: Timestamp;
};

export type WhatsNewData = {
  id: string;
  title: string;
  contributors: {
    name: string;
    avatarUrl: string;
  }[];
  content: {
    new?: string;
    improved?: string;
    fixed?: string;
  };
};
