export declare const crashMessage: string;
export declare function webglSupported(): boolean;
/**
 * @summary Report WebGL error to the user using alert box
 * @param reason - reason of the error (e.g. that context was lost)
 */
export declare function reportWebGlError(reason: string): void;
