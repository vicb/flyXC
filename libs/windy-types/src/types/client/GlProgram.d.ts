/**
 * @class A wrapper class for WebGLProgram
 *        - used for creating shader programs (compilation of shaders, linking of shader programs etc.)
 */
export declare class GlProgram {
    private static numPrograms;
    private _program;
    /** Class instance unique id, tracks number of created instances */
    private _programId;
    private _programName;
    private constructor();
    /**
     * @summary Resets program instance counter on plugin cleanup, used for debugging
     */
    static reset(): void;
    /**
     * @returns Unique program id
     */
    get programId(): number;
    /**
     * @summary Creates shader program from shader sources in strings (vertex and fragment shader source codes)
     * @param vertexShaderSourceCode String with VS shader code
     * @param fragmentShaderSourceCode String with FS shader code
     * @param name String with program name, required for proper error reporting
     * @returns {GlProgram} Created GlProgram instance
     * @throws {GlError} When shader compilation fails or program linking fails
     */
    static constructWithSources(gl: WebGLRenderingContext, vertexShaderSourceCode: string, fragmentShaderSourceCode: string, name: string): GlProgram;
    /**
     * @summary Sets the program as current for rendering
     */
    use(gl: WebGL2RenderingContext | WebGLRenderingContext): void;
    /**
     * @returns {WebGLProgram} WebGLProgram handle (id)
     */
    getProgram(): WebGLProgram;
    /**
     * @summary Safely deletes the shader program including its shaders
     */
    destroy(gl: WebGL2RenderingContext | WebGLRenderingContext): void;
}
