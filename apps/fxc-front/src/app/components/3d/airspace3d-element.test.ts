// @ts-expect-error Internal ArcGIS style evaluator without type declarations
import StyleRepository from '@arcgis/core/views/2d/engine/vectorTiles/style/StyleRepository.js';
import type { ArcgisScene } from '@arcgis/map-components/components/arcgis-scene';
import { TZDate } from '@date-fns/tz';
import {
  airspaceOverrides,
  ASP_COLOR_DANGER,
  ASP_COLOR_OTHER,
  ASP_COLOR_PROHIBITED,
  ASP_COLOR_RESTRICTED,
  Class,
  Type,
} from '@flyxc/common';
import { afterEach, describe, expect, it, vi } from 'vitest';

import * as airspacesLogic from '../../logic/airspaces';
import { setShow } from '../../redux/airspace-slice';
import { setTimeSec } from '../../redux/app-slice';
import { store } from '../../redux/store';
import { addTrackEntities, setCurrentTrackId } from '../../redux/track-slice';
import { Airspace3dElement, buildAirspaceVectorTileStyle } from './airspace3d-element';

const { vectorTileCtorSpy } = vi.hoisted(() => ({
  vectorTileCtorSpy: vi.fn(),
}));

vi.mock('@arcgis/core/layers/VectorTileLayer', () => {
  return {
    default: class MockVectorTileLayer {
      style: any;
      destroy = vi.fn();
      constructor(props: { style: any }) {
        this.style = props.style;
        vectorTileCtorSpy(props);
      }
    },
  };
});

function hexToUnitRgba(hex: string): [number, number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1];
}

function evaluateStyle(style: ReturnType<typeof buildAirspaceVectorTileStyle>, values: Record<string, unknown>) {
  const repo = new StyleRepository(style, false);
  const layer = repo.layers[0];
  const filter = layer.getFeatureFilter();
  const visible = filter ? filter.filter({ values }, 10) : true;
  const color = layer.getPaintValue('fill-color', 10, { values }) as number[];
  return { visible, color };
}

