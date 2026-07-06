import { SveltePlugin } from '@windy/SveltePlugin';
import type { SveltePluginInitParams } from '@windy/SveltePlugin';
import type { StartupElementPlugins } from '@windy/plugins.d';
export type StartupElementPluginInitParams<P extends keyof StartupElementPlugins> = Omit<SveltePluginInitParams<P>, 'ident'> & Pick<StartupElementPlugin<P>, 'ident'>;
export declare class StartupElementPlugin<P extends keyof StartupElementPlugins> extends SveltePlugin<P> {
    ident: P;
    constructor(params: StartupElementPluginInitParams<P>);
}
