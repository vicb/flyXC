/**
 * @class A wrapper class for WebGL VertexArrayObject (VAO)
 */
export declare class GlVertexArray {
  private static vaosCount;
  private readonly vaoId;
  private vao;
  /**
   * @summary Resets vao instance counter on plugin cleanup, used for debugging
   */
  static reset(): void;
  /**
   * @summary Tries to create WebGL VertexArrayObject
   * @returns {GlVertexArray | null} GlVertexArray instance or null,
   *      if WebGL1 used and VAO extension (OES_vertex_array_object) is not available
   */
  static create(gl: WebGLRenderingContext | WebGL2RenderingContext): GlVertexArray | null;
  /**
   * @summary Binds the Vertex Array for rendering
   *          - Binds proper VAO (either by WebGL2 or by WebGL1 extension)
   */
  bind(gl: WebGLRenderingContext | WebGL2RenderingContext): void;
  /**
   * @summary Unbinds the Vertex Array
   */
  unbind(gl: WebGLRenderingContext | WebGL2RenderingContext): void;
  /**
   * @summary Destructor - releases all WebGL resources
   */
  destroy(gl: WebGLRenderingContext | WebGL2RenderingContext): void;
  /**
   * @summary Tries to initialize the WebGL/WebGL2 VertexArrayObject
   * @returns {boolean} Flag whether the initialization was successful
   *  - it can fail in case the WebGL2 is not supported and
   *    the WebGL1 extension "OES_vertex_array_object" is not available
   */
  private init;
}
