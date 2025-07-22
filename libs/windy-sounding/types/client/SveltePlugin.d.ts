import { WindowPlugin } from '@windy/WindowPlugin';
import type { WindowPluginInitParams } from '@windy/WindowPlugin';
import type { PluginsOpenParams, PluginsQsParams } from '@windy/plugin-params.d';
import type { BottomSveltePlugins, SveltePanePlugins, SveltePlugins } from '@windy/plugins.d';
import type { InterpolatorFactory } from '@windy/interpolator';
import type { FullRenderParameters } from '@windy/Layer.d';
export declare class SvelteApp<P extends keyof SveltePlugins | keyof SveltePanePlugins | keyof BottomSveltePlugins> {
  interpolator?: InterpolatorFactory;
  constructor(_args: { target: HTMLElement; anchor: HTMLElement });
  onopen(params?: PluginsOpenParams[P], qs?: PluginsQsParams[P]): void;
  onclose(): void;
  paramsChanged(params?: FullRenderParameters): void;
  onRenderStart(params?: FullRenderParameters): void;
  $destroy(): void;
}
/**
 * Same as SvelteApp type, but without any information, about required
 * types for params & qs
 */
export declare class ExternalSvelteApp {
  constructor(_args: { target: HTMLElement; anchor: HTMLElement });
  onopen(params?: unknown, qs?: unknown): void;
  onclose(): void;
  $destroy(): void;
}
/** Allowed params to SveltePlugin constructor (private and protected props are omited by default) */
export type SveltePluginInitParams<
  P extends keyof SveltePlugins | keyof SveltePanePlugins | keyof BottomSveltePlugins,
> = Omit<WindowPluginInitParams<P>, 'ident'> & Pick<SveltePlugin<P>, 'ident'> & Partial<SveltePlugin<P>>;
export declare class SveltePlugin<
  P extends keyof SveltePlugins | keyof SveltePanePlugins | keyof BottomSveltePlugins,
> extends WindowPlugin<P> {
  /**
   * Holder of SvelteApp
   */
  svelteApp?: SvelteApp<P> | ExternalSvelteApp | null;
  needsPluginRoot?: boolean;
  ident: P;
  plugin: WPluginModules[`@plugins/${P}`] & AdditionalSvelteAssets;
  constructor(
    params: WindowPluginInitParams<P> & {
      needsPluginRoot?: boolean;
    },
  );
  onopen(params?: PluginsOpenParams[P], _qs?: PluginsQsParams[P]): void;
  ondestroy(): void;
  paramsChanged(params?: FullRenderParameters): void;
  onRenderStart: (params?: FullRenderParameters) => void;
  protected mount(): void;
  protected unmount(): void;
}
