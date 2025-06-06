import type { Canvas, ExtendedWebGLTexture, WebGLProgramObject } from './d.ts.files/GlObj.d';
/**
 * GLObj - Web GL context wrapper
 */
declare class GLObj {
  /**
   * Little endianess
   */
  static littleEndian: boolean;
  /**
   * newId for new instance
   */
  static newId: number;
  /**
   * New id for gl context
   */
  static newGlId: number;
  /**
   * id for instances comparison
   */
  id: number;
  /**
   * Gl context id for comparison
   */
  glId: number;
  /**
   * Stored param MAX_TEXTURE_SIZE from last gl context
   */
  maxTextureSize: number;
  /**
   * Name for debug purposes
   */
  _name?: string;
  /**
   * store WebGL objects references in own arrays
   */
  keepRefs: boolean;
  /**
   * store reference for vertex and pixel shaders
   */
  keepRefsShaders: boolean;
  /**
   * arrays for reference storing
   */
  framebuffers: WebGLFramebuffer[];
  buffers: WebGLBuffer[];
  shaders: WebGLShader[];
  programs: WebGLProgram[];
  textures: ExtendedWebGLTexture[];
  /**
   * web gl context
   */
  _gl: null | WebGLRenderingContext;
  /**
   * associated HTMLCanvasElement
   */
  canvas: null | Canvas;
  /**
   * Last result of checkGlError()
   */
  isGlError: boolean;
  /**
   * Last error message generated by checkGlError()
   */
  lastGlErrorMsg: string;
  constructor(keepRefs?: boolean, keepRefsShaders?: boolean);
  /**
   * reset all
   */
  reset(): void;
  /**
   * create webGl rendering context on given canvas
   *
   * @param canvas HTMLCanvasElement
   * @param flags contextAttributes
   * @param name context name for debug purposes
   */
  create(canvas: Canvas, flags: WebGLContextAttributes, name?: string): void | WebGLRenderingContext | null;
  /**
   * Rets true if canvas or webgl context is NOT valid
   */
  isInvalid(): boolean;
  /**
   * Get WebGLRendering context. If it is null we consider the error was thrown earlier
   */
  gl(): WebGLRenderingContext | null;
  /**
   * !DEPRECATED!
   */
  get(): WebGLRenderingContext | null;
  getCanvas(): Canvas | null;
  /**
   * Create shader and compile source
   *
   * @param source .. shader source string
   * @param isVertexShader .. shader type (true .. gl.VERTEX_SHADER, false .. gl.FRAGMENT_SHADER)
   * @param name .. name of shader
   * @returns shader
   */
  createShader(source: string, isVertexShader: boolean, name?: string): WebGLShader | null;
  /**
   * create shader program (compile and link vertex and fragment sources and loop through attributes and uniforms )
   *
   * @param vertexSource .. shader source string
   * @param fragmentSource .. shader source string
   * @param defs .. array of #define strings
   * @param name .. optional shader name
   * @returns Object { program, <attributes names>, <uniforms names> };
   */
  createProgramObj(
    vertexSource: string,
    fragmentSource: string,
    defs?: string[] | null,
    name?: string,
  ): WebGLProgramObject | null;
  /**
   * delete shader program
   */
  deleteProgramObj(program: WebGLProgram): void;
  /**
   * bind attribute (source of vertex data) to shader program (set before)
   *
   * @param buffer .. vertex buffer
   * @param attribute .. attribute index in shader program
   * @param numComponents ..attribute vector component <1;4>
   * @param type .. (gl.UNSIGNED_BYTE, gl.SHORT, gl.UNSIGNED_SHORT, gl.FLOAT)
   * @param normalized .. normalize fixed-point data (gl.TRUE, gl.FALSE)
   * @param stride ..in bytes between the beginning of consecutive vertex attributes (vertex size in bytes)
   * @param offset ..in bytes of the first component in the vertex attribute array. Must be a multiple of type.
   */
  bindAttribute(
    buffer: WebGLBuffer | null,
    attribute: GLuint,
    numComponents: GLint,
    type: GLenum,
    normalized: GLboolean,
    stride: GLsizei,
    offset: GLintptr,
  ): void;
  /**
   * Loads texture from url
   * @param name texture name
   * @param url Texture URL
   * @param minFilter Min-filter
   * @param magFilter Mag-filter
   * @param wrap texture wrap S and texture wrap T
   * @param genMips generate mipmaps?
   */
  textureFromUrlPromise<K extends string>(
    name: K,
    url: string,
    minFilter: GLint,
    magFilter: GLint,
    wrap: GLenum,
    genMips: boolean,
  ): Promise<[K, ExtendedWebGLTexture | null]>;
  /**
   * Loads texture from base64 image (async! may be delayed)
   *
   * @param minFilter ?????
   * @param magFilter ?????
   * @param wrap ?????
   * @param base64 ?????
   * @param genMips ?????
   * @returns gl texture object
   */
  createTextureFromBase64(
    minFilter: GLenum,
    magFilter: GLenum,
    wrap: GLenum,
    base64: string,
    genMips: boolean,
  ): ExtendedWebGLTexture | null;
  /**
   * create 2D texture
   *
   * @param minFilter .. gl.NEAREST, gl.LINEAR, gl.NEAREST_MIPMAP_NEAREST, gl.LINEAR_MIPMAP_NEAREST, gl.NEAREST_MIPMAP_LINEAR, gl.LINEAR_MIPMAP_LINEAR
   * @param magFilter .. gl.NEAREST, gl.LINEAR
   * @param wrap .. gl.CLAMP_TO_EDGE, gl.REPEAT, gl.MIRRORED_REPEAT
   * @param data .. Uint8Array or imageData
   * @param width .. dimensions for Uint8Array data
   * @param height .. dimensions for Uint8Array data
   * @param format .. gl.RGBA, gl.RGB, gl.LUMINANCE_ALPHA, gl.LUMINANCE, gl.ALPHA
   * @param genMips .. true/false generate mipmap chain (sizes must be power of 2)
   * @description texImage2D: https://developer.mozilla.org/en/docs/Web/API/WebGLRenderingContext/texImage2D
   */
  createTexture2D(
    minFilter: GLenum,
    magFilter: GLenum,
    wrap: GLenum,
    data: TexImageSource | ArrayBufferView | (TexImageSource | ArrayBufferView)[] | null,
    width: GLsizei,
    height: GLsizei,
    format?: GLenum,
    genMips?: boolean,
  ): ExtendedWebGLTexture | null;
  /**
   * resize existing 2D texture
   *
   * @param texture .. existing 2D texture
   * @param data .. Uint8Array or imageData or Array of mips (Uint8Array)
   * @param width .. dimensions for Uint8Array data
   * @param height .. dimensions for Uint8Array data
   * @param format .. gl.RGBA, gl.RGB, gl.LUMINANCE_ALPHA, gl.LUMINANCE, gl.ALPHA
   * @param genMips .. true/false generate mipmap chain
   * @description texImage2D: https://developer.mozilla.org/en/docs/Web/API/WebGLRenderingContext/texImage2D
   */
  resizeTexture2D(
    texture: ExtendedWebGLTexture | null,
    data: TexImageSource | ArrayBufferView | (TexImageSource | ArrayBufferView)[] | null,
    width: GLsizei,
    height: GLsizei,
    format?: GLenum,
    genMips?: boolean,
  ): ExtendedWebGLTexture | null;
  /**
   * delete 2D texture object
   */
  deleteTexture2D(texture: WebGLTexture): void;
  /**
   * activate texture and bind it to sampler unit
   *
   * @param texture .. previously created 2D texture
   * @param unit .. index of sampler unit
   * @param shaderVar .. optional shader uniform sampler2D variable
   */
  bindTexture2D(texture: WebGLTexture | null, unit?: GLenum, shaderVar?: WebGLUniformLocation | null): void;
  /**
   * set texture filter and wrap params (bind texture before by bindTexture2D)
   *
   * @param minFilter .. gl.LINEAR, gl.NEAREST, gl.NEAREST_MIPMAP_NEAREST, gl.LINEAR_MIPMAP_NEAREST, gl.NEAREST_MIPMAP_LINEAR (default value), gl.LINEAR_MIPMAP_LINEAR
   * @param magFilter .. gl.LINEAR (default value), gl.NEAREST
   * @param wrapS .. gl.REPEAT (default value),gl.CLAMP_TO_EDGE, gl.MIRRORED_REPEAT
   * @param wrapT .. gl.REPEAT (default value),gl.CLAMP_TO_EDGE, gl.MIRRORED_REPEAT
   */
  setBindedTexture2DParams(minFilter: GLenum, magFilter: GLenum, wrapS: GLenum, wrapT?: GLenum): void;
  /**
   * create vertex (attributes source) buffer from data
   *
   * @param data .. ArrayBuffer, SharedArrayBuffer or ArrayBufferView; will be copied into the data store
   */
  createBuffer(data: BufferSource): WebGLBuffer | null;
  /**
   * delete vertex or index buffer
   */
  deleteBuffer(buffer: WebGLBuffer): void;
  /**
   * @param buffer .. created vertex buffer
   * @param data .. ArrayBuffer, SharedArrayBuffer or ArrayBufferView; will be copied into the data store
   */
  setBufferData(buffer: WebGLBuffer, data: BufferSource): void;
  /**
   * create indices buffer from data
   *
   * @param data .. ArrayBuffer, SharedArrayBuffer or ArrayBufferView; will be copied into the data store
   */
  createIndexBuffer(data: BufferSource): WebGLBuffer | null;
  createFramebuffer(): WebGLFramebuffer | null;
  /**
   * delete Framebuffer
   */
  deleteFramebuffer(framebuffer: WebGLFramebuffer): void;
  /**
   * bind or unbind framebuffer
   *
   * @param framebuffer .. or null for unbind
   * @param texture .. compatible 2D texture
   */
  bindFramebuffer(framebuffer: WebGLFramebuffer | null, texture?: WebGLTexture | null): void;
  /**
   * release all GL resources and reset
   */
  release(): void;
  /**
   * Sets this.isGlError and this.lastGlErrorMsg
   * @returns isGlError: boolean
   */
  checkGlError(): boolean;
  /**
   * Checks WebGL status and returns message
   * @returns lastGlErrorMsg: string
   */
  getGlStatus(): string;
  /**
   * get next greater size which is power of 2
   * (ex: 11 >>> 16, 17 >>> 32, ... )
   */
  static getNextPowerOf2Size(size: number): number;
  /**
   * remove object from array (Array.findIndex() not supported by all browsers)
   */
  static removeFromArray<T = WebGLFramebuffer | WebGLBuffer | WebGLProgram | WebGLShader | ExtendedWebGLTexture>(
    o: T,
    a: T[],
  ): number;
}
export default GLObj;
