/**
 * @class Shader source storage for different WebGL contexts
 *  - we aim for using WebGL1 shaders where possible to minimize duplicate code, unless we need some WebGL2-specific features
 *  - therefore we use WebGL1 sources also in case of WebGL2 context, but it can be overridden in case it is necessary
 */
export declare class ShaderStorage {
  static WGL2: {
    vTileTextureBlit: string;
    vScreenQuad: string;
    fTileTextureBlit: string;
    fTextureDebug: string;
    fTextureBlit: string;
    fTileLayerPreprocess: string;
    fTileLayerPtypePreprocess: string;
  };
  static WGL1: {
    vTileTextureBlit: string;
    vScreenQuad: string;
    fTileTextureBlit: string;
    fTextureDebug: string;
    fTextureBlit: string;
    fTileLayerPreprocess: string;
    fTileLayerPtypePreprocess: string;
  };
}
