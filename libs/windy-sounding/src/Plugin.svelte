<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { openPlugin, mountPlugin, destroyPlugin } from './sounding';

  let pluginElement: HTMLElement;

  export const onopen = (parameters: any) => {
    // Legacys URL do not have the model.
    // old format /:lat/:lon
    // new format /:model/:lat/:lon
    const isNumeric = (value: string) => value as any == parseFloat(value);
    if (isNumeric(parameters?.modelName) && isNumeric(parameters?.lat)) {
      parameters.lon = parameters.lat;
      parameters.lat = parameters.model;
      parameters.model = 'ecmwf';
    }

    const mapCenter = W.map.map.getCenter();
    const lat = Number(parameters?.lat ?? mapCenter.lat);
    const lon = Number(parameters?.lon ?? mapCenter.lng);
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
