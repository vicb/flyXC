import type { ExternalPluginConfig } from '@windy/interfaces';

// Configuration derived mostly from package.json.
export interface PluginDerivedConfig {
  author: string;
  name: `windy-plugin-${string}`;
  version: string;
  description?: string;
  repository?: string;
  built: number;
  builtReadable: string;
}

// User configuration.
export interface PluginUserConfig extends Omit<ExternalPluginConfig, keyof PluginDerivedConfig> {
  screenshot?: string;
}

export type PluginConfig = PluginDerivedConfig & PluginUserConfig;