describe('buildAirspaceVectorTileStyle', () => {
  it('renders and filters non-overridden airspaces by class and type colors', () => {
    const style = buildAirspaceVectorTileStyle({
      maxAltitude: 3000,
      showClasses: [Class.A, Class.B, Class.C, Class.D, Class.E],
      showTypes: [Type.Prohibited, Type.Restricted, Type.Danger],
      opacity: 70,
      date: new TZDate('2025-07-15T12:00:00', 'Europe/Paris'),
      tileServer: 'cloud',
    });

    const classD = evaluateStyle(style, { name: 'CTR LYON', icaoClass: Class.D, type: Type.CTR, floorM: 0 });
    expect(classD.visible).toBe(true);
    expect(classD.color).toEqual(hexToUnitRgba(ASP_COLOR_PROHIBITED));

    const classE = evaluateStyle(style, { name: 'TMA LYON 3', icaoClass: Class.E, type: Type.TMA, floorM: 1000 });
    expect(classE.visible).toBe(true);
    expect(classE.color).toEqual(hexToUnitRgba(ASP_COLOR_RESTRICTED));

    const lowAlt = evaluateStyle(style, {
      name: 'PROTECTED ZONE',
      icaoClass: Class.SUA,
      type: Type.LowAltitudeOverflightRestriction,
      floorM: 0,
    });
    expect(lowAlt.visible).toBe(true);
    expect(lowAlt.color).toEqual(hexToUnitRgba(ASP_COLOR_RESTRICTED));

    const danger = evaluateStyle(style, { name: 'LF-D 123', icaoClass: Class.SUA, type: Type.Danger, floorM: 500 });
    expect(danger.visible).toBe(true);
    expect(danger.color).toEqual(hexToUnitRgba(ASP_COLOR_DANGER));

    const other = evaluateStyle(style, { name: 'GLIDING', icaoClass: Class.SUA, type: Type.Other, floorM: 0 });
    expect(other.visible).toBe(false);
    expect(other.color).toEqual(hexToUnitRgba(ASP_COLOR_OTHER));

    const tooHigh = evaluateStyle(style, { name: 'HIGH TMA', icaoClass: Class.D, type: Type.TMA, floorM: 3500 });
    expect(tooHigh.visible).toBe(false);
  });

  it('applies seasonal overrides for July and winter weekends', () => {
    const commonProps = {
      maxAltitude: 3000,
      showClasses: [Class.A, Class.B, Class.C, Class.D],
      showTypes: [Type.Prohibited, Type.Restricted, Type.Danger],
      opacity: 70,
      tileServer: 'cloud' as const,
    };

    const julyStyle = buildAirspaceVectorTileStyle({
      ...commonProps,
      date: new TZDate('2025-07-15T12:00:00', 'Europe/Paris'),
    });

    // Ecrins inactive in July -> Type.Other (hidden when Class.E/Other hidden, grey color).
    const ecrinsJuly = evaluateStyle(julyStyle, {
      name: airspaceOverrides.ecrins,
      icaoClass: Class.SUA,
      type: Type.Restricted,
      floorM: 0,
    });
    expect(ecrinsJuly.visible).toBe(false);
    expect(ecrinsJuly.color).toEqual(hexToUnitRgba(ASP_COLOR_OTHER));

    // LF-R30B active in July -> Restricted yellow & visible.
    const r30bJuly = evaluateStyle(julyStyle, {
      name: airspaceOverrides.LFR30B,
      icaoClass: Class.SUA,
      type: Type.Restricted,
      floorM: 0,
    });
    expect(r30bJuly.visible).toBe(true);
    expect(r30bJuly.color).toEqual(hexToUnitRgba(ASP_COLOR_RESTRICTED));

    // TMA Chambery 1 becomes Class E in July (even if tile says D) -> hidden here, yellow color.
    const chamberyTmaJuly = evaluateStyle(julyStyle, {
      name: airspaceOverrides.TMAChambery1,
      icaoClass: Class.D,
      type: Type.TMA,
      floorM: 1000,
    });
    expect(chamberyTmaJuly.visible).toBe(false);
    expect(chamberyTmaJuly.color).toEqual(hexToUnitRgba(ASP_COLOR_RESTRICTED));

    // CTR Chambery 2 becomes SUA/Other in July -> hidden & grey.
    const chamberyCtrJuly = evaluateStyle(julyStyle, {
      name: airspaceOverrides.CTRChambery2,
      icaoClass: Class.D,
      type: Type.CTR,
      floorM: 0,
    });
    expect(chamberyCtrJuly.visible).toBe(false);
    expect(chamberyCtrJuly.color).toEqual(hexToUnitRgba(ASP_COLOR_OTHER));

    // TMA Clermont 2.1 becomes Class G / TMA -> Class G takes color precedence (yellow).
    const clermontJuly = evaluateStyle(julyStyle, {
      name: airspaceOverrides.TMAClermont21,
      icaoClass: Class.D,
      type: Type.TMA,
      floorM: 500,
    });
    expect(clermontJuly.color).toEqual(hexToUnitRgba(ASP_COLOR_RESTRICTED));

    const winterStyle = buildAirspaceVectorTileStyle({
      ...commonProps,
      date: new TZDate('2025-04-13T12:00:00', 'Europe/Paris'),
    });

    const ecrinsWinter = evaluateStyle(winterStyle, {
      name: airspaceOverrides.ecrins,
      icaoClass: Class.SUA,
      type: Type.Restricted,
      floorM: 0,
    });
    expect(ecrinsWinter.visible).toBe(true);
    expect(ecrinsWinter.color).toEqual(hexToUnitRgba(ASP_COLOR_RESTRICTED));

    const r30bWinter = evaluateStyle(winterStyle, {
      name: airspaceOverrides.LFR30B,
      icaoClass: Class.SUA,
      type: Type.Restricted,
      floorM: 0,
    });
    expect(r30bWinter.visible).toBe(false);
    expect(r30bWinter.color).toEqual(hexToUnitRgba(ASP_COLOR_OTHER));

    const chamberyTmaWinter = evaluateStyle(winterStyle, {
      name: airspaceOverrides.TMAChambery1,
      icaoClass: Class.E,
      type: Type.TMA,
      floorM: 1000,
    });
    expect(chamberyTmaWinter.visible).toBe(true);
    expect(chamberyTmaWinter.color).toEqual(hexToUnitRgba(ASP_COLOR_PROHIBITED));

    const chamberyCtrWinter = evaluateStyle(winterStyle, {
      name: airspaceOverrides.CTRChambery2,
      icaoClass: Class.D,
      type: Type.CTR,
      floorM: 0,
    });
    expect(chamberyCtrWinter.visible).toBe(true);
    expect(chamberyCtrWinter.color).toEqual(hexToUnitRgba(ASP_COLOR_PROHIBITED));
  });

  it('keeps wildcard visibility when Type.Other is enabled', () => {
    const style = buildAirspaceVectorTileStyle({
      maxAltitude: 3000,
      showClasses: [],
      showTypes: [Type.Other],
      opacity: 70,
      date: new Date('2025-07-15T12:00:00Z'),
      tileServer: 'cloud',
    });

    expect(style.layers[0].filter).toEqual(['all', ['any', ['boolean', true]], ['<=', ['get', 'floorM'], 3000]]);
  });
});

