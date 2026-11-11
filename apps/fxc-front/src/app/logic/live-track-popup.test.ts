import { NO_GROUND_ALTITUDE, trackerIdByName } from '@flyxc/common';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createPopupContent } from '../components/3d/popup-content';
import { liveTrackSelectors } from '../redux/live-track-slice';
import { popupContent } from './live-track-popup';
import { DistanceUnit, SpeedUnit } from './units';

describe('popupContent', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('HTML-escapes tracker messages', () => {
    vi.spyOn(liveTrackSelectors, 'selectById').mockReturnValue({
      id: 42,
      idStr: '42',
      name: 'Pilot',
      timeSec: [1700000000],
      lat: [45.1],
      lon: [6.2],
      alt: [1200],
      gndAlt: [NO_GROUND_ALTITUDE],
      flags: [trackerIdByName.flyme],
      extra: { 0: { message: 'Hi <img src=x onerror=alert(1)> & "ok"' } },
    });

    const popup = popupContent('42', 0, {
      altitude: DistanceUnit.Meters,
      distance: DistanceUnit.Kilometers,
      speed: SpeedUnit.KilometersPerHour,
      vario: SpeedUnit.MetersPerSecond,
    });

    expect(popup).toBeDefined();
    expect(popup!.content).not.toContain('<img');
    expect(popup!.content).toContain('&#60;img src=x onerror=alert(1)&#62; &#38; &#34;ok&#34;');

    const shadow = createPopupContent(popup!.content).shadowRoot!;
    expect(shadow.querySelector('img')).toBeNull();
    expect(shadow.textContent).toContain('Hi <img src=x onerror=alert(1)> & "ok"');
  });
});
