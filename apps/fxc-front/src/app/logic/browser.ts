/**
 * Checks whether the current browser user agent corresponds to a mobile device.
 *
 * @see https://stackoverflow.com/questions/11381673/detecting-a-mobile-browser
 * @returns `true` if running on a mobile browser, `false` otherwise.
 */
export const isMobile = (): boolean =>
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobi/i.test(navigator.userAgent);
