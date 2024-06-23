import type { LatLon } from '@windy/interfaces';
import { intlFormatDistance } from 'date-fns/intlFormatDistance';
import { useState } from 'preact/hooks';
import { connect } from 'react-redux';

import { Favorites } from '../components/favorites.js';
import { LoadingIndicator } from '../components/loading.js';
import { SkewT, type SkewTProps } from '../components/skewt.js';
import { WindProfile, type WindProfileProps } from '../components/wind-profile.jsx';
import { pluginConfig } from '../config';
import flyxcIcon from '../img/jumoplane.svg';
import { centerMap, changeLocation } from '../redux/meta';
import * as pluginSlice from '../redux/plugin-slice';
import { type RootState } from '../redux/store';
import { formatTimestamp } from '../util/utils.js';

function stateToSkewTProp(state: RootState, ownProps: SkewTProps) {
  const S = pluginSlice.selectors;

  if (S.selWindyDataIsLoading(state)) {
    return { isLoading: true };
  }

  const { width, height, yPointer, minPressure, maxPressure } = ownProps as SkewTProps & { isLoading: false };

  const periodValues = S.selPeriodValues(state);
  const timeValues = S.selValuesAtCurrentTime(state);
  const isZoomedIn = S.selIsZoomedIn(state);

  const periodMaxTemp = S.selMaxPeriodTemp(state);
  const maxTemp = periodMaxTemp + 8;
  const minTemp = periodMaxTemp - 60;
  const formatTemp = S.selTempFormatter(state);

  return {
    width,
    height,
    yPointer,
    levels: periodValues.levels,
    temps: timeValues.temp,
    dewpoints: timeValues.dewpoint,
    ghs: timeValues.gh,
    minPressure,
    maxPressure,
    seaLevelPressure: timeValues.seaLevelPressure,
    minTemp,
    maxTemp,
    surfaceElevation: S.selElevation(state),
    parcel: S.selDisplayParcel(state) ? S.selParcel(state) : undefined,
    formatAltitude: S.selAltitudeFormatter(state),
    formatTemp,
    tempUnit: S.selTempUnit(state),
    tempAxisStep: S.selTempUnit(state) === '°C' ? 10 : 20,
    ghUnit: S.selAltitudeUnit(state),
    ghAxisStep: S.selAltitudeUnit(state) === 'm' ? 1000 : 3000,
    showUpperClouds: isZoomedIn,
    cloudCover: S.selGetCloudCoverGenerator(state),
  };
}

const ConnectedSkewT = connect(stateToSkewTProp)(SkewT);

const stateToWindProp = (state: RootState, ownProps: WindProfileProps): WindProfileProps => {
  const S = pluginSlice.selectors;

  if (S.selWindyDataIsLoading(state)) {
    return { isLoading: true };
  }

  const periodValues = S.selPeriodValues(state);
  const timeValues = S.selValuesAtCurrentTime(state);

  const { width, height, minPressure, maxPressure, yPointer } = ownProps as WindProfileProps & { isLoading: false };
  return {
    width,
    height,
    minPressure,
    maxPressure,
    seaLevelPressure: timeValues.seaLevelPressure,
    levels: periodValues.levels,
    ghs: timeValues.gh,
    windByLevel: S.selWindDetailsByLevel(state),
    format: S.selWindSpeedFormatter(state),
    unit: S.selWindSpeedUnit(state),
    surfaceElevation: S.selElevation(state),
    isFixedRange: S.selIsZoomedIn(state),
    yPointer,
  };
};

const ConnectedWind = connect(stateToWindProp)(WindProfile);

const stateToFavProp = (state: RootState) => {
  const S = pluginSlice.selectors;
  return {
    favorites: S.selFavorites(state),
    location: S.selLocation(state),
    isMobile: W.rootScope.isMobileOrTablet,
    modelName: S.selModelName(state),
  };
};

export const ConnectedFavorites = connect(stateToFavProp)(Favorites);

enum AppStatus {
  Loading,
  Ready,
  DataNotAvailable,
  OutOfBounds,
  Error,
}

type GraphProps = {
  width: number;
  height: number;
  skewTWidthPercent: number;
  onWheel: (e: WheelEvent) => void;
} & (
  | {
      status: AppStatus.Loading | AppStatus.DataNotAvailable | AppStatus.OutOfBounds | AppStatus.Error;
    }
  | {
      status: AppStatus.Ready;
      minPressure: number;
      maxPressure: number;
      isZoomedIn: boolean;
      setIsZoomedIn: (expanded: boolean) => void;
      modelName: string;
      updateMs: number;
      nextUpdateMs: number;
      timeMs: number;
    }
);

