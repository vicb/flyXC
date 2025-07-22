import type { Plugins } from './d.ts.files/plugins.d';
declare const plugins: Plugins;
/**
 * Promise resolves once installed external plugins have loaded into default export
 */
export declare const externalPluginsLoaded: Promise<void>;
export default plugins;
