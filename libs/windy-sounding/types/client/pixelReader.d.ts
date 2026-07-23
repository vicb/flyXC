/**
 * A class that handles asynchronous reading from textures.
 * All reads per frame are batched together.
 * Uses asynchronous pixel reads using Pixel Buffer Objects if WebGL2 is available,
 * otherwise falls back to synchronous glReadPixels calls.
 */
export declare class PixelReader {
  private _gl;
  private _texFbo;
  private _requests;
  private _availablePbos;
  private _pendingPboReads;
  private _pboLoop;
  private _disposed;
  /**
   * Creates a new instance.
   * @param gl - The WebGL context, can be WebGL1 or WebGL2.
   */
  constructor(gl: WebGLRenderingContext | WebGL2RenderingContext);
  /**
   * Marks all GPU resources for deletion once all readPixels queries are done.
   */
  dispose(): void;
  /**
   * Asynchronously reads a rectangle of pixels from the framebuffer associated with this {@link PixelReader} instance.
   * @param texture - The texture from which pixels will be read. It must be a GL_TEXTURE_2D. Reads are batched and executed at the end of the frame - do NOT delete this texture until you received the pixel data.
   * @param sampleX - Left edge of the read region in pixels, inclusive.
   * @param sampleY - Top edge of the read region in pixels, inclusive.
   * @param width - Width of the read region in pixels.
   * @param height - Height of the read region in pixels.
   * @returns A promise that resolves to an `Uint8Array` containing the read pixels, row by row, with 4 values per pixel (RGBA).
   */
  readPixels(
    texture: WebGLTexture,
    sampleX: number,
    sampleY: number,
    width: number,
    height: number,
    abort?: AbortSignal,
  ): Promise<Uint8Array | null>;
  /**
   * Executes all buffered reads. Call once all reads for this frame have been submitted.
   */
  private _executeReads;
  private _executeReadsSync;
  private _executeReadsPBO;
  /**
   * Checks all waiting reads whether they are ready.
   * Only relevant in WebGL2 when using PBOs.
   */
  private _updatePboReads;
  /**
   * Deletes all GPU resources and cleans up.
   */
  private _cleanUp;
}