function stateToGraphProps(state: RootState, ownProps: GraphProps) {
  const S = pluginSlice.selectors;

  const width = S.selWidth(state);
  const height = S.selHeight(state);

  const props = {
    status: AppStatus.Loading,
    width,
    height,
    skewTWidthPercent: ownProps.skewTWidthPercent ?? 50,
    onWheel: (e: WheelEvent) => e.preventDefault(),
  };

  if (S.selWindyDataIsLoading(state)) {
    return props;
  }

  props.onWheel = S.selWheelEventHandler(state);

  if (S.selIsOutOfModelBounds(state)) {
    return {
      ...props,
      status: AppStatus.OutOfBounds,
    };
  }

  if (!S.selAreValuesAvailableAtCurrentTime(state)) {
    return {
      ...props,
      status: AppStatus.DataNotAvailable,
    };
  }

  const elevation = S.selElevation(state);
  const minModelPressure = S.selMinModelPressure(state);
  const pressureToGhScale = S.selPressureToGhScale(state);
  const minPressure = S.selIsZoomedIn(state)
    ? Math.round(Math.max(pressureToGhScale.invert(6500 + (elevation * 2) / 5), minModelPressure))
    : minModelPressure;
  const maxPressure = Math.min(1000, Math.round(pressureToGhScale.invert((elevation * 4) / 5)));

  return {
    ...props,
    status: AppStatus.Ready,
    minPressure,
    maxPressure,
    isZoomedIn: S.selIsZoomedIn(state),
  };
}

function stateToGraphDispatch(dispatch: any) {
  return {
    updateLocation: (latLon: LatLon) => {
      dispatch(changeLocation(latLon));
      centerMap(latLon);
    },

    setIsZoomedIn(expanded: boolean) {
      dispatch(pluginSlice.setIsZoomedIn(expanded));
    },
  };
}

let isDragging = false;

let yOnStartDrag = 0;
let heightOnStartDrag = 0;

export const Graph = connect(
  stateToGraphProps,
  stateToGraphDispatch,
)((props: GraphProps) => {
  const { status, width, skewTWidthPercent, onWheel } = props;

  const [yPointer, setYpointer] = useState<number | undefined>();
  const [mobileHeight, setMobileHeight] = useState<number | undefined>();

  const height = mobileHeight ?? props.height;

  if (status === AppStatus.Loading) {
    return (
      <>
        <svg {...{ height, width }}>
          <LoadingIndicator x={width / 2} y={height / 2} />
        </svg>
      </>
    );
  }

  if (status !== AppStatus.Ready) {
    return (
      <>
        <div class="wsp-message" style={{ height: `${height}px`, width: `${height}px` }}>
          <div>
            <p>The selected location is out of model bounds.</p>
          </div>
        </div>
      </>
    );
  }

  const { setIsZoomedIn, minPressure, maxPressure, isZoomedIn } = props as any;

  const skewTWidth = Math.round((width * skewTWidthPercent) / 100);
  const windWidth = width - skewTWidth - 5;

  // https://www.petercollingridge.co.uk/tutorials/svg/interactive/dragging/
  function dragStart(e: PointerEvent) {
    isDragging = true;
    yOnStartDrag = e.screenY;
    heightOnStartDrag = height;
    e.preventDefault();
    e.stopImmediatePropagation();
  }

  function dragEnd(e: PointerEvent) {
    isDragging = false;
    e.preventDefault();
    e.stopImmediatePropagation();
  }

  function drag(e: PointerEvent) {
    if (isDragging) {
      const height = Math.min(
        Math.max(heightOnStartDrag + yOnStartDrag - e.screenY, props.height / 3),
        props.height * 1.2,
      );
      setMobileHeight(Math.round(height));
    }
    e.preventDefault();
    e.stopImmediatePropagation();
  }

  return (
    <>
      <Details />
      <svg {...{ onWheel, height, width }}>
        <defs>
          <pattern id="hatch" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45 2 2)">
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
        <g onPointerMove={(e: PointerEvent) => setYpointer(e.offsetY)} onPointerLeave={() => setYpointer(undefined)}>
          <ConnectedSkewT {...{ width: skewTWidth, height, yPointer, minPressure, maxPressure }} />
          <g transform={`translate(${width - windWidth}, 0)`}>
            <ConnectedWind {...{ width: windWidth, height, yPointer, minPressure, maxPressure }} />
          </g>
          <g id="wsp-zoom" title={isZoomedIn ? 'shrink' : 'expand'} onClick={() => setIsZoomedIn(!isZoomedIn)}>
            <rect x="4" y="4" width="16" height="16" />
            <path
              d={
                isZoomedIn
                  ? 'M3 4v16a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1Zm2 1h14v14h-9v-4a1 1 0 0 0-1-1H5Zm6.3 7.7a1 1 0 0 1 0-1.4L14 8.5h-1a1 1 0 0 1 0-2h3.5a1 1 0 0 1 .4 0 1 1 0 0 1 .6 1V11a1 1 0 0 1-2 0v-1l-2.8 2.7a1 1 0 0 1-1.4 0Z'
                  : 'M20 21a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1ZM5 5h14v14h-9v-4a1 1 0 0 0-1-1H5Zm6 7.4a1 1 0 0 1 0-.4V8.5a1 1 0 0 1 2 0v1l2.8-2.7a1 1 0 1 1 1.4 1.4L14.4 11h1.1a1 1 0 0 1 0 2H12a1 1 0 0 1-.4 0 1 1 0 0 1-.5-.6Z'
              }
            />
          </g>
          {W.rootScope.isMobileOrTablet && (
            <g
              id="wsp-resize"
              onpointerdown={(e) => dragStart(e)}
              onpointerup={(e) => dragEnd(e)}
              onpointerleave={(e) => dragEnd(e)}
              onpointermove={(e) => drag(e)}
            >
              <rect width="50" height="20" x={Math.round((width - 50) / 2)} y="-5" rx="5" ry="5" />
              <line x1="-18" x2="18" y1="5" y2="5" transform={`translate(${Math.round(width / 2)} 0)`} />
              <line x1="-18" x2="18" y1="10" y2="10" transform={`translate(${Math.round(width / 2)} 0)`} />
            </g>
          )}
        </g>
      </svg>
    </>
  );
});

