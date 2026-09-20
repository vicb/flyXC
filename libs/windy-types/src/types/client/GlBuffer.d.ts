import type { TypedArray } from '@windy/glUtils.d';
export declare enum GlBufferType {
    VERTEX,
    INDEX
}
export declare enum GlBufferUsage {
    STATIC,
    DYNAMIC
}
/**
 * @class A wrapper class over WebGLBuffer
 */
export declare class GlBuffer {
    private static idCounter;
    /** Reference to the WebGL buffer on the GPU */
    protected readonly buffer: WebGLBuffer;
    protected type: GlBufferType;
    /** Length of uploaded data array in the buffer */
    protected _dataLength: number;
    /** Class instance unique id, for debug, tracks number of created instances */
    protected readonly bufferId: number;
    constructor(gl: WebGLRenderingContext | WebGL2RenderingContext, type: GlBufferType);
    /**
     * @summary Resets buffer instance counter on plugin cleanup, used for debugging
     */
    static reset(): void;
    /**
     * @summary Binds buffer for subsequent operations
     */
    bind(gl: WebGLRenderingContext | WebGL2RenderingContext): void;
    /**
     * @summary Unbinds the buffer
     */
    unbind(gl: WebGLRenderingContext | WebGL2RenderingContext): void;
    /**
     * @summary Updates data in the GPU buffer
     * @param data Data to be uploaded to the GPU buffer
     * @param usage Buffer update frequency (how the buffer will be updated)
     */
    update(gl: WebGLRenderingContext | WebGL2RenderingContext, data: TypedArray, usage?: GlBufferUsage): void;
    /** @summary Returns number of elements inside the buffer */
    get length(): number;
    /** @summary Deletes the WebGL buffer */
    destroy(gl: WebGLRenderingContext | WebGL2RenderingContext): void;
}
