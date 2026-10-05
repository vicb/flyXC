type Shaders = 'vTileTextureBlit' | 'vScreenQuad' | 'fTileTextureBlit' | 'fTextureDebug' | 'fTextureBlit' | 'fTileLayerPreprocess' | 'fTileLayerPtypePreprocess';
/**
 * @class Shader source storage for different WebGL contexts
 *  - we aim for using WebGL1 shaders where possible to minimize duplicate code, unless we need some WebGL2-specific features
 *  - therefore we use WebGL1 sources also in case of WebGL2 context, but it can be overridden in case it is necessary
 */
export declare const shaderStorage: Record<'WGL2' | 'WGL1', Record<Shaders, string>>;
export {};
