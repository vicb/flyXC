import type { LogPaths } from '@windy/types.d';
/** Log event to GA. Path `appsflyer` is logged as key_event instead of page_view by node-services */
export declare const logPage: (path: LogPaths, item?: string | boolean) => void;
