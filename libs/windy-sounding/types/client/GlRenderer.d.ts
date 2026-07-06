import { GlProgram, GlslDataType, type GlMesh } from '@windy/glUtils';
import type { UniformDataType, UniformRecord } from '@windy/glUtils.d';
import type { MapLibreMap as MaplibreGlMap } from '@leafletGl';
import type { Vector4 } from '@windy/math';
/**
 * @class WebGL renderer abstraction class
 *        - class the should provide simple setup and usage of WebGL renderer
 */
export declare class GlRenderer {
  private ident;
  protected static numRenderers: number;
  /** List of meshes to be rendered by the renderer */
  protected readonly meshes: GlMesh[];
  /** Map of uniform variables used for rendering */
  protected readonly uniforms: Map<string, UniformRecord>;
  /** Set of uniform ids which values recently changed and therefore should be re-uploaded to the GPU */
  protected readonly dirtyUniforms: Set<string>;
  /** Textures must be treated separately since they must be bound each frame */
  protected readonly uniformTextures: Map<string, UniformRecord>;
  /** Program used for rendering */
  protected program: GlProgram;
  protected renderReady: boolean;
  /** Color used to clear the bound framebuffer before rendering the content */
  protected clearColor?: Vector4;
  protected readonly rendererId: number;
  constructor(ident: string);
  /**
   * @summary Resets renderer instance counter on plugin cleanup, used for debugging
   */
  static reset(): void;
  /**
   * @summary Initializes the renderer together with creating its shader program using the already fetched shader sources (strings)
   * @param vsSrc String with source code of the Vertex Shader
   * @param fsSrc String with source code of the Fragment Shader
   */
  initFromSources(gl: WebGLRenderingContext | WebGL2RenderingContext, vsSrc: string, fsSrc: string): void;
  /**
   * @summary Rerenders content into the currently bound framebuffer
   * @param primitiveType Which primitives to draw (points, lines, triangles,..)
   * @param numInstances If set >0, geometry is rendered as N instances
   */
  render(gl: WebGLRenderingContext | WebGL2RenderingContext, primitiveType?: GLenum, numInstances?: number): void;
  /**
   * @summary Updates value of the given uniform (global value sent to the GPU)
   * @param uniformId Which uniform to update
   * @param value New uniform value
   */
  updateUniformValue(uniformId: string, value: UniformDataType): void;
  /**
   * @summary Registers new uniform value to be used during rendering (uniform must be defined in the shader)
   * @param uniformId Name of the uniform variable in the shader code
   * @param dataType Data type of the uniform variable
   * @returns {boolean} Whether the uniform was successfully registered or not
   *  - it can fail, for example, when the passed uniformId does not match its name defined in the program
   *      (or simply when it is not defined in the program)
   *
   */
  registerUniformRecord(
    gl: WebGLRenderingContext | WebGL2RenderingContext,
    uniformId: string,
    dataType: GlslDataType,
    defaultValue?: UniformDataType,
  ): boolean;
  /**
   *  @summary Checks whether the uniform record is already registered (to prevent multi registering)
   */
  isUniformRecordRegistered(uniformId: string): boolean;
  /**
   * @summary Adds mesh to the list of meshes to be rendered
   * @param mesh
   */
  addMesh(mesh: GlMesh): void;
  /**
   * @summary Retrieves shader program owned by the renderer
   */
  getAttachedShader(): GlProgram;
  destroy(gl: WebGLRenderingContext | WebGL2RenderingContext, map?: MaplibreGlMap): void;
  /**
   * @summary Sets color used for clearing the framebuffer
   * @param color Values in range <0.0, 1.0>, if undefined, the color is unset
   */
  setClearColor(color: Vector4 | undefined): void;
  /**
   * @summary Clears the framebuffer with previously set clear-color
   */
  clear(gl: WebGLRenderingContext | WebGL2RenderingContext): void;
  /**
   * @summary Binds dirty uniform variables for rendering
   *  - dirty uniform is when its value has changed and must be re-uploaded to the GPU
   *  - when value does not change, there is no need to upload it in every frame
   */
  protected bindUniforms(gl: WebGLRenderingContext | WebGL2RenderingContext): void;
  /**
   * @summary Binds all textures that are registered in the shader for rendering
   *  - texture uniforms (more specifically texture units and textures) must be bound for every frame since it changes global WebGL state
   *  - texture unit id uniform is already set by "bindUniforms" method (this does not have to be updated each frame in case the texture unit does not change)
   *  - texture activation and binding must be preformed each frame (in case we are using multiple programs because texture binding changes global WebGL state)
   */
  private bindTextures;
}
