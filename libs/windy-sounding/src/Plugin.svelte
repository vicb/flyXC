<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { openPlugin, mountPlugin, destroyPlugin } from './sounding';
  import type { LatLon } from '@windycom/plugin-devtools/types/interfaces';
  import { pluginConfig } from './config';
  import flyxcIcon from './img/jumoplane.svg';

  let pluginElement: any;
  const { isMobileOrTablet } = W.rootScope;

  export const onopen = (ll?: LatLon) => {
    openPlugin(ll);
  };

  onMount(() => {
    mountPlugin(pluginElement);
  });

  onDestroy(() => {
    destroyPlugin();
  });

  function openMenu(e: KeyboardEvent | MouseEvent) {
    if (!('key' in e) || e.key == 'Enter') {
      W.broadcast.emit('rqstOpen', 'menu');
    }
  }
</script>

{#if isMobileOrTablet}
  <section class="plugin__content mobile">
    <div id="wsp-sounding" bind:this={pluginElement}></div>
    <div class="sponsor" style="text-align:center; padding-top: 1em">
      <a href="https://www.buymeacoffee.com/vic.b" target="_blank"
        ><img
          src="https://cdn.buymeacoffee.com/buttons/default-orange.png"
          alt="Buy Me A Coffee"
          height="35"
          width="145"
          style="display: inline-block"
        /></a
      >
    </div>
  </section>
{:else}
  <section class="plugin__content">
    <div
      class="plugin__title plugin__title--chevron-back"
      on:click={openMenu}
      on:keydown={openMenu}
      role="button"
      tabindex="0"
    >
      <img id="wsp-icon" src={flyxcIcon} width="30" height="30" alt="flyXC" />{pluginConfig.title}
    </div>
    <div id="wsp-sounding" bind:this={pluginElement}></div>
    <div class="sponsor">
      <p>Sponsor the development of this plugin</p>
      <a href="https://www.buymeacoffee.com/vic.b" target="_blank"
        ><img
          src="https://cdn.buymeacoffee.com/buttons/default-orange.png"
          alt="Buy Me A Coffee"
          height="41"
          width="174"
        /></a
      >
    </div>
  </section>
{/if}
