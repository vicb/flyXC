import { ExternalSveltePlugin } from '@windy/ExternalSveltePlugin';
import type { InstalledExternalPluginConfig } from '@windy/interfaces.d';
export type ExternalPluginError = {
  type: 'network' | 'installation' | 'open';
  msg: string;
};
export declare const installExternalPlugin: (
  url: string,
  installedBy: InstalledExternalPluginConfig['installedBy'],
) => Promise<InstalledExternalPluginConfig>;
export declare const loadExternalPlugins: () => Promise<ExternalSveltePlugin[]>;
/** Removes ext plugin  */
export declare const removeExternalPlugin: (name: InstalledExternalPluginConfig['name']) => Promise<void>;
