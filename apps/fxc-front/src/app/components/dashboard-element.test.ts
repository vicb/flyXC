import { modalController } from '@ionic/core/components';
import { describe, expect, it, vi } from 'vitest';

import { DistanceUnit, SpeedUnit } from '../logic/units';
import { DashboardCtrlElement, DashboardElement } from './dashboard-element';

vi.mock('@ionic/core/components', async (importOriginal) => {
  const actual = await importOriginal<Record<string, any>>();
  return {
    ...actual,
    modalController: {
      create: vi.fn().mockResolvedValue({
        present: vi.fn().mockResolvedValue(undefined),
      }),
    },
  };
});

const mockUnits = {
  altitude: DistanceUnit.Meters,
  speed: SpeedUnit.KilometersPerHour,
  vario: SpeedUnit.MetersPerSecond,
  distance: DistanceUnit.Kilometers,
};

describe('DashboardElement', () => {
  it('instantiates DashboardElement', () => {
    const el = new DashboardElement();
    expect(el).toBeInstanceOf(DashboardElement);
  });

  it('renders nothing when no track is active', async () => {
    const el = new DashboardElement();
    el.hasTrack = false;
    el.units = mockUnits;
    document.body.appendChild(el);
    await el.updateComplete;

    expect(el.shadowRoot?.querySelector('ul')).toBeNull();
    expect(el.hidden).toBe(true);
    expect(el.style.display).toBe('none');
    el.remove();
  });

  it('renders nothing when units are not loaded', async () => {
    const el = new DashboardElement();
    el.hasTrack = true;
    el.units = null as any;
    document.body.appendChild(el);
    await el.updateComplete;

    expect(el.shadowRoot?.querySelector('ul')).toBeNull();
    expect(el.hidden).toBe(true);
    expect(el.style.display).toBe('none');
    el.remove();
  });

  it('renders all metrics for runtime track with Vz and Vx', async () => {
    const el = new DashboardElement();
    el.hasTrack = true;
    el.units = mockUnits;
    el.alt = 1500;
    el.gndAlt = 800;
    el.vz = 2.5;
    el.vx = 45;
    el.timeSec = 1700000000;
    document.body.appendChild(el);
    await el.updateComplete;

    const items = Array.from(el.shadowRoot?.querySelectorAll('li') ?? []).map((li) => li.textContent);

    expect(items.some((t) => t?.includes('1500') && t?.includes('[Alt]'))).toBe(true);
    expect(items.some((t) => t?.includes('700') && t?.includes('[AGL]'))).toBe(true);
    expect(items.some((t) => t?.includes('2.5') && t?.includes('[Vz]'))).toBe(true);
    expect(items.some((t) => t?.includes('45') && t?.includes('[Vx]'))).toBe(true);
    expect(items.length).toBe(6); // Alt, AGL, Vz, Vx, time, date

    el.remove();
  });

  it('omits Vz and Vx when not available (live track mode)', async () => {
    const el = new DashboardElement();
    el.hasTrack = true;
    el.units = mockUnits;
    el.alt = 2000;
    el.gndAlt = 1200;
    el.vz = undefined;
    el.vx = undefined;
    el.timeSec = 1700000000;
    document.body.appendChild(el);
    await el.updateComplete;

    const items = Array.from(el.shadowRoot?.querySelectorAll('li') ?? []).map((li) => li.textContent);

    expect(items.some((t) => t?.includes('2000') && t?.includes('[Alt]'))).toBe(true);
    expect(items.some((t) => t?.includes('800') && t?.includes('[AGL]'))).toBe(true);
    expect(items.some((t) => t?.includes('[Vz]'))).toBe(false);
    expect(items.some((t) => t?.includes('[Vx]'))).toBe(false);
    expect(items.length).toBe(4); // Alt, AGL, time, date

    el.remove();
  });

  it('omits AGL when ground altitude is unavailable', async () => {
    const el = new DashboardElement();
    el.hasTrack = true;
    el.units = mockUnits;
    el.alt = 2000;
    el.gndAlt = undefined;
    el.vz = undefined;
    el.vx = undefined;
    el.timeSec = 1700000000;
    document.body.appendChild(el);
    await el.updateComplete;

    const items = Array.from(el.shadowRoot?.querySelectorAll('li') ?? []).map((li) => li.textContent);

    expect(items.some((t) => t?.includes('2000') && t?.includes('[Alt]'))).toBe(true);
    expect(items.some((t) => t?.includes('[AGL]'))).toBe(false);
    expect(items.length).toBe(3); // Alt, time, date

    el.remove();
  });

  it('only renders supplied properties without fallback to ambient state', async () => {
    // DashboardElement is a pure presentational component unconnected to Redux,
    // so it only renders metrics explicitly supplied to it.
    const el = new DashboardElement();
    el.hasTrack = true;
    el.alt = 2500;
    el.timeSec = 1700000000;
    el.units = mockUnits;

    document.body.appendChild(el);
    await el.updateComplete;

    const items = Array.from(el.shadowRoot?.querySelectorAll('li') ?? []).map((li) => li.textContent);
    expect(items.some((t) => t?.includes('2500') && t?.includes('[Alt]'))).toBe(true);
    // Vz and Vx are not supplied, so they must NOT be included
    expect(items.some((t) => t?.includes('[Vz]'))).toBe(false);
    expect(items.some((t) => t?.includes('[Vx]'))).toBe(false);

    el.remove();
  });

  it('renders correctly when data property is provided', async () => {
    const el = new DashboardElement();
    el.units = mockUnits;
    el.data = {
      hasTrack: true,
      alt: 3000,
      gndAlt: 1500,
      timeSec: 1700000000,
      // vz and vx undefined
    };

    document.body.appendChild(el);
    await el.updateComplete;

    const items = Array.from(el.shadowRoot?.querySelectorAll('li') ?? []).map((li) => li.textContent);
    expect(items.some((t) => t?.includes('3000') && t?.includes('[Alt]'))).toBe(true);
    expect(items.some((t) => t?.includes('1500') && t?.includes('[AGL]'))).toBe(true);
    expect(items.some((t) => t?.includes('[Vz]'))).toBe(false);
    expect(items.some((t) => t?.includes('[Vx]'))).toBe(false);
    expect(items.length).toBe(4);

    el.remove();
  });

  it('opens pref-modal when clicked', async () => {
    const el = new DashboardElement();
    el.hasTrack = true;
    el.units = mockUnits;
    el.alt = 1000;
    document.body.appendChild(el);
    await el.updateComplete;

    const ul = el.shadowRoot?.querySelector('ul');
    ul?.click();

    expect(modalController.create).toHaveBeenCalledWith({
      component: 'pref-modal',
    });

    el.remove();
  });
});

describe('DashboardCtrlElement', () => {
  it('instantiates DashboardCtrlElement', () => {
    const el = new DashboardCtrlElement();
    expect(el).toBeInstanceOf(DashboardCtrlElement);
  });

  it('renders dashboard-element when active track and units are available in store', async () => {
    const el = new DashboardCtrlElement();
    document.body.appendChild(el);

    (el as any).data = {
      hasTrack: true,
      alt: 1200,
      gndAlt: 600,
      vz: 1.5,
      vx: 30,
      timeSec: 1700000000,
    };
    (el as any).units = mockUnits;
    el.requestUpdate();
    await el.updateComplete;

    const inner = el.shadowRoot?.querySelector('dashboard-element');
    expect(inner).not.toBeNull();

    el.remove();
  });

  it('renders nothing when hasTrack is false', async () => {
    const el = new DashboardCtrlElement();
    (el as any).data = {
      hasTrack: false,
      alt: 0,
      timeSec: 0,
    };
    (el as any).units = mockUnits;

    document.body.appendChild(el);
    await el.updateComplete;

    expect(el.shadowRoot?.querySelector('dashboard-element')).toBeNull();

    el.remove();
  });
});
