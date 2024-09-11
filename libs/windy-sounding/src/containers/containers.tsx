import type { LatLon } from '@windy/interfaces';
import { intlFormatDistance } from 'date-fns/intlFormatDistance';
import { useCallback, useState } from 'preact/hooks';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';

import { Favorites } from '../components/favorites';
import { LoadingIndicator } from '../components/loading';
import { Message } from '../components/message';
import { SkewT, type SkewTProps } from '../components/skewt';
import { WindProfile } from '../components/wind-profile';
import { pluginConfig } from '../config';
import flyxcIcon from '../img/jumoplane.svg';
import * as forecastSlice from '../redux/forecast-slice';
import type { TimeStep } from '../redux/meta';
import { centerMap, changeLocation, updateTime } from '../redux/meta';
import * as pluginSlice from '../redux/plugin-slice';
import { type AppDispatch, type RootState } from '../redux/store';
import * as unitsSlice from '../redux/units-slice';
import { formatTimestamp } from '../util/utils';

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
    isWindyDataAvailableAtCurrentTime,
    modelName,
    location,
  } = useSelector((state: RootState) => {
    const modelName = pluginSlice.selModelName(state);
    const location = pluginSlice.selLocation(state);
    const timeMs = pluginSlice.selTimeMs(state);
    const fetchStatus = forecastSlice.selFetchStatus(state, modelName, location);
    let isWindyDataAvailableAtCurrentTime;
    try {
      isWindyDataAvailableAtCurrentTime = forecastSlice.selIsWindyDataAvailableAt(state, modelName, location, timeMs);
    } catch (e) {
      isWindyDataAvailableAtCurrentTime = false;
    }
    return {
      width: pluginSlice.selWidth(state),
      startHeight: pluginSlice.selHeight(state),
      status: pluginSlice.selStatus(state),
      updateAvailable: pluginSlice.selUpdateAvailable(state),
      updateRequired: pluginSlice.selUpdateRequired(state),
      fetchStatus,
      availableVersion: pluginSlice.selAvailableVersion(state),
      modelName,
      location,
      isWindyDataAvailableAtCurrentTime,
    };
  }, shallowEqual);

  if (startHeight === 0) {
    return;
  }

  // Resizable height on mobile.
  const [mobileHeight, setMobileHeight] = useState<number | undefined>();
  const height = mobileHeight ?? startHeight;
  let isDragging = false;
  let yOnStartDrag = 0;
  let heightOnStartDrag = 0;

  const dispatch: AppDispatch = useDispatch();
  // Fetch data when the cache has expired.
  dispatch(forecastSlice.fetchForecast({ modelName, location }));
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
      ignoreWheelEventUntilMs = timeMs + (size === 'day' ? 600 : 50);
    } else if (ignoreWheelEventUntilMs < timeMs + 50) {
      // Ignore bursts of events (windows/mac).
      ignoreWheelEventUntilMs += 10;
    }
    e.stopImmediatePropagation();
    e.preventDefault();
  }, []);

  const isDev = process.env.NODE_ENV === 'development';

  const isLoading =
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
          <div className="button" role="button" tabIndex={0} onClick={openPluginMenu}>
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

    case !isWindyDataAvailableAtCurrentTime:
      errorMessage = (
        <>
          <p>Weather data not available.</p>
          <p>
            Windy <a href="/subscription">premium users</a> have access to extended forecasts.
          </p>
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
          {updateRequired || <Details />}
          {errorMessage && !isLoading ? (
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
              {isLoading ? (
                <LoadingIndicator {...{ width, height }} />
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
        <section>
          <ConnectedFavorites onSelected={selectFavorite} />
        </section>
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
    const timeMs = pluginSlice.selTimeMs(state);
    const isZoomedIn = pluginSlice.selIsZoomedIn(state);
    const modelName = pluginSlice.selModelName(state);
    const location = pluginSlice.selLocation(state);
    const elevation = forecastSlice.selElevation(state, modelName, location);
    const minModelPressure = forecastSlice.selMinModelPressure(state, modelName, location);
    const pressureToGhScale = forecastSlice.selPressureToGhScale(state, modelName, location, timeMs);
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
  const stateProps: Omit<SkewTProps, keyof ChildGraphProps> = useSelector((state: RootState) => {
    const modelName = pluginSlice.selModelName(state);
    const location = pluginSlice.selLocation(state);
    const timeMs = pluginSlice.selTimeMs(state);

    const periodValues = forecastSlice.selPeriodValues(state, modelName, location);
    const timeValues = forecastSlice.selValuesAt(state, modelName, location, timeMs);
    const isZoomedIn = pluginSlice.selIsZoomedIn(state);

    const periodMaxTemp = forecastSlice.selMaxPeriodTemp(state, modelName, location);
    const maxTemp = periodMaxTemp + 8;
    const minTemp = periodMaxTemp - 60;
    const formatTemp = unitsSlice.selTempFormatter(state);

    return {
      levels: periodValues.levels,
      temps: timeValues.temp,
      dewpoints: timeValues.dewpoint,
      ghs: timeValues.gh,
      seaLevelPressure: timeValues.seaLevelPressure,
      minTemp,
      maxTemp,
      surfaceElevation: forecastSlice.selElevation(state, modelName, location),
      parcel: forecastSlice.selDisplayParcel(state, modelName, location, timeMs)
        ? forecastSlice.selParcel(state, modelName, location, timeMs)
        : undefined,
      formatAltitude: unitsSlice.selAltitudeFormatter(state),
      formatTemp,
      tempUnit: unitsSlice.selTempUnit(state),
      tempAxisStep: unitsSlice.selTempUnit(state) === '°C' ? 10 : 20,
      ghUnit: unitsSlice.selAltitudeUnit(state),
      ghAxisStep: unitsSlice.selAltitudeUnit(state) === 'm' ? 1000 : 3000,
      showUpperClouds: isZoomedIn,
      cloudCover: forecastSlice.selGetCloudCoverGenerator(state, modelName, location, timeMs),
    };
  }, shallowEqual);

  return <SkewT {...{ ...props, ...stateProps }} />;
}

// Wind Profile

function ConnectedWind(props: ChildGraphProps) {
  const stateProps = useSelector((state: RootState) => {
    const modelName = pluginSlice.selModelName(state);
    const location = pluginSlice.selLocation(state);
    const timeMs = pluginSlice.selTimeMs(state);

    if (forecastSlice.selFetchStatus(state, modelName, location) === forecastSlice.FetchStatus.Loading) {
      return { isLoading: true };
    }

    const periodValues = forecastSlice.selPeriodValues(state, modelName, location);
    const timeValues = forecastSlice.selValuesAt(state, modelName, location, timeMs);

    return {
      seaLevelPressure: timeValues.seaLevelPressure,
      levels: periodValues.levels,
      ghs: timeValues.gh,
      windByLevel: forecastSlice.selWindDetailsByLevel(state, modelName, location, timeMs),
      format: unitsSlice.selWindSpeedFormatter(state),
      unit: unitsSlice.selWindSpeedUnit(state),
      surfaceElevation: forecastSlice.selElevation(state, modelName, location),
      isFixedRange: pluginSlice.selIsZoomedIn(state),
    };
  }, shallowEqual);

  return <WindProfile {...{ ...props, ...stateProps }} />;
}

// Favorites

function ConnectedFavorites({ onSelected }: { onSelected: (location: LatLon) => void }) {
  const props = useSelector((state: RootState) => {
    const S = pluginSlice;
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
  const { modelName, updateMs, nextUpdateMs, timeMs, isWindyDataAvailable } = useSelector((state: RootState) => {
    const modelName = pluginSlice.selModelName(state);
    const location = pluginSlice.selLocation(state);
    const timeMs = pluginSlice.selTimeMs(state);

    let isWindyDataAvailable;
    try {
      isWindyDataAvailable = forecastSlice.selLoadedWindyDataOrThrow(state, modelName, location);
    } catch (e) {
      isWindyDataAvailable = false;
    }

    return {
      modelName: pluginSlice.selModelName(state),
      updateMs: isWindyDataAvailable ? forecastSlice.selModelUpdateTimeMs(state, modelName, location) : 0,
      nextUpdateMs: isWindyDataAvailable ? forecastSlice.selModelNextUpdateTimeMs(state, modelName, location) : 0,
      timeMs,
      isWindyDataAvailable,
    };
  }, shallowEqual);

  const nowMs = Date.now();
  const distanceString = isWindyDataAvailable ? intlFormatDistance(nextUpdateMs, nowMs) : '';

  return (
    <div id="wsp-model" className="desktop-only">
      <dl>
        <dt>Model</dt>
        <dd>{W.products[modelName].modelName}</dd>
        <dt>Run</dt>
        <dd>
          {isWindyDataAvailable
            ? `${formatTimestamp(updateMs)}, next ${
                nextUpdateMs > nowMs ? distanceString : `overdue (${distanceString})`
              }`
            : `...`}
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
    const modelName = pluginSlice.selModelName(state);
    const location = pluginSlice.selLocation(state);

    return {
      updateMs: forecastSlice.selModelUpdateTimeMs(state, modelName, location),
      nextUpdateMs: forecastSlice.selModelNextUpdateTimeMs(state, modelName, location),
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
