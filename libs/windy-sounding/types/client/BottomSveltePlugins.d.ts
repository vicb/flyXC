import { SveltePlugin } from '@windy/SveltePlugin';
import type { SveltePluginInitParams } from '@windy/SveltePlugin';
import type { BottomSveltePlugins } from '@windy/plugins.d';
export type BottomSveltePluginInitParams<P extends keyof BottomSveltePlugins> = Omit<
  SveltePluginInitParams<P>,
  'ident'
> &
  Pick<BottomSveltePlugin<P>, 'ident'>;
export declare class BottomSveltePlugin<P extends keyof BottomSveltePlugins> extends SveltePlugin<P> {
  ident: P;
  constructor(params: BottomSveltePluginInitParams<P>);
}
