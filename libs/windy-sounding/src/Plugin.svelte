<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { openPlugin, mountPlugin, destroyPlugin } from './sounding';
  import { loadSetting, Settings } from './util/settings';

  let pluginElement: HTMLElement;

  export const onopen = (parameters: any) => {
    // Legacys URL do not have the model.
    // old format /:lat/:lon
    // new format /:model/:lat/:lon
    const isNumeric = (value: string) => value as any == parseFloat(value);
    if (isNumeric(parameters?.modelName) && isNumeric(parameters?.lat)) {
      [parameters.lat, parameters.lon, parameters.modelName] = [parameters.modelName, parameters.lat, W.store.get('product')];
    }

    let lat = parameters?.lat;
    let lon = parameters?.lon;

    if (lat === undefined || lon === undefined) {
      try {
        const location = JSON.parse(loadSetting(Settings.location));
        lat = location.lat;
        lon = location.lon;
      } catch {
        // empty
      }
    }

    const mapCenter = W.map.map.getCenter();
    lat = Number(lat ?? mapCenter.lat);
    lon = Number(lon ?? mapCenter.lng);
    const modelName = parameters?.modelName ?? loadSetting(Settings.model) ?? W.store.get('product');
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
