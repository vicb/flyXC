import { createSelector } from 'reselect';

import * as math from '../util/math';
import { params, pToPx } from './skewt';
import { GRAPH_WINDGRAM_WIDTH_PERCENT, width as totalWidth, zoom } from './sounding';

export const width = (state: any) => Math.floor((totalWidth(state) * GRAPH_WINDGRAM_WIDTH_PERCENT) / 100);

export const windSpeedMax = createSelector(params, (params) => (params ? Math.max(60 / 3.6, ...params.windSpeed) : 0));

export const speedToPx = createSelector(windSpeedMax, width, zoom, (speedMax, width, zoom) =>
  zoom ? math.scaleLinear([0, 30 / 3.6, speedMax], [0, width / 2, width]) : math.scaleLinear([0, speedMax], [0, width]),
);

export const line = createSelector(speedToPx, pToPx, (speedToPx, pToPx) =>
  math.line(
    (v: any) => speedToPx(v[0]),
    (v: any) => pToPx(v[1]),
  ),
);
