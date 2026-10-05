import { GlBuffer } from '@windy/GlBuffer';
import type { GlBufferFormat, TypedArray } from '@windy/glUtils.d';
import type { GlProgram } from '@windy/GlProgram';
export type Attribute = {
    /** Data type of the attribute components, defaults to gl.FLOAT */
    type?: GlBufferFormat;
    /** Number of components in the attribute (e.g., 3 for vec3) */
    components: number;
};
export type InstanceAttribute = Attribute & {
    /**
     * Instance divisor (as in `gl.vertexAttribDivisor`): the attribute advances once every
     * `divisor` instances (rendered meshes), so `divisor` consecutive instances share the same record.
     *  - 0 ..advance per vertex (non-instanced)
     *  - 1 ..advance per instance
     *  - N ..advance once per N instances
     */
    divisor: number;
    /**
     * Element offset (in components, e.g. floats) of this attribute within one instance
     * record. Needed when several meshes read different subsets of the same shared instance
     * buffer. Defaults to the packed running offset (attributes laid out back to back).
     */
    offset?: number;
};
type AttributeDescriptor = Required<Attribute> & {
    /** Location of the attribute in the shader program */
    location: number;
};
/**
 * @class A class that represents abstraction of a renderable logical geometry chunk
 *          - (geometry with the same properties, requiring same rendering approach)
 */
