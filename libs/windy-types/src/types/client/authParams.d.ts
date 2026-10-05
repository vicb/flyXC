/**
 * Enhances URL with auth params and a request counter
 */
export declare const addAuthParams: (url: string) => string;
/**
 * Same as {@link addAuthParams}, but for our tile servers only and without the counter, so the
 * browser can cache the tiles. Anything else passes through untouched.
 */
export declare const addTileAuthParams: (url: string) => string;
