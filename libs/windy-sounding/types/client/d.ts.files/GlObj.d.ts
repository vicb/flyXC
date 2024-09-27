import type { Texture2D } from 'plugins/_shared/gl-lib/gl-lib';
import type { Mat2, Mat2d, Mat3, Mat4, Quat, Quat2, Vec2, Vec3, Vec4 } from '@plugins/globe/gl-matrix/types';

export interface CustomError extends Error {
  contextLost?: boolean;
  isVertexShader?: boolean;
  name: string;
  full?: string;
}

// export type WebGLProgramObject = {
//     [whatever: string]: any;
// };

export type UniformName = `u${string}`;

export type AttributeName = `a${string}`;

export type SamplerName = `s${string}`;

export type WebGLProgramAttributes = {
  [attribute: AttributeName]: number;
};

export type WebGLProgramUniforms = {
  [uniform: UniformName]: WebGLUniformLocation | null;
  [sampler: SamplerName]: WebGLUniformLocation | null;
};

export type WebGLProgramParams = WebGLProgramAttributes & WebGLProgramUniforms;

export type AnyUniform = number | Vec2 | Vec3 | Vec4 | Mat2 | Mat2d | Mat3 | Mat4 | Quat | Quat2;

export type ShaderPars = {
  uVPars0?: Vec4;
  uVPars1?: Vec4;
  uVPars2?: Vec4;

  uMatRot?: Mat3;

  uPars0?: Vec4;
  uPars1?: Vec4;
} & {
  [uniform: UniformName]: AnyUniform;
  [uniform: SamplerName]: Texture2D | WebGLTexture | null;
};

export type WebGLProgramObject = {
  program: WebGLProgram | null;
  aPos?: number;
  variantI?: number; // property added in VisualizerShader.compile()
} & WebGLProgramParams;

export interface ExtendedWebGLTexture extends WebGLTexture {
  _width?: GLsizei;
  _height?: GLsizei;
  _format?: GLenum;
}

/**
 * Canvas as HTML element with added properties
 */
//  export interface Canvas extends HTMLCanvasElement {
//     cssWidth: number;
//     cssHeight: number;
//     cssHeightInner: number;
//     pxRatio: number;
//     heightInner: number;
// }

export type HTMLCanvasExtended = HTMLCanvasElement & {
  cssWidth: number;
  cssHeight: number;
  cssHeightInner: number;
  pxRatio: number;
  heightInner: number;
};

/**
 * HTML canvas element or HTML canvas element with added properties
 */
export type Canvas = HTMLCanvasElement | HTMLCanvasExtended;
