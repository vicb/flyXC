import type { HttpError } from '@windy/http';

/** Payload sent to backend */
export interface ErrorPayload {
  timestamp: number;
  runningMs: number;
  type: string;
  module: string | null | undefined;
  msg: string;
  line: number | null | undefined;
  col: number | null | undefined;
  url: string | undefined;
  script: string | null | undefined;
  ver: string;
  target: string;
  stack: string | undefined;
  error: string;
  isOnline: boolean;
  repeated?: number;
  scriptLine?: string;
  latestBcast?: string;
  sessionName?: string;
  sessionCounter?: number;
  lang?: string;
  size?: string;
  platform?: string;
  errorID?: string;
  beta?: boolean;
}

export interface CustomError {
  msg: string;
  moduleName: string;
  errorObject?: Error | HttpError | Event | ErrorEvent;
}
