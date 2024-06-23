<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { openPlugin, mountPlugin, destroyPlugin } from './sounding';

  let pluginElement: HTMLElement;

  export const onopen = (parameters: any) => {
    const mapCenter = W.map.map.getCenter();
    const lat = Number(parameters?.lat ?? mapCenter.lat);
    const lon = Number(parameters?.long ?? mapCenter.lng);
    const modelName = parameters?.modelName ?? 'ecmwf';
    openPlugin({ lat, lon, modelName });
  };

  onMount(() => {
    mountPlugin(pluginElement);
  });

  onDestroy(() => {
    destroyPlugin();
  });


</script>

<section class="plugin__content" bind:this={pluginElement}></section>