const stateToDetailsProps = (state: RootState) => {
  const S = pluginSlice.selectors;

  return {
    modelName: S.selModelName(state),
    updateMs: S.selModelUpdateTimeMs(state),
    nextUpdateMs: S.selModelNextUpdateTimeMs(state),
    timeMs: S.selTimeMs(state),
  };
};

/**
 * Display sounding details
 *
 * - Weather model
 * - Run timestamp and duration before next run
 * - Current time
 */
const Details = connect(stateToDetailsProps)(({ modelName, updateMs, nextUpdateMs, timeMs }: DetailsProps) => {
  const nowMs = Date.now();
  const distanceString = intlFormatDistance(nextUpdateMs, nowMs);

  return (
    <div id="wsp-model" class="desktop-only">
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
});

type WatermarkProps = {
  updateMs: number;
  nextUpdateMs: number;
  timeMs: number;
  x: number;
  y: number;
};

const stateToWatermarkProps = (state: RootState) => {
  const S = pluginSlice.selectors;

  return {
    updateMs: S.selModelUpdateTimeMs(state),
    nextUpdateMs: S.selModelNextUpdateTimeMs(state),
    timeMs: S.selTimeMs(state),
  };
};

export const Watermark = connect(stateToWatermarkProps)(({ x, y, updateMs, nextUpdateMs }: WatermarkProps) => {
  const nowMs = Date.now();
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
});

function stateToAppDispatch(dispatch: any) {
  return {
    updateLocation: (latLon: LatLon) => {
      dispatch(changeLocation(latLon));
      centerMap(latLon);
    },
  };
}

type AppProps = {
  updateLocation: (location: LatLon) => void;
};

export const App = connect(
  null,
  stateToAppDispatch,
)(({ updateLocation }: AppProps) => {
  const isDev = process.env.NODE_ENV === 'development';
  return (
    <>
      <div
        id="wsp-title"
        class="plugin__title plugin__title--chevron-back desktop-only"
        onclick={openMenu}
        onkeydown={openMenu}
        role="button"
        tabindex="0"
      >
        <img id="wsp-icon" src={flyxcIcon} width="30" height="30" alt="flyXC" />
        {isDev && (
          <span id="wsp-dev" class="badge fg-white bg-orange size-xs">
            dev
          </span>
        )}
        {pluginConfig.title}
        <span id="wsp-version" class="size-s">
          v{pluginConfig.version}
        </span>
      </div>

      <div id="wsp-sounding">
        <section>
          <Graph skewTWidthPercent={80} />
        </section>
        <section>
          <ConnectedFavorites onSelected={updateLocation} />
        </section>
        <div id="wsp-sponsor" class="bg-red desktop-only">
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
});

function openMenu(e: KeyboardEvent | MouseEvent) {
  if (!('key' in e) || e.key == 'Enter') {
    W.broadcast.emit('rqstOpen', 'menu');
  }
}
