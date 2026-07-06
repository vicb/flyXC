import type { TypedArray } from '@windy/glUtils.d';
import type { GlProgram } from '@windy/GlProgram';
/**
 * @class A class that represents abstraction of a renderable logical geometry chunk
 *          - (geometry with the same properties, requiring same rendering approach)
 */
export declare class GlMesh {
  private static numMeshes;
  /**
   * Array of vertex streams (Vertex Buffer Objects) used for rendering the mesh
   *  - GPU buffer references | Key-value map in the future (multiple geometry buffers)
   */
  private readonly vbos;
  /** Size of the GPU buffer | Key-value map in the future (multiple geometry buffers) */
  private vertexCount;
  /**
   * Array of vertex attributes mapping
   *  - one map for each vertex stream, since every stream has at least one attribute defined by layout index and size
   *  - maps attributes bound to the given GPU buffer (VBO)
   */
  private readonly attributes;
  /**
   * Size of all attributes for one vertex in the given vertex stream
   *  e.g. one vertex has Vec3 position, Vec2 uv, and Vec3 color --> stride is 3+2+3 = 8 bytes
   * */
  private readonly buffersStride;
  /** Element Buffer Object for storing vertex indices for indexed rendering */
  private ebo?;
  /**
   * Map of Vertex Array Objects
   *  VAO - represents binding of geometry layout with a given shader program
   *  - one VAO is for given GlProgram (not per vertex stream)
   *  - one VAO handles binding of all vertex streams, but for every GlProgram, new VAO should be created since each shader can have different layout
   */
  private readonly vaos;
  private readonly meshId;
  private instanceBuffer?;
  private instanceAttributes?;
  private instanceBufferStride;
  private instancingInitialized;
  private drawElementsCall;
  private drawArraysCall;
  private vertexDivisorCall;
  /**
   * @param vertexData Default vertex stream data (can be interleaved - defined by layout)
   * @param indexData Optional index buffer data (in case of indexed data rendering)
   * @param dynamic Signals, whether the geometry will be updated frequently or is static
   */
  constructor(
    gl: WebGLRenderingContext | WebGL2RenderingContext,
    vertexData: Float32Array,
    indexData?: Uint16Array,
    dynamic?: boolean,
  );
  /**
   * @summary Resets mesh instance counter on plugin cleanup, used for debugging
   */
  static reset(): void;
  /**
   * @summary Performs draw call of the mesh w.r.t. current state defined by VAO / attributes layout + given shader program
   *          - WARNING: this call assumes, that GlProgram.use() / gl.useProgram(programId) was already called!
   *          - automatically performs the appropriate call -> instanced/non-instanced + indexed/non-indexed - all based on the state given by the supplied data
   * @param program Shader program used to identify the render/geometry state
   * @param primType Which primitives to draw with the vertex data
   * @param offset Offset in the geometry buffer (defaults to 0)
   * @param count Number of vertices / elements to draw from the buffer (defaults to full size of the geometry)
   * @param numInstances When instanced rendering used, signals, how many instances to draw
   */
  render(
    gl: WebGLRenderingContext | WebGL2RenderingContext,
    program: GlProgram,
    primitiveType?: GLenum,
    numInstances?: number,
  ): void;
  /**
   * @summary Creates new geometry layout binding / (new VAO if available) w.r.t. supplied shader program
   *          - goal: the same mesh geometry can be reused by many shaders with different layouts (we are binding to the given shader)
   *          - TODO: currently works with only one buffer (interleaved/joined data), extend this to support multiple buffers (streams) + per-buffer layout setup
   * @param shaderProgram Shader program for which to setup the layout
   * @param vertexAttribLayout Specifies, how the mesh data should be mapped to the given shader (VS)
   *          - e.g. {a_pos : 3, a_uv : 2} defines two attributes, first vertex position with three components, second texture coordinates vector with two components
   *          - the object keys must respect names of the attribute variables in the Vertex Shader
   * @param vertexStreamIndex Index of vertex stream (VBO) for which the layout is being registered. Default one is 0
   */
  registerShaderGeometryLayout(
    gl: WebGLRenderingContext | WebGL2RenderingContext,
    shaderProgram: GlProgram,
    vertexAttribLayout: Record<string, number>,
    vertexStreamIndex?: number,
  ): void;
  /**
   * @summary Destructor
   */
  destroy(gl: WebGLRenderingContext | WebGL2RenderingContext): void;
  /**
   * @summary Appends vertex stream to the mesh.
   *      Do not forget to register vertex layout for this stream via {@link registerShaderGeometryLayout} method
   * @param vertexData Typed array (Float32Array) with vertex data (position, tex. coordinates etc.)
   * @param dynamic Whether the data will be updated frequently or not
   * @returns Index of the newly registered vertex stream
   */
  addVertexStream(
    gl: WebGLRenderingContext | WebGL2RenderingContext,
    vertexData: Float32Array,
    dynamic?: boolean,
  ): number;
  /**
   * @summary Dynamically updates content of the given vertex stream. Assumes, that the layout remains the same
   * @param streamIndex Which stream data to update
   * @param vertexData New vertex data
   */
  updateVertexStream(
    gl: WebGLRenderingContext | WebGL2RenderingContext,
    streamIndex: number,
    vertexData: Float32Array,
  ): boolean;
  /**
   * @summary Initializes instancing-related methods based on used WebGL context
   *  - if not called explicitly, it is called during instanced rendering (however in that case we don't get the status, whether instancing is available)
   * @returns Status, whether instancing was successfully initialized or whether it failed (extension not supported...)
   */
  initInstancing(gl: WebGL2RenderingContext | WebGLRenderingContext): boolean;
  /**
   * @summary Adds / updates instance data, binds instance buffer with the given shader
   *          - signals, that further rendering will be performed as instanced (based on thw supplied "numInstances" parameter in the render method)
   * @param program Shader program used for instanced rendering
   * @param instanceData Per-instance data (buffer with elements, where each element is assigned to one instance (defined by "gl.vertexAttribDivisor"))
   * @returns true/false, whether update was successful (can fail, when WebGL2 not available together with 'ANGLE_instanced_arrays' extension not available)
   */
  setInstanceStream(
    gl: WebGLRenderingContext | WebGL2RenderingContext,
    program: GlProgram,
    instanceData: TypedArray,
    instanceAttribLayout: Record<string, [number, number]>,
  ): boolean;
  /**
   * @summary Dynamically updates content of the mesh instance stream.
   *  - Assumes, that the layout remains the same
   *  - Currently only one instance stream is supported
   * @param instanceData New instance data
   */
  updateInstanceStream(gl: WebGLRenderingContext | WebGL2RenderingContext, instanceData: TypedArray): boolean;
  /**
   * @returns {boolean} Flag, that instance stream was already created, so subsequent data uploads should call {@link updateInstanceStream}
   */
  hasInstanceStream(): boolean;
  /**
   * @summary Binds geometry (and index if available) buffer for following operations (e.g. rendering)
   *  - Also used for layout definition when creating VAO {@link GlVertexArray}
   */
  private bindGeometry;
  /**
   * @summary Performs rendering of the mesh numInstances-times using WebGL2 context or WebGL1 extension
   */
  private renderInstanced;
}
/**
 * @class A container with common geometries
 */
export declare class MeshFactory {
  /** 2D Quad geometry containing only unique vertices (for indexed rendering / triangle fan)
   * Contains vertex coordinates + UV coordinates
   *  - an appropriate vertex layout should be {a_pos: 2, u_uv: 2}
   */
  static quadMeshUniqueVtxUv: number[];
  /** 2D Quad mesh with unique vertices with only vertex positions
   *  - an appropriate vertex layout should be {a_pos: 2}
   */
  static quadMeshUniqueVtx: number[];
  /** 2D Quad mesh with defined as two triangles - 6 vertices (not - unique)
   *  - basically geometry for drawArrays as gl.TRIANGLE
   *  - an appropriate vertex layout should be {a_pos: 2}
   */
  static quadMeshTrianglesVtx: number[];
}
