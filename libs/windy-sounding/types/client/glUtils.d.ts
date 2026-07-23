export { GlBuffer, GlBufferType, GlBufferUsage } from '@windy/GlBuffer';
export { GlMesh, MeshFactory } from '@windy/GlMesh';
export { GlProgram } from '@windy/GlProgram';
export { GlTexture } from '@windy/GlTexture';
export { GlVertexArray } from '@windy/GlVertexArray';
export { GlRenderer } from '@windy/GlRenderer';
export { GlObj } from '@windy/GlObj';
export type { UniformRecord, TypedArray, UniformDataType, Gl2ColorFormat, GlColorFormat, EXT_disjoint_timer_query, EXT_disjoint_timer_query_webgl2, } from '@windy/glUtils.d';
import type { Vector2 } from './d.ts.files/math';
import type { GlColorFormat } from './d.ts.files/glUtils.d';
type GlUtils = {
    placeholderImageDataEmpty: ArrayBuffer | undefined;
    placeholderTextureEmpty: WebGLTexture | undefined;
    placeholderImageDataGrey128: ArrayBuffer | undefined;
    placeholderTextureGrey128: WebGLTexture | undefined;
    placeholderTexture: WebGLTexture | undefined;
    placeholderFbo: WebGLFramebuffer | undefined;
};
export declare class GlError extends Error {
    additionalInfo: Record<string, string>;
    emitToElastic: boolean;
    constructor(message: string, options?: {
        cause?: unknown;
        additionalInfo?: Record<string, string>;
    }, emitToElastic?: boolean);
    toObject(): Record<string, unknown>;
}
export declare const enum GlslDataType {
    Int = 0,
    Texture = 1,// same as int, but used to differentiate between uniform value & texture
    FVec4 = 2,
    Mat4 = 3,
    FVec2 = 4,
    Float = 5,
    FVec3 = 6,
    FloatArray = 7,
    FVec4Array = 8
}
export declare const glUtils: GlUtils;
/**
 * @class Static class for handling WebGL extensions
 */
export declare class GlExtension {
    private static readonly glExtensions;
    /**
     * @summary Returns extension context reference, if not already stored, tries to get one
     *          - same as GlExtension.setExtension, but also returns the extension
     * @param gl WebGL context
     * @param name Name of the extension to use
     * @summary Returns the extension object or undefined, of not found (or is not supported)
     */
    static getExtension(gl: WebGLRenderingContext | WebGL2RenderingContext, name: string): any | undefined;
    /**
     * @summary Tries to get and store specific extension for further usage
     * @param name Name of the WebGL extension to initialize
     */
    static setExtension(gl: WebGLRenderingContext | WebGL2RenderingContext, name: string): boolean;
    /**
     * @summary Clear extensions bound to the currently used WebGL context (e.g. after closing a plugin)
     */
    static unloadExtensions(): void;
}
/**
 * @summary Creates shader program from supplied vertex and fragment shader source code strings
 * @param vertexShader
 * @param fragmentShader
 * @returns {WebGLProgram}
 */
export declare function createShaderProgram(gl: WebGLRenderingContext | WebGL2RenderingContext, vertexShader: WebGLShader, fragmentShader: WebGLShader): WebGLProgram;
/**
 * @summary Creates shader of given type (VERTEX/FRAGMENT) from supplied shader source code string
 * @param shaderStr Shader source code
 * @param shaderType Shader type (gl.VERTEX_SHADER or gl.FRAGMENT_SHADER)
 * @returns {WebGLShader | undefined} Returns compiled WebGL shader or undefined in case there was some error during the compilation
 * @throws {GlError} When shader compilation fails
 */
export declare function createShaderFromSource(gl: WebGLRenderingContext, shaderStr: string, shaderType: GLenum): WebGLShader;
/**
 * @summary Validates given dimensions before they are used to resize WebGL texture
 * @param dims Dimensions to check
 * @returns {boolean}
 */
export declare function checkTextureDimensions(dims: Vector2): boolean;
/**
 * @summary Creates "empty" data FBO placeholder
 */
export declare function createPlaceholderFbo(gl: WebGL2RenderingContext | WebGLRenderingContext): void;
/**
 * @summary Creates data Texture placeholder
 *  - in case we can't render some requested texture, we can use this auxiliary empty 1x1 texture as a temporary placeholder
 * @param data Optional data to initialize the texture with, otherwise a 1x1 red pixel texture is created
 */
export declare function createPlaceHolderTexture(gl: WebGL2RenderingContext | WebGLRenderingContext, data?: HTMLCanvasElement | HTMLImageElement): WebGLTexture | undefined;
/**
 * @summary Creates "empty" data image placeholder
 *  - used for example when we want to "abort" fetch of some tile, we return this auxiliary data to prevent MapLibre errors in console..
 */
export declare function createPlaceholderImageData(gl: WebGL2RenderingContext | WebGLRenderingContext): Promise<void>;
/**
 * @summary Helper function to get byte size of the given WebGL type (currently color formats only, other stuff can be implemented later as needed)
 * @param type Type to get size of
 * @returns Size in bytes (per pixel in case of color format) of the given type
 */
export declare function sizeOf(type: GlColorFormat): number;
/**
 * @summary Method for accessing texture format by its internal format for cases, when these two are not the same
 *  - specifically for special WebGL2 texture formats
 * @param internalFormat
 */
export declare function getTextureFormatByInternalFormat(internalFormat: GlColorFormat): number;
/**
 * @summary Queries last WebGL error reported by the context
 *  - do not use this in production and keep in mind that this method dramatically affects performance
 * @param gl Context to check
 */
export declare function checkGlError(gl: WebGL2RenderingContext | WebGLRenderingContext, errorPrefix?: string): boolean;
/**
 * @summary Wrapper for `logInfo` function emitting to elastic, with guard for DEBUG mode and error emitting flag
 */
export declare function logErrorWebGL(moduleName: string, error: GlError): void;
