import VectorTileLayer from '@arcgis/core/layers/VectorTileLayer';
import { Class, Type } from '@flyxc/common';
import { describe, expect, it } from 'vitest';

import { buildAirspaceVectorTileStyle } from './flat-airspace3d-element';

describe('FlatAirspace3dElement ArcGIS internal API contract', () => {
  it('emits load-style and exposes sourceNameToSource.asp.requestTile on VectorTileLayer', async () => {
    const style = buildAirspaceVectorTileStyle({
      maxAltitude: 3000,
      showClasses: [Class.D],
      showTypes: [Type.CTR],
      opacity: 70,
      date: new Date('2025-07-15T12:00:00Z'),
    });

    const layer = new VectorTileLayer({ style });
    let loadStyleFired = false;
    let hasRequestTile = false;

    (layer as any).on('load-style', () => {
      loadStyleFired = true;
      const source = (layer as any).sourceNameToSource?.asp;
      hasRequestTile = typeof source?.requestTile === 'function';
    });

    await layer.loadStyle(style);

    expect(loadStyleFired).toBe(true);
    expect(hasRequestTile).toBe(true);

    layer.destroy();
  });
});
