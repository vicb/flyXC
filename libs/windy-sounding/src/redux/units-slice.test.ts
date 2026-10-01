import { store } from './store';
import * as unitsSlice from './units-slice';

describe('units-slice', () => {
  it('updates tempUnit', () => {
    store.dispatch(unitsSlice.setTempUnit('°F'));
    expect(unitsSlice.selTempUnit(store.getState())).toBe('°F');

    const formatTemp = unitsSlice.selTempFormatter(store.getState());
    // 273.15 K = 32 °F
    expect(formatTemp(273.15)).toBe(32);
  });

  it('updates altitudeUnit', () => {
    store.dispatch(unitsSlice.setAltitudeUnit('ft'));
    expect(unitsSlice.selAltitudeUnit(store.getState())).toBe('ft');

    const formatAltitude = unitsSlice.selAltitudeFormatter(store.getState());
    // 1000m * 3.28084 ≈ 3281 ft
    expect(formatAltitude(1000)).toBe(3281);

    const formatLayerAlt = unitsSlice.selLayerAltitudeFormatter(store.getState());
    expect(formatLayerAlt('900h')).toBe('3000ft');
    expect(formatLayerAlt('700h')).toBe('10kft');
  });

  it('updates windSpeedUnit', () => {
    store.dispatch(unitsSlice.setWindSpeedUnit('kt'));
    expect(unitsSlice.selWindSpeedUnit(store.getState())).toBe('kt');

    const formatWindSpeed = unitsSlice.selWindSpeedFormatter(store.getState());
    // 10 m/s * 1.94384 ≈ 19 kt
    expect(formatWindSpeed(10)).toBe(19);
  });

  it('updates pressureUnit', () => {
    store.dispatch(unitsSlice.setPressureUnit('hPa'));
    expect(unitsSlice.selPressureUnit(store.getState())).toBe('hPa');

    const formatPressure = unitsSlice.selPressureFormatter(store.getState());
    // 101325 Pa = 1013.25 hPa -> 1013 hPa
    expect(formatPressure(101325)).toBe(1013);
  });

  it('updates rainUnit', () => {
    store.dispatch(unitsSlice.setRainUnit('in'));
    expect(unitsSlice.selRainUnit(store.getState())).toBe('in');

    const formatRain = unitsSlice.selRainFormatter(store.getState());
    // 25.4 mm = 1 in
    expect(formatRain(25.4)).toBe('1in');
  });
});
