import { SveltePlugin } from '@windy/SveltePlugin';
import type { WindowPluginInitParams } from '@windy/WindowPlugin';
import type { SveltePopupPlugins } from '@windy/plugins.d';
export type SveltePopupPluginInitParams<P extends keyof SveltePopupPlugins> = Omit<WindowPluginInitParams<P>, 'ident'> & Pick<SveltePopupPlugin<P>, 'ident'> & Partial<SveltePopupPlugin<P>>;
/**
 * Common popup plugin that appears centered on desktop (with box-shadow, border-radius, fade-in)
 * and as a bottom slide on mobile devices.
 */
export declare class SveltePopupPlugin<P extends keyof SveltePopupPlugins> extends SveltePlugin<P> {
    ident: P;
    constructor(params: SveltePopupPluginInitParams<P>);
}
