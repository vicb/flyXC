/**
 * # seoParser
 *
 * The main purpose of this module is to parse the SEO related part of URL.
 *
 * Examples of SEO URLs:
 *
 * ## https://www.windy.com/cs/... (case [1])
 * SEO language, used in @module trans  Must be followed by string
 *
 * ## https://www.windy.com/-Name-Whatever-overlay (case [2])
 * SEO Name of Overlay
 *
 * ## https://www.windy.com/-Name-Whatever/... (case [3])
 * SEO NAME of plugin name, followed by any other string
 *
 * Remember that numbers are not allowed at the beginning of the URL, to distinguish
 * any URL from detail.
 *
 * @module seoParser
 */
declare const _default: {
  /**
   * Language parsed from startupUrl, null if cannot be parsed
   */
  lang: string;
  /**
   * Path part of the startup URL without SEO parts
   */
  purl: string;
  /**
   * Path part of the initial URL when client was open
   */
  startupUrl: string;
  /**
   * Overlay parsed from startupUrl, null if cannot be parsed
   */
  overlay: string;
};
export default _default;
