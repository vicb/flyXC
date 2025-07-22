import type { LogEvents, LogPaths } from '@windy/types.d';
/** Log event to GA. Path `appsflyer` is logged as key_event instead of page_view by node-services */
export declare const logPage: (path: LogPaths, item?: string | boolean) => void;
/** Logs an event that happens in Windy */
export declare const logEvent: (eventIdent: LogEvents, eventPath?: string) => void;
