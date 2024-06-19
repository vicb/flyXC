import { connect } from 'react-redux';

import { setLocation, setYPointer, toggleZoom } from '../actions/sounding.js';
import { Favorites } from '../components/favorites.js';
import { LoadingIndicator } from '../components/loading.js';
import { SkewT } from '../components/skewt.js';
import { WindGram } from '../components/wind.js';
import * as skewTSel from '../selectors/skewt.js';
import * as soundingSel from '../selectors/sounding.js';
import * as windSel from '../selectors/wind.js';
import { parcelTrajectory } from '../util/atmosphere.js';

const windyRootScope = W.rootScope;

const statePointerDispatch = (dispatch: any) => ({
  setYPointer: (y: any) => {
    dispatch(setYPointer(y));
  },
});

function stateToSkewTProp(state: any) {
  if (soundingSel.isLoading(state)) {
    return { isLoading: true };
  }
  const parameters = skewTSel.params(state);
  const pSfc = skewTSel.pSfc(state);
  let parcel;

  if (soundingSel.isThermalHours(state)) {
    const thermalT = skewTSel.tSfc(state) + 3;
    const dpSfc = skewTSel.dewpointSfc(state);
    const trajectory = parcelTrajectory(parameters, 40, thermalT, pSfc, dpSfc);
    if (trajectory) {
      // @ts-expect-error TS(2339): Property 'dry' does not exist on type '{}'.
      const { dry, moist, isohume, elevThermalTop, pThermalTop, pCloudTop } = trajectory;
      parcel = {
        trajectory: dry.concat(moist || []),
        isohume,
        elevThermalTop,
        pThermalTop,
        pCloudTop,
      };
    }
  }

  return {
    isLoading: false,
    params: parameters,
    pMax: skewTSel.pMax(state),
    cloudCover: soundingSel.cloudCover(state),
    pSfc,
    parcel,
    formatAltitude: soundingSel.formatAltitude(state),
    formatTemp: soundingSel.formatTemp(state),
    tAxisToPx: skewTSel.tAxisToPx(state),
    tToPx: skewTSel.tToPx(state),
    pToPx: skewTSel.pToPx(state),
    pAxisToPx: skewTSel.pAxisToPx(state),
    line: skewTSel.line(state),
    tMetric: soundingSel.tMetric(state),
    tAxisStep: skewTSel.tAxisStep(state),
    ghMetric: soundingSel.altiMetric(state),
    ghAxisStep: skewTSel.ghAxisStep(state),
    zoom: soundingSel.zoom(state),
    skew: skewTSel.skew(state),
    yPointer: soundingSel.yPointer(state),
  };
}

const ConnectedSkewT = connect(stateToSkewTProp, statePointerDispatch)(SkewT);

const stateToWindProp = (state: any) => {
  return soundingSel.isLoading(state)
    ? {
        isLoading: true,
      }
    : {
        isLoading: false,
        params: skewTSel.params(state),
        windSpeedMax: windSel.windSpeedMax(state),
        format: soundingSel.formatSpeed(state),
        metric: soundingSel.speedMetric(state),
        pSfc: skewTSel.pSfc(state),
        pToPx: skewTSel.pToPx(state),
        speedToPx: windSel.speedToPx(state),
        line: windSel.line(state),
        zoom: soundingSel.zoom(state),
        yPointer: soundingSel.yPointer(state),
      };
};

const ConnectedWindgram = connect(stateToWindProp, statePointerDispatch)(WindGram);

const stateToFavProp = (state: any) => ({
  favorites: soundingSel.favorites(state),
  location: soundingSel.locationKey(state),
  isMobile: windyRootScope.isMobile || windyRootScope.isTablet,
});

export const ConnectedFavorites = connect(stateToFavProp)(Favorites);

const stateToTitleProps = (state: any) => {
  return soundingSel.isLoading(state)
    ? { isLoading: true }
    : {
        isLoading: false,
        modelName: soundingSel.modelName(state),
        updated: soundingSel.modelUpdated(state),
        nextUpdate: soundingSel.modelNextUpdate(state),
      };
};

function formatTimestamp(ts: any) {
  return new Date(ts).toLocaleString([], {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const SoundingTitle = connect(stateToTitleProps)(({ isLoading, modelName, updated, nextUpdate }: any) => {
  if (isLoading) {
    return;
  }
  const updateStr = formatTimestamp(updated);
  const nextStr = formatTimestamp(nextUpdate);

  return (
    <p className="model desktop-only">
      <strong>{modelName.toUpperCase()}</strong> ({updateStr}). Next update on {nextStr}.
    </p>
  );
});

const stateToAppProps = (state: any) => {
  const width = soundingSel.width(state);
  const height = soundingSel.height(state);

  const props = {
    centerMap: soundingSel.centerMap(state),
    wheelHandler: () => null,
    title: () => <p className="model">Loading...</p>,
    chart: () => <LoadingIndicator cx={width / 2} cy={height / 2} />,
    width,
    height,
    graphHeight: soundingSel.graphHeight(state),
    skewTWidth: skewTSel.width(state),
    windgramWidth: windSel.width(state),
    zoom: soundingSel.zoom(state),
  };

  const isLoading = soundingSel.isLoading(state);

  if (isLoading) {
    return props;
  }

  const params = skewTSel.params(state);

  if (!params) {
    return {
      ...props,
      title: () => <p className="model">Forecast not available</p>,
      chart: () => (
        <text x="50%" y="50%" textAnchor="middle">
          Forecast not available
        </text>
      ),
    };
  }

  return {
    ...props,
    title: () => <SoundingTitle />,
    chart: ({ skewTWidth, windgramWidth, height }: any) => (
      <g>
        <ConnectedSkewT width={skewTWidth} height={height} />
        <g transform={`translate(${skewTWidth + soundingSel.GRAPH_GAP_PX}, 0)`}>
          <ConnectedWindgram width={windgramWidth} height={height} />
        </g>
      </g>
    ),
    wheelHandler: soundingSel.wheelHandler(state),
  };
};

const stateToAppDispatch = (dispatch: any) => ({
  onFavSelected:
    (centerMap: any) =>
    ({ lat, lon }: any) => {
      dispatch(setLocation(lat, lon));
      centerMap(lat, lon);
    },

  onZoomClick: () => {
    dispatch(toggleZoom());
  },
});

export const App = connect(
  stateToAppProps,
  stateToAppDispatch,
)(
  ({
    title,
    chart,
    centerMap,
    onFavSelected,
    wheelHandler,
    width,
    height,
    zoom,
    onZoomClick,
    graphHeight,
    skewTWidth,
    windgramWidth,
  }: any) => {
    return (
      <div>
        {title()}
        <div style="position:relative">
          <svg {...{ width, height }} onWheel={wheelHandler}>
            {chart({ height: graphHeight, skewTWidth, windgramWidth })}
          </svg>
          <div id="wsp-zoom" className="iconfont clickable-size" onClick={onZoomClick}>
            {zoom ? '\uE03D' : '\uE03B'}
          </div>
        </div>
        <ConnectedFavorites onSelected={onFavSelected(centerMap)} />
      </div>
    );
  },
);
