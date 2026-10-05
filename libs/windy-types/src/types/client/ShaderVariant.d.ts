import type { CustomRenderMethodInput } from '@leafletGl';
export type ShaderRecord<T extends string> = {
    program: WebGLProgram;
    uniformLocations: {
        [K in T]: WebGLUniformLocation | null;
    };
    mainAttribLocation: number;
};
export type ShaderDescription = {
    projectionVariantData: CustomRenderMethodInput['shaderData'];
    customDefines: string;
};
export declare class ShaderVariant<T extends string> {
    private _sourceVertex;
    private _sourceFragment;
    private _uniforms;
    private _variants;
    constructor(vs: string, fs: string, uniforms: ReadonlyArray<T>);
    getShader(gl: WebGLRenderingContext | WebGL2RenderingContext, shaderDescription: ShaderDescription): ShaderRecord<T> | null;
    destroy(gl: WebGLRenderingContext | WebGL2RenderingContext): void;
    private _createShader;
}
