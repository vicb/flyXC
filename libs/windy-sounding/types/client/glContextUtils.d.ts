/**
 * @summary Registers WebGL context for observing context lost/restored events
 *  - use only for the map webgl context, do not set some other offscreen context here
 * @param gl (Map) WebGL context to observe
 */
export declare function observeWebGLContext(
  gl: WebGL2RenderingContext | WebGLRenderingContext,
  moduleName: string,
): void;
type WebGlErrorType = '';
export declare function reportWebGlError(module: string, type: WebGlErrorType, error: string): void;
export {};
