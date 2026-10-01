import { render } from 'preact';

import * as pluginSlice from './redux/plugin-slice';
import { store } from './redux/store';
import * as unitsSlice from './redux/units-slice';
import { destroyPlugin, mountPlugin } from './sounding';

type ListenerFn = (...args: any[]) => void;

vi.mock('preact', async () => ({
  render: vi.fn(),
}));

describe('sounding lifecycle and unit synchronization', () => {
  const windyListeners = new Map<number, { event: string; fn: ListenerFn }>();
  let nextListenerId = 1;

  beforeEach(() => {
    vi.clearAllMocks();
    windyListeners.clear();
    nextListenerId = 1;

    (W.store.on as any).mockImplementation((event: string, fn: ListenerFn) => {
      const id = nextListenerId++;
      windyListeners.set(id, { event, fn });
      return id;
    });

    (W.store.off as any).mockImplementation((id: number) => {
      windyListeners.delete(id);
    });
  });

  it('synchronizes all persisted units from windyStore before render, and registers live listeners', () => {
    // Return custom units when windyStore.get(...) is called
    (W.store.get as any).mockImplementation((key: string) => {
      switch (key) {
        case 'metric_temp':
          return '°F';
        case 'metric_altitude':
          return 'ft';
        case 'metric_wind':
          return 'kt';
        case 'metric_pressure':
          return 'inHg';
        case 'metric_rain':
          return 'in';
        case 'timestamp':
          return 1700000000000;
        default:
          return undefined;
      }
    });

    // Reset Redux state to different units
    store.dispatch(unitsSlice.setTempUnit('°C'));
    store.dispatch(unitsSlice.setAltitudeUnit('m'));
    store.dispatch(unitsSlice.setWindSpeedUnit('km/h'));
    store.dispatch(unitsSlice.setPressureUnit('hPa'));
    store.dispatch(unitsSlice.setRainUnit('mm'));

    // Capture Redux state when preact.render is called
    let stateAtRender: ReturnType<typeof store.getState> | undefined;
    vi.mocked(render).mockImplementation(() => {
      stateAtRender = store.getState();
      return undefined as any;
    });

    const fakeContainer = {} as HTMLElement;
    mountPlugin(fakeContainer);

    // Verify render was called
    expect(render).toHaveBeenCalled();

    // Verify all 5 units were dispatched to Redux BEFORE render was called
    expect(stateAtRender).toBeDefined();
    expect(unitsSlice.selTempUnit(stateAtRender!)).toBe('°F');
    expect(unitsSlice.selAltitudeUnit(stateAtRender!)).toBe('ft');
    expect(unitsSlice.selWindSpeedUnit(stateAtRender!)).toBe('kt');
    expect(unitsSlice.selPressureUnit(stateAtRender!)).toBe('inHg');
    expect(unitsSlice.selRainUnit(stateAtRender!)).toBe('in');
    expect(pluginSlice.selTimeMs(stateAtRender!)).toBe(1700000000000);

    // Verify live listeners were registered for all 5 units
    const registeredEvents = Array.from(windyListeners.values()).map((l) => l.event);
    expect(registeredEvents).toContain('metric_temp');
    expect(registeredEvents).toContain('metric_altitude');
    expect(registeredEvents).toContain('metric_wind');
    expect(registeredEvents).toContain('metric_pressure');
    expect(registeredEvents).toContain('metric_rain');

    // Trigger each unit listener to verify Redux updates while plugin is active
    const trigger = (event: string, value: any) => {
      for (const listener of windyListeners.values()) {
        if (listener.event === event) {
          listener.fn(value);
        }
      }
    };

    trigger('metric_temp', '°C');
    expect(unitsSlice.selTempUnit(store.getState())).toBe('°C');

    trigger('metric_altitude', 'm');
    expect(unitsSlice.selAltitudeUnit(store.getState())).toBe('m');

    trigger('metric_wind', 'mph');
    expect(unitsSlice.selWindSpeedUnit(store.getState())).toBe('mph');

    trigger('metric_pressure', 'hPa');
    expect(unitsSlice.selPressureUnit(store.getState())).toBe('hPa');

    trigger('metric_rain', 'mm');
    expect(unitsSlice.selRainUnit(store.getState())).toBe('mm');

    // Verify cleanup on destroyPlugin
    destroyPlugin();
    expect(windyListeners.size).toBe(0);
  });
});
