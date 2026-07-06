import type { Vector2 } from '@windy/math';
import type { GlColorFormat } from '@windy/glUtils.d';
/**
 * @class A wrapper class for WebGL Texture
 */
export declare class GlTexture {
  private static numTextures;
  static reset(): void;
  /**
   * @summary Creates texture instance using remote image
   * @param url Url of the image to fetch
   */
  static createFromUrl(gl: WebGLRenderingContext | WebGL2RenderingContext, url: string): Promise<GlTexture>;
  /** Texture target (e.g. TEXTURE_2D) */
  private readonly _target;
  /** WebGL texture object */
  private readonly _texture;
  /** Class instance unique id, for debug, tracks number of created instances */
  private readonly _textureId;
  /** Texture color WebGL format */
  private _internalFormat;
  /** Current texture dimension (pixels) */
  private _dimensions;
  private _uvDownScale;
  /** Texture uv coordinates wrapping strategy (how to handle uv coordinates out of <0.0,1.0> range) */
  private wrap;
  /** Texture magnification and minification filtering */
  private filter;
  private _usedMemory;
  /**
   * @param format Texture internal format (data representation, e.g. RGB, RGBA, LUMINANCE_ALPHA etc.)
   * @param target Target - TEXTURE_2D, cubemap, array texture etc.
   */
  constructor(
    gl: WebGLRenderingContext | WebGL2RenderingContext,
    format?: GlColorFormat,
    target?: GLenum,
    fromTexture?: WebGLTexture,
  );
  /**
   * @returns The original WebGL texture object handle
   */
  get texture(): WebGLTexture;
  /**
   * @returns Class instance unique identifier
   */
  get textureId(): number;
  /**
   * @returns Texture target / type (TEXTURE_2D, array texture, cubemap, etc.)
   */
  get target(): GLenum;
  /**
   * @returns {Vector2} Dimensions of the texture
   */
  get dimensions(): Vector2;
  set format(format: GlColorFormat);
  get format(): GlColorFormat;
  get uvDownScale(): Vector2;
  /**
   * @summary Returns gpu memory size currently used by the texture (in bytes)
   */
  get usedMemory(): number;
  /**
   * @summary Uploads new image data into the texture
   * @param data either HTMLImageElement or tuple of [RawData, Dimensions]
   * @param wrap texture wrapping (clamp, repeat...)
   * @param filter texture minification and magnification filtering (nearest, linear)
   * @param premultiply flag, whether to premultiply RGB channels by Alpha channel before uploading data to the GPU (UNPACK_PREMULTIPLY_ALPHA_WEBGL)
   * ToDo: mip-maps, per-coordinate wrap, per mag/min filtering
   */
  updateContent(
    gl: WebGLRenderingContext | WebGL2RenderingContext,
    data: HTMLImageElement | [Uint8Array, Vector2] | [Uint8ClampedArray, Vector2] | HTMLCanvasElement | ImageBitmap,
    wrap?: GLenum,
    filter?: GLenum,
    premultiply?: boolean,
  ): void;
  /**
   * @summary Binds the texture for rendering and other operations
   * @param wrap Wrap settings, how to handle texture coordinates out of <0.0, 1.0> bounds (where to read)
   * @param filter Texture minification and magnification filtering (nearest / interpolation)
   */
  bind(gl: WebGLRenderingContext | WebGL2RenderingContext, wrap?: GLenum, filter?: GLenum): void;
  /**
   * @summary Unbinds the texture
   */
  unbind(gl: WebGLRenderingContext | WebGL2RenderingContext): void;
  /**
   * @summary Destructor, releases WebGL texture
   */
  destroy(gl: WebGLRenderingContext | WebGL2RenderingContext): void;
  /**
   * @summary Resizes the texture with null data and/or sets new texture format
   *  - the reason of performing both in one method is to ideally perform both operations using single gl.texImage2D call
   * @param newSize Dimensions in pixels
   * @param disableDownscale Flag that disables the resize
   *      (since there are multiple conditions, that can lead to preventing the resize from outer scope)
   * @param newFormat Optional new color format to be set to the texture
   * @returns {Vector2} A rescale vector representing the factor by which the original UV coordinates should be rescaled
   *      in case texture down-scaling is disabled {@link disableDownscale} --> in this way the UV range is constrained only to the valid area
   */
  resize(
    gl: WebGLRenderingContext | WebGL2RenderingContext,
    newSize: Vector2,
    disableDownscale?: boolean,
    newFormat?: GlColorFormat,
  ): Vector2;
  /**
   * @summary Reallocates the texture based on the new dimensions and/or new color format
   */
  private reallocate;
  private setupProfiling;
  private updateProfilingStats;
}
