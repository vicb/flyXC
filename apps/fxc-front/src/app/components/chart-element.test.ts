import { describe, expect, it } from 'vitest';

import type { ChartTrack } from './chart-element';
import { ChartElement, ChartYAxis } from './chart-element';

describe('ChartElement', () => {
  it('instantiates ChartElement', () => {
    const el = new ChartElement();
    expect(el).toBeInstanceOf(ChartElement);
    expect(el.chartYAxis).toBe(ChartYAxis.Altitude);
    expect(el.tracks).toEqual([]);
  });

  it('computes minTimeSec and maxTimeSec from tracks if not provided', () => {
    const el = new ChartElement();
    const track: ChartTrack = {
      id: 'test',
      color: 'blue',
      timeSec: [100, 200, 300],
      alt: [1000, 1500, 1200],
    };
    el.tracks = [track];

    expect((el as any).computedMinTimeSec).toBe(100);
    expect((el as any).computedMaxTimeSec).toBe(300);
  });

  it('computes minY and maxY for altitude from tracks if not provided', () => {
    const el = new ChartElement();
    const track: ChartTrack = {
      id: 'test',
      color: 'blue',
      timeSec: [100, 200, 300],
      alt: [1000, 1500, 1200],
    };
    el.tracks = [track];
    el.chartYAxis = ChartYAxis.Altitude;

    expect((el as any).computedMinY).toBe(1000);
    expect((el as any).computedMaxY).toBe(1500);
  });

  it('uses explicit bounds if provided', () => {
    const el = new ChartElement();
    el.tracks = [
      {
        id: 'test',
        color: 'blue',
        timeSec: [100, 200, 300],
        alt: [1000, 1500, 1200],
      },
    ];
    el.minTimeSec = 50;
    el.maxTimeSec = 400;
    el.minY = 800;
    el.maxY = 2000;

    expect((el as any).computedMinTimeSec).toBe(50);
    expect((el as any).computedMaxTimeSec).toBe(400);
    expect((el as any).computedMinY).toBe(800);
    expect((el as any).computedMaxY).toBe(2000);
  });

  it('samples altitude or speed correctly with getY', () => {
    const el = new ChartElement();
    const track: ChartTrack = {
      id: 'test',
      color: 'blue',
      timeSec: [100, 200],
      alt: [1000, 2000],
      vx: [10, 20],
    };

    el.chartYAxis = ChartYAxis.Altitude;
    expect((el as any).getY(track, 150)).toBe(1500);

    el.chartYAxis = ChartYAxis.Speed;
    expect((el as any).getY(track, 150)).toBe(15);
  });

  it('renders SVG and adapts controls based on availableYAxes', async () => {
    const el = new ChartElement();
    el.tracks = [
      {
        id: 'test',
        color: 'red',
        timeSec: [100, 200, 300, 400, 500, 600],
        alt: [1000, 1200, 1300, 1400, 1500, 1600],
        gndAlt: [800, 900, 1000, 1100, 1200, 1300],
      },
    ];
    el.availableYAxes = [ChartYAxis.Altitude];
    document.body.appendChild(el);
    await el.updateComplete;

    // With only Altitude available, select dropdown is not rendered
    expect(el.shadowRoot?.querySelector('select')).toBeNull();

    // With multiple Y axes available, select dropdown is rendered
    el.availableYAxes = [ChartYAxis.Altitude, ChartYAxis.Speed, ChartYAxis.Vario];
    await el.updateComplete;
    const select = el.shadowRoot?.querySelector('select');
    expect(select).not.toBeNull();
    expect(select?.options.length).toBe(3);

    document.body.removeChild(el);
  });

  it('does not render live rightmost label for runtime tracks', async () => {
    const el = new ChartElement();
    (el as any).width = 800;
    (el as any).height = 200;
    el.tracks = [
      {
        id: 'test',
        color: 'blue',
        timeSec: [1000, 2000, 3000],
        alt: [1000, 1500, 1200],
      },
    ];
    el.isLiveTrack = false;
    const texts = (el as any).xTexts();
    const rendered = texts.map((t: any) => (t.values ?? []).join('')).join('');
    expect(rendered).not.toContain('now');
  });

  it('renders rightmost live label ("now" or "now - Xmin") and skips overlapping left labels', async () => {
    const el = new ChartElement();
    (el as any).width = 800;
    (el as any).height = 200;
    const nowSec = Math.floor(Date.now() / 1000);
    // Track ended 5 minutes ago
    const maxSec = nowSec - 5 * 60;
    const minSec = maxSec - 3 * 3600;

    el.tracks = [
      {
        id: 'live-test',
        color: 'green',
        timeSec: [minSec, maxSec],
        alt: [1000, 1500],
        isLive: true,
      },
    ];
    el.isLiveTrack = true;

    const texts = (el as any).xTexts();
    const rendered = texts.map((t: any) => t.values?.join('') ?? '').join('');
    expect(rendered).toContain('now - 5min');
  });

  it('draws short active segments with 2, 3, or 4 fixes', () => {
    const el = new ChartElement();
    (el as any).width = 400;
    (el as any).height = 100;
    el.currentTrackId = 'short-live';

    // 2 fixes: should render both ground and track paths
    el.tracks = [
      {
        id: 'short-live',
        color: 'red',
        timeSec: [1000, 1060],
        alt: [1200, 1500],
        gndAlt: [800, 900],
        isLive: true,
      },
    ];

    let renderedPaths = (el as any).paths();
    expect(renderedPaths.length).toBeGreaterThanOrEqual(1);

    // 3 fixes
    el.tracks = [
      {
        id: 'short-live',
        color: 'red',
        timeSec: [1000, 1030, 1060],
        alt: [1200, 1350, 1500],
        gndAlt: [800, 850, 900],
        isLive: true,
      },
    ];
    renderedPaths = (el as any).paths();
    expect(renderedPaths.length).toBeGreaterThanOrEqual(1);

    // 4 fixes
    el.tracks = [
      {
        id: 'short-live',
        color: 'red',
        timeSec: [1000, 1020, 1040, 1060],
        alt: [1200, 1300, 1400, 1500],
        gndAlt: [800, 830, 870, 900],
        isLive: true,
      },
    ];
    renderedPaths = (el as any).paths();
    expect(renderedPaths.length).toBeGreaterThanOrEqual(1);
  });

  it('skips tracks with fewer than 2 fixes', () => {
    const el = new ChartElement();
    (el as any).width = 400;
    (el as any).height = 100;

    // 1 fix: cannot define a line segment
    el.tracks = [
      {
        id: 'single-point',
        color: 'red',
        timeSec: [1000],
        alt: [1200],
      },
    ];
    expect((el as any).paths()).toHaveLength(0);

    // 0 fixes: empty track
    el.tracks = [
      {
        id: 'empty',
        color: 'red',
        timeSec: [],
        alt: [],
      },
    ];
    expect((el as any).paths()).toHaveLength(0);
  });

  it('handles narrow chart and zero time span in xTexts without infinite loop', () => {
    const el = new ChartElement();
    (el as any).width = 100;
    (el as any).height = 100;
    el.tracks = [
      {
        id: 'short',
        timeSec: [1000, 1000],
        alt: [1000, 1000],
      },
    ];
    el.minTimeSec = 1000;
    el.maxTimeSec = 1000;

    const texts = (el as any).xTexts();
    expect(Array.isArray(texts)).toBe(true);
  });

  it('renders hourly tick labels for a multi-hour flight', () => {
    const el = new ChartElement();
    (el as any).width = 800;
    (el as any).height = 100;
    // 4 hours flight
    const startSec = 1700000000;
    const endSec = startSec + 4 * 3600;
    el.tracks = [
      {
        id: 'flight',
        timeSec: [startSec, endSec],
        alt: [1000, 2000],
      },
    ];
    el.minTimeSec = startSec;
    el.maxTimeSec = endSec;

    const texts = (el as any).xTexts();
    expect(texts.length).toBeGreaterThanOrEqual(2);
  });

  it('clears playTimer on disconnectedCallback', () => {
    const el = new ChartElement();
    (el as any).playTimer = 9999 as any;
    el.disconnectedCallback();
    expect((el as any).playTimer).toBeUndefined();
  });
});
