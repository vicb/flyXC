import type { Vector2, Vector3, Vector4 } from '@windy/math';
import type { GlTexture } from '@windy/GlTexture';
import type { GlslDataType } from '@windy/glUtils';

export interface UniformRecord {
    uniformId: string; // uniform identifier inside fragment shader
    uniformLocation: WebGLUniformLocation | null; // bound uniform location
    glDataType: GlslDataType;
    value: UniformDataType;
}

/**
 * Combined type of all possible numeric typed arrays in javascript
 */
export type TypedArray =
    | Uint8Array
    | Uint8ClampedArray
    | Uint16Array
    | Uint32Array
    | Int8Array
    | Int16Array
    | Int32Array
    | Float32Array
    | Float64Array;

export type UniformDataType =
    | Float32List
    | Vector4
    | Vector3
    | Vector2
    | GlTexture
    | WebGLTexture
    | number
    | undefined
    | null;

export type Gl2ColorFormat = WebGL2RenderingContextBase['RG8'] | WebGL2RenderingContextBase['R8'];

export type GlColorFormat =
    | WebGLRenderingContextBase['ALPHA']
    | WebGLRenderingContextBase['RGB']
    | WebGLRenderingContextBase['RGBA']
    | WebGLRenderingContextBase['LUMINANCE']
    | WebGLRenderingContextBase['LUMINANCE_ALPHA']
    | Gl2ColorFormat;

// https://developer.mozilla.org/en-US/docs/Web/API/EXT_disjoint_timer_query
interface TimerQueryBase {
    QUERY_COUNTER_BITS_EXT: GLenum;
    CURRENT_QUERY_EXT: GLenum;
    QUERY_RESULT_EXT: GLenum; // GLuint64EXT
    QUERY_RESULT_AVAILABLE_EXT: GLenum;
    TIME_ELAPSED_EXT: GLenum;
    TIMESTAMP_EXT: GLenum;
    GPU_DISJOINT_EXT: GLenum;
    createQueryEXT: () => WebGLQuery;
    deleteQueryEXT: (query: WebGLQuery) => void;
    isQueryEXT: (query: WebGLQuery) => GLboolean;
    beginQueryEXT: (target: GLenum, query: WebGLQuery) => void;
    endQueryEXT: (target: GLenum) => void;
    queryCounterEXT: (target: GLenum, query: WebGLQuery) => void;
    getQueryEXT: (target: GLenum, pname: GLenum) => WebGLQuery | GLint;
}

export interface EXT_disjoint_timer_query extends TimerQueryBase {
    getQueryObjectEXT: (query: WebGLQuery, pname: GLenum) => GLuint64 | GLboolean;
}

export interface EXT_disjoint_timer_query_webgl2 extends TimerQueryBase {
    getQueryParameter: (query: WebGLQuery, pname: GLenum) => GLuint64 | GLboolean;
}
