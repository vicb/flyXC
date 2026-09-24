import { showClasses, showTypes } from '../airspace-slice';
import { setPwaInstallCancelled } from '../app-slice';
import { RETURN_URL_KEY, setReturnUrl } from '../live-track-slice';
import { setGeolocation } from '../location-slice';
import { setLeague } from '../planner-slice';
import type { AppStartListening } from '../store';
import { setLockOnPilot } from '../track-slice';
import { setAltitudeUnit, setDistanceUnit, setSpeedUnit, setVarioUnit } from '../units-slice';

/**
 * Registers listeners to persist user preferences and state changes to localStorage.
 *
 * Keeps Redux reducers 100% pure while reliably updating browser storage whenever relevant
 * state updates occur.
 *
 * @param startListening - The typed startListening function.
 */
export function setupStorageSyncListener(startListening: AppStartListening): void {
  // Units preferences
  startListening({
    actionCreator: setDistanceUnit,
    effect: (action) => {
      localStorage.setItem('unit.distance', action.payload);
    },
  });

  startListening({
    actionCreator: setSpeedUnit,
    effect: (action) => {
      localStorage.setItem('unit.speed', action.payload);
    },
  });

  startListening({
    actionCreator: setAltitudeUnit,
    effect: (action) => {
      localStorage.setItem('unit.altitude', action.payload);
    },
  });

  startListening({
    actionCreator: setVarioUnit,
    effect: (action) => {
      localStorage.setItem('unit.vario', action.payload);
    },
  });

  // Geolocation (used to center initial map view)
  startListening({
    actionCreator: setGeolocation,
    effect: (action) => {
      localStorage.setItem('init.lat', String(action.payload.lat));
      localStorage.setItem('init.lon', String(action.payload.lon));
    },
  });

  // Airspace classes and types
  startListening({
    actionCreator: showClasses,
    effect: (action) => {
      localStorage.setItem('airspaceClasses', JSON.stringify(action.payload));
    },
  });

  startListening({
    actionCreator: showTypes,
    effect: (action) => {
      localStorage.setItem('airspaceTypes', JSON.stringify(action.payload));
    },
  });

  // Planner league
  startListening({
    actionCreator: setLeague,
    effect: (action) => {
      localStorage.setItem('league', action.payload);
    },
  });

  // Track lock on pilot
  startListening({
    actionCreator: setLockOnPilot,
    effect: (action) => {
      localStorage.setItem('track.lock-pilot', String(action.payload));
    },
  });

  // PWA install prompt cancellation
  startListening({
    actionCreator: setPwaInstallCancelled,
    effect: (action) => {
      localStorage.setItem('pwa-install-cancelled', String(action.payload));
    },
  });

  // Live tracking return URL
  startListening({
    actionCreator: setReturnUrl,
    effect: (action) => {
      localStorage.setItem(RETURN_URL_KEY, action.payload);
    },
  });
}
