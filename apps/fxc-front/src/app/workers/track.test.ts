import { describe, expect, it } from 'vitest';

import { computeMedian, filterSpikes } from './track';

describe('filterSpikes', () => {
  it('should return early when track has fewer than 3 fixes', () => {
    const alt = [1000, 5000];
    const time = [1, 2];
    const bounds = filterSpikes(alt, time);
    expect(alt).toEqual([1000, 5000]);
    expect(bounds).toEqual({ minAlt: 1000, maxAlt: 5000 });
  });

  it('returns exact minAlt and maxAlt bounds after filtering outliers', () => {
    const alt = [1000, 1005, 5000, 1015, 980];
    const time = [1, 2, 3, 4, 5];
    const { maxAlt, minAlt } = filterSpikes(alt, time);
    // Spike 5000 is filtered to 1010, so max is 1015, min is 980
    expect(maxAlt).toBe(1015);
    expect(minAlt).toBe(980);
  });

  describe('preservation of genuine flight maneuvers', () => {
    it('preserves level flight without alterations', () => {
      const alt = [1000, 1002, 1001, 1003, 1000, 1002];
      const time = [10, 20, 30, 40, 50, 60];
      const copy = [...alt];
      filterSpikes(alt, time);
      expect(alt).toEqual(copy);
    });

    it('preserves genuine thermal climbs without attenuation', () => {
      // Climbing at ~3-4 m/s in a 10s interval logger
      const alt = [1000, 1035, 1070, 1110, 1145, 1180];
      const time = [10, 20, 30, 40, 50, 60];
      const copy = [...alt];
      filterSpikes(alt, time);
      expect(alt).toEqual(copy);
    });

    it('preserves genuine thermal peaks without clipping local maxima', () => {
      // Climbing to peak 1445m and then gliding away down to 1420m
      const alt = [1410, 1430, 1445, 1432, 1420];
      const time = [10, 20, 30, 40, 50];
      const copy = [...alt];
      filterSpikes(alt, time);
      expect(alt).toEqual(copy);
    });

    it('preserves genuine troughs without raising local minima', () => {
      // Gliding down to low point 480m and finding a climb back to 520m
      const alt = [550, 510, 480, 505, 530];
      const time = [10, 20, 30, 40, 50];
      const copy = [...alt];
      filterSpikes(alt, time);
      expect(alt).toEqual(copy);
    });

    it('preserves steep spiral descents (-18 m/s)', () => {
      // Steep spiral descent: losing 180m every 10s (~18 m/s)
      const alt = [2000, 1820, 1640, 1460, 1280];
      const time = [10, 20, 30, 40, 50];
      const copy = [...alt];
      filterSpikes(alt, time);
      expect(alt).toEqual(copy);
    });

    it('does not alter legitimate coastal or low-altitude soaring near sea level', () => {
      const alt = [15, 18, 12, 14, 16];
      const time = [1, 2, 3, 4, 5];
      const copy = [...alt];
      filterSpikes(alt, time);
      expect(alt).toEqual(copy);
    });

    it('does not alter below sea level flights (e.g. Dead Sea soaring)', () => {
      const alt = [-380, -375, -370, -372, -378];
      const time = [10, 20, 30, 40, 50];
      const copy = [...alt];
      filterSpikes(alt, time);
      expect(alt).toEqual(copy);
    });
  });

  describe('outlier and spike removal', () => {
    it('removes an isolated positive altitude spike', () => {
      const alt = [1000, 1005, 5000, 1015, 1020];
      const time = [1, 2, 3, 4, 5];
      filterSpikes(alt, time);
      expect(alt).toEqual([1000, 1005, 1010, 1015, 1020]);
    });

    it('removes an isolated negative altitude spike', () => {
      const alt = [1500, 1505, 200, 1515, 1520];
      const time = [1, 2, 3, 4, 5];
      filterSpikes(alt, time);
      expect(alt).toEqual([1500, 1505, 1510, 1515, 1520]);
    });

    it('removes multi-point consecutive spikes', () => {
      const alt = [1000, 1005, 5000, 5005, 1020, 1025];
      const time = [1, 2, 3, 4, 5, 6];
      filterSpikes(alt, time);
      expect(alt).toEqual([1000, 1005, 1020, 1020, 1020, 1025]);
    });

    it('removes decaying multi-point spike tails without leaving residual blips', () => {
      // Spike at t=2 jumping +61m/s, then decaying at t=3 (+31m/s from cleaned base)
      const alt = [715, 776, 749, 715, 715];
      const time = [1, 2, 3, 4, 5];
      filterSpikes(alt, time);
      expect(alt).toEqual([715, 715, 715, 715, 715]);
    });

    it('cleanly resolves wide multi-point spike plateaus', () => {
      // 4-point spike plateau
      const alt = [1000, 1002, 3000, 3005, 3010, 3015, 1010, 1012];
      const time = [1, 2, 3, 4, 5, 6, 7, 8];
      filterSpikes(alt, time);
      expect(alt).toEqual([1000, 1002, 1012, 1012, 1012, 1012, 1010, 1012]);
    });

    it('removes zero dropouts while flying at altitude', () => {
      const alt = [1400, 1405, 0, 1415, 1420];
      const time = [10, 20, 30, 40, 50];
      filterSpikes(alt, time);
      expect(alt).toEqual([1400, 1405, 1410, 1415, 1420]);
    });

    it('removes consecutive zero dropouts without treating zeroes as valid neighbors', () => {
      const alt = [1400, 1405, 0, 0, 1415, 1420];
      const time = [10, 20, 30, 40, 50, 60];
      filterSpikes(alt, time);
      expect(alt).toEqual([1400, 1405, 1410, 1410, 1415, 1420]);
    });

    it('leaves zero dropout candidates unchanged when there are no positive neighbors', () => {
      const alt = [0, 0, 0, 0, 0];
      const time = [10, 20, 30, 40, 50];
      const result = filterSpikes(alt, time);
      expect(alt).toEqual([0, 0, 0, 0, 0]);
      expect(result).toEqual({ maxAlt: 0, minAlt: 0 });
    });

    it('removes an altitude spike at the first fix (takeoff edge)', () => {
      const alt = [9999, 1000, 1005, 1010, 1015];
      const time = [1, 2, 3, 4, 5];
      filterSpikes(alt, time);
      expect(alt[0]).toBe(1008);
      expect(alt.slice(1)).toEqual([1000, 1005, 1010, 1015]);
    });

    it('removes an altitude spike at the last fix (landing edge)', () => {
      const alt = [1000, 1005, 1010, 1015, 9999];
      const time = [1, 2, 3, 4, 5];
      filterSpikes(alt, time);
      expect(alt[4]).toBe(1008);
      expect(alt.slice(0, 4)).toEqual([1000, 1005, 1010, 1015]);
    });
  });

  describe('irregular sampling and gaps', () => {
    it('handles non-uniform recording intervals correctly without time shifts', () => {
      // Transition from 1s intervals to 10s intervals
      const time = [1, 2, 3, 4, 5, 15, 25, 35, 45];
      const alt = [1000, 1002, 1004, 1006, 1008, 1030, 1050, 1070, 1090];
      const copy = [...alt];
      filterSpikes(alt, time);
      expect(alt).toEqual(copy);
    });

    it('handles duplicate timestamps without division by zero', () => {
      const alt = [1000, 1005, 5000, 1010];
      const time = [1, 2, 2, 3];
      filterSpikes(alt, time);
      expect(alt).toEqual([1000, 1005, 1005, 1010]);
    });

    it('does not bridge neighbor searches across large gaps (> 60s)', () => {
      // Point before gap is 1000m at t=10. Gap of 300s. Points after gap are 2000m starting at t=310.
      const alt = [990, 995, 1000, 2000, 2005, 2010];
      const time = [0, 5, 10, 310, 315, 320];
      const copy = [...alt];
      filterSpikes(alt, time);
      // Valid points across the gap must not be corrupted by each other
      expect(alt).toEqual(copy);
    });
  });

  describe('verification of UK XContest flight segment', () => {
    it('preserves exact altitudes around 14:47:24 without false drops or index shift', () => {
      // Fixes around 13:47:04 to 13:47:54 UTC (14:47:04 to 14:47:54 BST) from 2025-06-02-XFH-000-01-3.IGC
      const time = [49624, 49634, 49644, 49654, 49664, 49674]; // 13:47:04 to 13:47:54
      const alt = [1439, 1439, 1439, 1435, 1433, 1431];
      const copy = [...alt];
      filterSpikes(alt, time);
      expect(alt).toEqual(copy);
      // Specifically at 13:47:24 (index 2)
      expect(alt[2]).toBe(1439); // 4721 ft GPS
    });
  });

  describe('sailplane and aircraft flight dynamics', () => {
    it('preserves high-speed sailplane airbrake descents (-35 m/s) including entry and exit', () => {
      // Sailplane flying level at 3000m, diving at -35 m/s (-350m per 10s), then leveling off at 1600m
      const time = [10, 20, 30, 40, 50, 60, 70, 80];
      const alt = [3000, 3000, 2650, 2300, 1950, 1600, 1600, 1600];
      const copy = [...alt];
      filterSpikes(alt, time);
      expect(alt).toEqual(copy);
    });

    it('preserves powerful mountain wave climbs (+15 m/s)', () => {
      // Wave climb at +15 m/s (+150m per 10s)
      const time = [10, 20, 30, 40, 50, 60];
      const alt = [2000, 2150, 2300, 2450, 2600, 2750];
      const copy = [...alt];
      filterSpikes(alt, time);
      expect(alt).toEqual(copy);
    });

    it('preserves extreme continuous steep descents (-50 m/s)', () => {
      // Emergency dive at -50 m/s (-250m per 5s)
      const time = [0, 5, 10, 15, 20, 25];
      const alt = [3500, 3250, 3000, 2750, 2500, 2250];
      const copy = [...alt];
      filterSpikes(alt, time);
      expect(alt).toEqual(copy);
    });

    it('filters isolated GPS spikes superimposed on high-speed sailplane dives', () => {
      // Glider diving at -35 m/s with an isolated +800m glitch at t=30
      const time = [10, 20, 30, 40, 50];
      const alt = [3000, 2650, 3100, 1950, 1600];
      filterSpikes(alt, time);
      // Spike at t=30 should be replaced with the median of neighbors (2300m)
      expect(alt).toEqual([3000, 2650, 2300, 1950, 1600]);
    });

    it('filters GPS zero dropouts during high-speed sailplane dives', () => {
      const time = [10, 20, 30, 40, 50];
      const alt = [3000, 2650, 0, 1950, 1600];
      filterSpikes(alt, time);
      expect(alt).toEqual([3000, 2650, 2300, 1950, 1600]);
    });
  });
});

describe('computeMedian', () => {
  it('computes median for odd-length arrays', () => {
    expect(computeMedian([5, 1, 3])).toBe(3);
    expect(computeMedian([9, 2, 7, 1, 5])).toBe(5);
  });

  it('computes rounded average of middle values for even-length arrays', () => {
    expect(computeMedian([4, 1, 3, 2])).toBe(3); // (2 + 3) / 2 = 2.5 -> rounds to 3
    expect(computeMedian([10, 20, 30, 40])).toBe(25);
  });

  it('handles already sorted or reverse-sorted arrays', () => {
    expect(computeMedian([1, 2, 3, 4, 5])).toBe(3);
    expect(computeMedian([5, 4, 3, 2, 1])).toBe(3);
  });

  it('handles single-element arrays', () => {
    expect(computeMedian([42])).toBe(42);
  });
});
