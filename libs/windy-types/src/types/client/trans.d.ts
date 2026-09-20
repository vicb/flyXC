/**
 * # @windy/trans
 *
 * This module handles all i18n tasks, including detecting the desired language,
 * lazy loading language files, translating parts of the DOM, and returning
 * translated strings for later use in the app.
 *
 * English language stings from `main` file are hardcoded in the core by default,
 * to avoid any undefined strings in DOM. Other languages are loaded on demand.
 *
 * WARNING: Contrary to previous version, Windy does not support changing language
 * during a runtime. Once user opts to change the language, whole app must be reloaded.
 *
 * @module trans
 */
import type { SupportedLangFiles } from '@windy/lang-files.d';
import type { LoadedTranslations } from '@windy/types';
export declare const supportedLangFiles: string[];
/**
 * key-value pairs with all loaded lang strings
 * WARNING: Typing here is not true... lang files are loaded step-by-step on demand, but it is useless to use `!` everywhere
 */
export declare const t: LoadedTranslations;
/**
 * Preferred browsers' language (not the used one). Can contain language that is not supported by Windy
 */
export declare const navigatorPreferredLang: string;
export declare const getUrlOfLangFile: (id: keyof SupportedLangFiles) => string;
/**
 *english lang.
 * It does nothing in case of english, as it is already loaded by default.
 *
 * @param id Id of translation file
 * @returns Translations in key-pair object. Missing translations are presented in default english lang.
 */
export declare const loadLangFile: (id: keyof SupportedLangFiles) => Promise<void>;
/**
 * Replace. It overrides its innerHTML
 * Supported data suffixes: 'title', 'placeholder', 't', 'afterbegin', 'beforeend', 'tooltipsrc'
 *
 * @param element HTML element where tags should be replaced
 * @example
 * ```
 * data-t="PHRASE"
 *
 * data-afterbegin=""
 * data-beforeend=""
 * data-tooltipsrc="PHRASE"
 *
 * <p>
 *   <!-- afterbegin -->
 *   foo
 *   <!-- beforeend -->
 * </p>
 * ```
 */
export declare const translateDocument: <T extends HTMLElement>(element: T) => void;
