import type { LatLon } from '@windy/interfaces';
import { intlFormatDistance } from 'date-fns/intlFormatDistance';
import { useCallback, useState } from 'preact/hooks';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';

import { Favorites } from '../components/favorites.js';
import { LoadingIndicator } from '../components/loading.js';
import { Message } from '../components/message.jsx';
import { SkewT, type SkewTProps } from '../components/skewt.js';
import { WindProfile } from '../components/wind-profile.jsx';
import { pluginConfig } from '../config';
import flyxcIcon from '../img/jumoplane.svg';
import * as forecastSlice from '../redux/forecast-slice';
import type { TimeStep } from '../redux/meta';
import { centerMap, changeLocation, updateTime } from '../redux/meta';
import * as pluginSlice from '../redux/plugin-slice';
import { type AppDispatch, type RootState } from '../redux/store';
import * as unitsSlice from '../redux/units-slice';
import { formatTimestamp } from '../util/utils.js';

// Plugin

export function Plugin() {
  const {
    width,
    startHeight,
    status,
    updateAvailable,
    updateRequired,
    fetchStatus,
    availableVersion,
    isWindyDataAvailable,
  } = useSelector((state: RootState) => {
    const pluginSel = pluginSlice.slice.selectors;
    const forecastSel = forecastSlice.slice.selectors;
    const modelName = pluginSel.selModelName(state);
    const location = pluginSel.selLocation(state);
    const timeMs = pluginSel.selTimeMs(state);
    const isWindyDataAvailable =
      forecastSel.selIsWindyDataAvailable(state, modelName, location) &&
      forecastSel.selIsWindyDataAvailableAt(state, modelName, location, timeMs);
    return {
      width: pluginSel.selWidth(state),
      startHeight: pluginSel.selHeight(state),
      status: pluginSel.selStatus(state),
      updateAvailable: pluginSel.selUpdateAvailable(state),
      updateRequired: pluginSel.selUpdateRequired(state),
      fetchStatus: forecastSel.selFetchStatus(state, modelName, location),
      availableVersion: pluginSel.selAvailableVersion(state),
      modelName,
      location,
      isWindyDataAvailable,
    };
  }, shallowEqual);

  // Resizable height on mobile.
  const [mobileHeight, setMobileHeight] = useState<number | undefined>();
  const height = mobileHeight ?? startHeight;
  let isDragging = false;
  let yOnStartDrag = 0;
  let heightOnStartDrag = 0;

  const dispatch: AppDispatch = useDispatch();
  const selectFavorite = useCallback((location: LatLon) => {
    dispatch(changeLocation(location));
    centerMap(location);
  }, []);

  const startResize = useCallback(
    (e: PointerEvent) => {
      isDragging = true;
      yOnStartDrag = e.screenY;
      heightOnStartDrag = height;
      e.preventDefault();
      e.stopImmediatePropagation();
    },
    [height],
  );

  const resize = useCallback(
    (e: PointerEvent) => {
      if (isDragging) {
        const height = Math.min(
          Math.max(heightOnStartDrag + yOnStartDrag - e.screenY, startHeight / 3),
          startHeight * 1.2,
        );
        setMobileHeight(Math.round(height));
      }
      e.preventDefault();
      e.stopImmediatePropagation();
    },
    [startHeight],
  );

  const endResize = useCallback((e: PointerEvent) => {
    isDragging = false;
    e.preventDefault();
    e.stopImmediatePropagation();
  }, []);

  let ignoreWheelEventUntilMs = 0;
  const handleWheelEvent = useCallback((e: WheelEvent) => {
    const timeMs = Date.now();
    if (timeMs > ignoreWheelEventUntilMs) {
      const size = e.shiftKey || e.ctrlKey ? 'day' : 'hour';
      const step: TimeStep = {
        direction: Math.sign(e.deltaY) > 0 ? 'forward' : 'backward',
        size,
      };
      dispatch(updateTime(step));
      ignoreWheelEventUntilMs = Date.now() + (size === 'day' ? 800 : 20);
    }
    e.stopImmediatePropagation();
    e.preventDefault();
  }, []);

  const isDev = process.env.NODE_ENV === 'development';

  const showDetails = !updateRequired && fetchStatus === forecastSlice.FetchStatus.Loaded;

  const showLoading =
    status !== pluginSlice.PluginStatus.Ready ||
    fetchStatus === forecastSlice.FetchStatus.Idle ||
    fetchStatus === forecastSlice.FetchStatus.Loading;

  let errorMessage: any;

  switch (true) {
    case updateRequired:
      errorMessage = (
        <>
          <p>Update to v{availableVersion} required.</p>
          <p>Uninstall the current version first to install v{availableVersion}</p>
          <div className="button" onClick={openPluginMenu}>
            Update
          </div>
        </>
      );
      break;
    case fetchStatus === forecastSlice.FetchStatus.ErrorOutOfBounds:
      errorMessage = <p>The selected location is out of model bounds.</p>;
      break;

    case fetchStatus === forecastSlice.FetchStatus.Error: {
      errorMessage = <p>Error :(</p>;
      break;
    }

    case !isWindyDataAvailable:
      errorMessage = (
        <>
          <p>Weather data not available.</p>
          <p>Windy premium users have access to extended forecasts.</p>
        </>
      );
      break;
  }

  return (
    <>
      <div
        id="wsp-title"
        className="plugin__title plugin__title--chevron-back desktop-only"
        onClick={openMenu as any}
        onKeyDown={openMenu as any}
        role="button"
        tabIndex={0}
      >
        <img id="wsp-icon" src={flyxcIcon} width="30" height="30" alt="flyXC" />
        {isDev && (
          <span id="wsp-dev" className="badge fg-white bg-orange size-xs">
            dev
          </span>
        )}
        {pluginConfig.title}
        <span id="wsp-version" className="size-s">
          v{pluginConfig.version}
        </span>
      </div>

      <div id="wsp-sounding">
        <section onWheel={handleWheelEvent as any}>
          {updateAvailable && (
            <div id="wsp-update">
              <p>
                New plugin <a onClick={openPluginMenu}>version {availableVersion}</a> available!
              </p>
            </div>
          )}
          {showDetails && <Details />}
          {errorMessage ? (
            <Message {...{ width, height, message: errorMessage }} />
          ) : (
            <svg {...{ height, width }}>
              <defs>
                <pattern
                  id="hatch"
                  patternUnits="userSpaceOnUse"
                  width="8"
                  height="8"
                  patternTransform="rotate(45 2 2)"
                >
                  <rect width="8" height="8" fill="lightyellow" opacity="0.4" />
                  <path d="M 0,-1 L 0,11" stroke="gray" strokeWidth="1" />
                </pattern>
                <filter id="outline" colorInterpolationFilters="sRGB">
                  <feMorphology in="SourceAlpha" result="morph" operator="dilate" radius="2" />
                  <feColorMatrix
                    in="morph"
                    result="whitened"
                    type="matrix"
                    values="-1 0 0 0 1, 0 -1 0 0 1, 0 0 -1 0 1, 0 0 0 1 0"
                  />
                  <feMerge>
                    <feMergeNode in="whitened" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              {showLoading ? (
                <LoadingIndicator x={width / 2} y={height / 2} />
              ) : (
                <>
                  <Graph {...{ width, height, skewTWidthPercent: 80 }} />
                  {W.rootScope.isMobileOrTablet && (
                    <g
                      id="wsp-resize"
                      onPointerDown={(e: any) => startResize(e)}
                      onPointerUp={(e: any) => endResize(e)}
                      onPointerLeave={(e: any) => endResize(e)}
                      onPointerMove={(e: any) => resize(e)}
                    >
                      <rect width="50" height="20" x={Math.round((width - 50) / 2)} y="-5" rx="5" ry="5" />
                      <line x1="-18" x2="18" y1="5" y2="5" transform={`translate(${Math.round(width / 2)} 0)`} />
                      <line x1="-18" x2="18" y1="10" y2="10" transform={`translate(${Math.round(width / 2)} 0)`} />
                    </g>
                  )}
                </>
              )}
            </svg>
          )}
        </section>
        <section>{showDetails && <ConnectedFavorites onSelected={selectFavorite} />}</section>
        <div id="wsp-sponsor" className="bg-red desktop-only">
          <p>Please consider sponsoring the development of this plugin</p>
          <a href="https://www.buymeacoffee.com/vic.b" target="_blank">
            <img
              src="https://cdn.buymeacoffee.com/buttons/default-orange.png"
              alt="Buy Me A Coffee"
              height="30"
              width="150"
            />
          </a>
        </div>
      </div>
    </>
  );
}

// Graph

function Graph({ width, height, skewTWidthPercent }: { width: number; height: number; skewTWidthPercent: number }) {
  const [yPointer, setYpointer] = useState<number | undefined>();

  const dispatch: AppDispatch = useDispatch();

  const setIsZoomedIn = useCallback((expanded: boolean) => dispatch(pluginSlice.setIsZoomedIn(expanded)), []);

  const { minPressure, maxPressure, isZoomedIn } = useSelector((state: RootState) => {
    const pluginSel = pluginSlice.slice.selectors;
    const forecastSel = forecastSlice.slice.selectors;

    const timeMs = pluginSel.selTimeMs(state);
    const isZoomedIn = pluginSel.selIsZoomedIn(state);
    const modelName = pluginSel.selModelName(state);
    const location = pluginSel.selLocation(state);
    const elevation = forecastSel.selElevation(state, modelName, location);
    const minModelPressure = forecastSel.selMinModelPressure(state, modelName, location);
    const pressureToGhScale = forecastSel.selPressureToGhScale(state, modelName, location, timeMs);
    const minPressure = isZoomedIn
      ? Math.round(Math.max(pressureToGhScale.invert(6500 + (elevation * 2) / 5), minModelPressure))
      : minModelPressure;
    const maxPressure = Math.min(1000, Math.round(pressureToGhScale.invert((elevation * 4) / 5)));

    return { isZoomedIn, minPressure, maxPressure };
  }, shallowEqual);

  const skewTWidth = Math.round((width * skewTWidthPercent) / 100);
  const windWidth = width - skewTWidth - 5;

  const moveCursor = useCallback((y: number | undefined) => {
    if (y === undefined) {
      // Do not remove the pointer on mobile.
      if (!W.rootScope.isMobileOrTablet) {
        setYpointer(undefined);
      }
    } else {
      setYpointer(y);
    }
  }, []);

  return (
    <g
      onPointerMove={(e: any) => moveCursor(e.offsetY)}
      onPointerDown={(e: any) => moveCursor(e.offsetY)}
      onPointerLeave={() => moveCursor(undefined)}
    >
      <ConnectedSkewT {...{ width: skewTWidth, height, yPointer, minPressure, maxPressure }} />
      <g transform={`translate(${width - windWidth}, 0)`}>
        <ConnectedWind {...{ width: windWidth, height, yPointer, minPressure, maxPressure }} />
      </g>
      <g id="wsp-zoom" onClick={() => setIsZoomedIn(!isZoomedIn)}>
        <rect x="4" y="4" width="16" height="16" />
        <path
          d={
            isZoomedIn
              ? 'M3 4v16a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1Zm2 1h14v14h-9v-4a1 1 0 0 0-1-1H5Zm6.3 7.7a1 1 0 0 1 0-1.4L14 8.5h-1a1 1 0 0 1 0-2h3.5a1 1 0 0 1 .4 0 1 1 0 0 1 .6 1V11a1 1 0 0 1-2 0v-1l-2.8 2.7a1 1 0 0 1-1.4 0Z'
              : 'M20 21a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1ZM5 5h14v14h-9v-4a1 1 0 0 0-1-1H5Zm6 7.4a1 1 0 0 1 0-.4V8.5a1 1 0 0 1 2 0v1l2.8-2.7a1 1 0 1 1 1.4 1.4L14.4 11h1.1a1 1 0 0 1 0 2H12a1 1 0 0 1-.4 0 1 1 0 0 1-.5-.6Z'
          }
        />
      </g>
    </g>
  );
}

// SkewT

type ChildGraphProps = {
  width: number;
  height: number;
  yPointer: number | undefined;
  minPressure: number;
  maxPressure: number;
};

function ConnectedSkewT(props: ChildGraphProps) {
  const fetchStatus = useSelector((state: RootState) => {
    const pluginSel = pluginSlice.slice.selectors;
    const forecastSel = forecastSlice.slice.selectors;

    const modelName = pluginSel.selModelName(state);
    const location = pluginSel.selLocation(state);
    return forecastSel.selFetchStatus(state, modelName, location);
  });

  if (fetchStatus !== forecastSlice.FetchStatus.Loaded) {
    return;
  }

  const stateProps: Omit<SkewTProps, keyof ChildGraphProps> = useSelector((state: RootState) => {
    const pluginSel = pluginSlice.slice.selectors;
    const unitsSel = unitsSlice.slice.selectors;
    const forecastSel = forecastSlice.slice.selectors;

    const modelName = pluginSel.selModelName(state);
    const location = pluginSel.selLocation(state);
    const timeMs = pluginSel.selTimeMs(state);

    const periodValues = forecastSel.selPeriodValues(state, modelName, location);
    const timeValues = forecastSel.selValuesAt(state, modelName, location, timeMs);
    const isZoomedIn = pluginSel.selIsZoomedIn(state);

    const periodMaxTemp = forecastSel.selMaxPeriodTemp(state, modelName, location);
    const maxTemp = periodMaxTemp + 8;
    const minTemp = periodMaxTemp - 60;
    const formatTemp = unitsSel.selTempFormatter(state);

    return {
      levels: periodValues.levels,
      temps: timeValues.temp,
      dewpoints: timeValues.dewpoint,
      ghs: timeValues.gh,
      seaLevelPressure: timeValues.seaLevelPressure,
      minTemp,
      maxTemp,
      surfaceElevation: forecastSel.selElevation(state, modelName, location),
      parcel: forecastSel.selDisplayParcel(state, modelName, location, timeMs)
        ? forecastSel.selParcel(state, modelName, location, timeMs)
        : undefined,
      formatAltitude: unitsSel.selAltitudeFormatter(state),
      formatTemp,
      tempUnit: unitsSel.selTempUnit(state),
      tempAxisStep: unitsSel.selTempUnit(state) === '°C' ? 10 : 20,
      ghUnit: unitsSel.selAltitudeUnit(state),
      ghAxisStep: unitsSel.selAltitudeUnit(state) === 'm' ? 1000 : 3000,
      showUpperClouds: isZoomedIn,
      cloudCover: forecastSel.selGetCloudCoverGenerator(state, modelName, location, timeMs),
    };
  }, shallowEqual);

  return <SkewT {...{ ...props, ...stateProps }} />;
}

// Wind Profile

function ConnectedWind(props: ChildGraphProps) {
  const fetchStatus = useSelector((state: RootState) => {
    const pluginSel = pluginSlice.slice.selectors;
    const forecastSel = forecastSlice.slice.selectors;

    const modelName = pluginSel.selModelName(state);
    const location = pluginSel.selLocation(state);
    return forecastSel.selFetchStatus(state, modelName, location);
  });

  if (fetchStatus !== forecastSlice.FetchStatus.Loaded) {
    return;
  }

  const stateProps = useSelector((state: RootState) => {
    const pluginSel = pluginSlice.slice.selectors;
    const unitsSel = unitsSlice.slice.selectors;
    const forecastSel = forecastSlice.slice.selectors;

    const modelName = pluginSel.selModelName(state);
    const location = pluginSel.selLocation(state);
    const timeMs = pluginSel.selTimeMs(state);

    if (forecastSel.selFetchStatus(state, modelName, location) === forecastSlice.FetchStatus.Loading) {
      return { isLoading: true };
    }

    const periodValues = forecastSel.selPeriodValues(state, modelName, location);
    const timeValues = forecastSel.selValuesAt(state, modelName, location, timeMs);

    return {
      seaLevelPressure: timeValues.seaLevelPressure,
      levels: periodValues.levels,
      ghs: timeValues.gh,
      windByLevel: forecastSel.selWindDetailsByLevel(state, modelName, location, timeMs),
      format: unitsSel.selWindSpeedFormatter(state),
      unit: unitsSel.selWindSpeedUnit(state),
      surfaceElevation: forecastSel.selElevation(state, modelName, location),
      isFixedRange: pluginSel.selIsZoomedIn(state),
    };
  }, shallowEqual);

  return <WindProfile {...{ ...props, ...stateProps }} />;
}

// Favorites

function ConnectedFavorites({ onSelected }: { onSelected: (location: LatLon) => void }) {
  const props = useSelector((state: RootState) => {
    const S = pluginSlice.slice.selectors;
    return {
      favorites: S.selFavorites(state),
      location: S.selLocation(state),
      isMobile: W.rootScope.isMobileOrTablet,
      modelName: S.selModelName(state),
    };
  }, shallowEqual);

  return <Favorites {...{ ...props, onSelected }} />;
}

// Details (model info)

/**
 * Display sounding details
 *
 * - Weather model
 * - Run timestamp and duration before next run
 * - Current time
 */
function Details() {
  const { modelName, updateMs, nextUpdateMs, timeMs } = useSelector((state: RootState) => {
    const pluginSel = pluginSlice.slice.selectors;
    const forecastSel = forecastSlice.slice.selectors;

    const modelName = pluginSel.selModelName(state);
    const location = pluginSel.selLocation(state);
    const timeMs = pluginSel.selTimeMs(state);

    return {
      modelName: pluginSel.selModelName(state),
      updateMs: forecastSel.selModelUpdateTimeMs(state, modelName, location),
      nextUpdateMs: forecastSel.selModelNextUpdateTimeMs(state, modelName, location),
      timeMs,
    };
  }, shallowEqual);

  const nowMs = Date.now();
  const distanceString = intlFormatDistance(nextUpdateMs, nowMs);

  return (
    <div id="wsp-model" className="desktop-only">
      <dl>
        <dt>Model</dt>
        <dd>{modelName}</dd>
        <dt>Run</dt>
        <dd>
          {formatTimestamp(updateMs)}, next {nextUpdateMs > nowMs ? `${distanceString}` : `overdue (${distanceString})`}
        </dd>
        <dt>Sounding time</dt>
        <dd>{formatTimestamp(timeMs)}</dd>{' '}
      </dl>
    </div>
  );
}

// Watermark

export function Watermark({ x, y }: { x: number; y: number }) {
  const nowMs = Date.now();

  const { updateMs, nextUpdateMs } = useSelector((state: RootState) => {
    const pluginSel = pluginSlice.slice.selectors;
    const forecastSel = forecastSlice.slice.selectors;

    const modelName = pluginSel.selModelName(state);
    const location = pluginSel.selLocation(state);

    return {
      updateMs: forecastSel.selModelUpdateTimeMs(state, modelName, location),
      nextUpdateMs: forecastSel.selModelNextUpdateTimeMs(state, modelName, location),
    };
  }, shallowEqual);

  const distanceString = intlFormatDistance(nextUpdateMs, nowMs);

  return (
    <g id="wsp-watermark" transform={`translate(${x} ${y})`}>
      <text className="title">flyXC Soundings</text>
      <text className="subtitle" dy="7">
        Run {formatTimestamp(updateMs)}, next{' '}
        {nextUpdateMs > nowMs ? `${distanceString}` : `overdue (${distanceString})`}
      </text>
    </g>
  );
}

function openMenu(e: KeyboardEvent | MouseEvent) {
  if (!('key' in e) || e.key == 'Enter') {
    W.broadcast.emit('rqstOpen', 'menu');
  }
}

function openPluginMenu() {
  W.broadcast.emit('rqstOpen', 'external-plugins');
}