export declare class GlMesh {
    private static _totalMeshes;
    private readonly _meshId;
    /**
     * Array of vertex streams (Vertex Buffer Objects) used for rendering the mesh
     *  - GPU buffer references | Key-value map in the future (multiple geometry buffers)
     */
    private readonly _vertexBuffers;
    /**
     * Ownership flag per vertex stream. A mesh only destroys buffers it created itself
     * (raw data was passed in). Borrowed buffers (a {@link GlBuffer} was passed in for sharing)
     * are owned by the caller and left untouched on destroy.
     */
    private readonly _vertexBufferOwned;
    /**
     * Size of all attributes for one vertex in the given vertex stream (one vertex buffer, relates to {@link _vertexBuffers})
     *  e.g. one vertex has Vec3 position, Vec2 uv, and Vec3 color --> stride is 3+2+3 = 8 bytes
     * */
    private readonly _buffersStrides;
    /** Number of vertices in the mesh (all vertex streams have the same count) */
    protected _vertexCount: number;
    /**
     * Array of vertex attributes mapping
     *  - one map for each vertex stream, since every stream has at least one attribute defined by layout index and size
     *  - maps attributes bound to the given GPU buffer (VBO)
     */
    protected readonly _attributes: Map<string, AttributeDescriptor>[];
    /** Element Buffer Object for storing vertex indices for indexed rendering */
    private _indexBuffer?;
    /** Ownership flag for the index buffer, see {@link _vertexBufferOwned} */
    private _ownsIndexBuffer;
    /**
     * Map of Vertex Array Objects <{GlProgram.programId}, VAO>
     *  - each VAO is keyed by the shader program ID, since each shader can have different layout and settings
     *  VAO - represents binding of geometry layout with a given shader program
     *  - one VAO is for given GlProgram (not per vertex stream)
     *  - one VAO handles binding of all vertex streams, but for every GlProgram, new VAO should be created since each shader can have different layout
     */
    private readonly _vertexArrays;
    private _instanceBuffer?;
    /**
     * Map of per-instance attribute layouts <{GlProgram.programId}, layout>
     *  - keyed by shader program ID for the same reason as {@link _vertexArrays}: each program
     *    resolves its own attribute locations (and may read a different subset of a shared
     *    instance buffer), so layouts registered for several programs must not overwrite each other
     */
    private readonly _instanceAttributes;
    private _instanceBufferStride;
    private _instancingInitialized;
    /** Ownership flag for the instance buffer, see {@link _vertexBufferOwned} */
    private _ownsInstanceBuffer;
    private drawElementsCall;
    private drawArraysCall;
    private vertexDivisorCall;
    /**
     * @param vertexData Default vertex stream, either raw data (the mesh creates and owns the
     *      GPU buffer) or an existing {@link GlBuffer} to share (the caller keeps ownership)
     * @param indexData Optional index buffer, either raw data (mesh-owned) or a shared {@link GlBuffer}
     * @param dynamic Signals, whether the geometry will be updated frequently or is static
     *      (ignored when a {@link GlBuffer} is passed - its usage was decided on creation)
     */
    constructor(gl: WebGLRenderingContext | WebGL2RenderingContext, vertexData: Float32Array | GlBuffer, indexData?: Uint16Array | GlBuffer, dynamic?: boolean);
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
    render(gl: WebGLRenderingContext | WebGL2RenderingContext, program: GlProgram, primitiveType?: GLenum, numInstances?: number): void;
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
    registerShaderGeometryLayout(gl: WebGLRenderingContext | WebGL2RenderingContext, shaderProgram: GlProgram, vertexAttribLayout: Record<string, Attribute>, vertexStreamIndex?: number): void;
    /**
     * @summary Destructor
     */
    destroy(gl: WebGLRenderingContext | WebGL2RenderingContext): void;
    /**
     * @summary Appends vertex stream to the mesh.
     *      Do not forget to register vertex layout for this stream via {@link registerShaderGeometryLayout} method
     * @param source Either raw vertex data (position, tex. coordinates etc.) - the mesh creates
     *      and owns the GPU buffer - or an existing {@link GlBuffer} to share, in which case the
     *      caller keeps ownership and the mesh will not upload to or destroy it
     * @param dynamic Whether the data will be updated frequently or not (ignored when a
     *      {@link GlBuffer} is passed - its usage was decided on creation)
     * @returns Index of the newly registered vertex stream
     */
    addVertexStream(gl: WebGLRenderingContext | WebGL2RenderingContext, source: Float32Array | GlBuffer, dynamic?: boolean): number;
    /**
     * @summary Dynamically updates content of the given vertex stream. Assumes, that the layout remains the same
     * @param streamIndex Which stream data to update
     * @param vertexData New vertex data
     */
    updateVertexStream(gl: WebGLRenderingContext | WebGL2RenderingContext, streamIndex: number, vertexData: Float32Array): boolean;
    /**
     * @summary Initializes instancing-related methods based on used WebGL context
     *  - if not called explicitly, it is called during instanced rendering (however in that case we don't get the status, whether instancing is available)
     * @returns Status, whether instancing was successfully initialized or whether it failed (extension not supported...)
     */
    initInstancing(gl: WebGL2RenderingContext | WebGLRenderingContext): boolean;
    /**
     * @summary Sets the instance stream and its per-program attribute layout, signalling that
     *          further rendering will be instanced (see the "numInstances" param of {@link render})
     * @param program Shader program used for instanced rendering
     * @param source Either per-instance raw data - the mesh creates and owns the GPU buffer - or
     *          an existing {@link GlBuffer} to share across meshes, in which case the caller keeps
     *          ownership and the mesh will not upload to or destroy it. Each instance record is
     *          assigned to one instance (see "gl.vertexAttribDivisor")
     * @param instanceAttribLayout Per-instance attributes; components (+ optional offset within
     *          the record) map this program's inputs onto the (possibly shared) instance buffer
     * @param strideElements Full instance record stride in components (floats). Required when a
     *          shared {@link GlBuffer} is passed (the mesh cannot infer it from data it did not
     *          upload); for raw data it defaults to the summed components of the layout
     * @returns true/false, whether the setup succeeded (can fail when WebGL2 is not available
     *          together with the 'ANGLE_instanced_arrays' extension being unavailable)
     */
    setInstanceStream(gl: WebGLRenderingContext | WebGL2RenderingContext, program: GlProgram, source: TypedArray | GlBuffer, instanceAttribLayout: Record<string, InstanceAttribute>, strideElements?: number): boolean;
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
     * @summary Resolves the per-instance attribute layout against the given program and stores it.
     *          Each attribute's element offset into the instance record is taken explicitly when
     *          provided, otherwise packed back to back in declaration order.
     */
    private _registerInstanceLayout;
    /**
     * @summary Binds geometry (and index if available) buffer for following operations (e.g. rendering)
     *  - Also used for layout definition when creating VAO {@link GlVertexArray}
     */
    private _bindGeometry;
    /**
     * @summary Performs rendering of the mesh numInstances-times using WebGL2 context or WebGL1 extension
     */
    private _renderInstanced;
    private _updateVertexCount;
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
    /** Ring (annulus) geometry for drawArrays as gl.TRIANGLE_STRIP.
     *  Vertices alternate between the inner and the outer edge around the circle.
     *  Each vertex has 4 components:
     *   - x,y = direction on the unit circle (cosθ, sinθ),
     *   - z = 0 for inner / 1 for outer edge - acts as ring thickness offset flag
     *   - w = -1 for inner / 1 for outer edge - acts as alpha brightness multiplier parameter for smooth edge rendering
     *  - an appropriate vertex layout should be {a_pos: 4}
     */
    static ringMeshTriangleStrip(segments: number): number[];
}
export {};
