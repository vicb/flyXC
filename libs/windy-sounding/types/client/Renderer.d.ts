import type { FullRenderParameters } from './d.ts.files/Layer.d';
import type { Renderers, AllowedUserControls, AllowedRenderPlugins, RendererInitParams } from './d.ts.files/Renderer.d';
import type { InterpolatorFactory } from './d.ts.files/interpolator';
/**
 * Renderer class act as a proxy between renderController and code, which is responsible to
 * render particullar layer.
 */
export declare class Renderer<
  K extends keyof AllowedRenderPlugins | undefined = undefined,
  P extends K extends keyof AllowedRenderPlugins
    ? WPluginModules[`@plugins/${K}`]
    : undefined = K extends keyof AllowedRenderPlugins ? WPluginModules[`@plugins/${K}`] : undefined,
> {
  isOpen: boolean;
  /**
   * Ident of renderer. Not used in runtime, but essential for debugging.
   * Do not remove
   */
  ident: Renderers;
  /**
   * Dependency plugin that wil be loaded before renderer is launched
   *
   * Dependency plugin can optinally export these methods:
   *
   *  - onRenderStart
   *  - onRenderEnd
   *  - paramsChanged
   *  - redraw
   *  - interpolator
   */
  dependency?: K;
  /**
   * Loaded version of plugin dependency
   */
  loadedDependency?: P;
  /**
   * ID of plugin, that serve as user control, which can be attached to DOM
   * usually to #plugin-bottom div.
   *
   * Contrary to dependencies, userControl is loaded after dependencies, thus NOT
   * delaying launch of whole layer.
   *
   * Any single plugin can serve both as renderer and userControl.
   *
   * In this case, make sure, that plugin, that serves as userControl
   * is duplicated as dependency.
   *
   * userControl opening and closing is handles by rndrCtrl
   */
  userControl?: AllowedUserControls;
  /**
   * Picker ingerpolation factory
   */
  interpolator?: InterpolatorFactory;
  constructor(params: RendererInitParams);
  open(params: FullRenderParameters): Promise<void>;
  /**
   * Called by rndrCtrl
   * list of required renderers, so we kno who will replace us
   */
  close(_rqrdRenderers: Renderers[]): void;
  onopen(params: FullRenderParameters): void;
  onclose(): void;
  paramsChanged(params: FullRenderParameters): void;
  redraw(): void;
}