describe('Airspace3dElement', () => {
  const mounted: Airspace3dElement[] = [];

  afterEach(() => {
    for (const el of mounted) {
      el.remove();
    }
    mounted.length = 0;
    store.dispatch(setShow(false));
    store.dispatch(setCurrentTrackId(undefined));
    vi.restoreAllMocks();
    vectorTileCtorSpy.mockClear();
  });

  async function createElement() {
    const mockMap = {
      add: vi.fn(),
      remove: vi.fn(),
    } as any;
    const el = new Airspace3dElement();
    el.map = mockMap;
    document.body.appendChild(el);
    mounted.push(el);
    store.dispatch(setShow(true));
    await el.updateComplete;
    return { el, mockMap };
  }

  it('passes the active track timestamp to getAirspaceList on click and rebuilds layer on track change', async () => {
    const { el } = await createElement();
    expect(vectorTileCtorSpy).toHaveBeenCalledTimes(1);

    const getListSpy = vi.spyOn(airspacesLogic, 'getAirspaceList').mockResolvedValue('<b>test</b>');
    const mockScene = { openPopup: vi.fn().mockResolvedValue(undefined) } as unknown as ArcgisScene;
    const trackTimeSec = Math.floor(Date.UTC(2025, 6, 15, 12, 0, 0) / 1000);

    store.dispatch(setTimeSec(trackTimeSec));
    store.dispatch(addTrackEntities([{ id: 'track-1' } as any]));
    store.dispatch(setCurrentTrackId('track-1'));
    await el.updateComplete;
    expect(vectorTileCtorSpy).toHaveBeenCalledTimes(2);

    await el.handleClick({ lat: 45.8, lon: 6.8 }, mockScene);

    expect(getListSpy).toHaveBeenCalledTimes(1);
    const passedDate = getListSpy.mock.calls[0][6];
    expect(passedDate.getTime()).toBe(trackTimeSec * 1000);
  });

  it('uses current date on click when no track is loaded', async () => {
    const { el } = await createElement();

    const getListSpy = vi.spyOn(airspacesLogic, 'getAirspaceList').mockResolvedValue('');
    const mockScene = { openPopup: vi.fn() } as unknown as ArcgisScene;

    const before = Date.now();
    await el.handleClick({ lat: 45.8, lon: 6.8 }, mockScene);
    const after = Date.now();

    const passedDate = getListSpy.mock.calls[0][6];
    expect(passedDate.getTime()).toBeGreaterThanOrEqual(before);
    expect(passedDate.getTime()).toBeLessThanOrEqual(after);
  });
});
