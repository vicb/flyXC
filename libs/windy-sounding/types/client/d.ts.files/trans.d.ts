import { MainLangFile, PluginTranslations, Translations } from '@windy/lang-files.d';

import type { Overlays } from '@windy/rootScope.d';

/**
 * test loaded file, if everything was correct
 *
 * Key 'waves' is used in productsLang.js, since we use IDs of
 * overlays
 */
export type ValidTranslationKey = keyof Translations | Overlays;

export interface TransFileInfo {
  /**
   * Which lang file is loaded to client
   */
  loaded?: string;

  /**
   * Relative URL of file
   */
  filename: string;

  /**
   * test loaded file, if everything was correct
   */
  test: ValidTranslationKey;
}

export interface StoredTransFile {
  /**
   * All translations in a key-value pairs
   */
  data: Translations;

  /**
   * Client version
   */
  version: string;
}

export interface LoadingOptions {
  /**
   * Absolute URL to load lang file from (handy in client patch for example)
   */
  absoluteURL?: string | boolean;

  /**
   * Optional test string, that can overload standard test string
   */
  test?: ValidTranslationKey;
}

// TODO - there must be better solution how to reflect keys for files and let plugin keys mandatory for loaded files
export type LoadedTranslations = MainLangFile & PluginTranslations;
