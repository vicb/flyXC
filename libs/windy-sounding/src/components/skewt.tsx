import { Watermark } from '../containers/containers.jsx';
import * as atm from '../util/atmosphere.js';
import type { CloudCoverGenerator } from '../util/clouds.js';
import type { Scale } from '../util/math.js';
import * as math from '../util/math.js';
import { Parcel } from './parcel.jsx';

export type SkewTProps =
  | {
      isLoading?: true;
    }
  | {
      isLoading?: false;
      width: number;
      height: number;
      yPointer: number | undefined;
      levels: number[];
      temps: number[];
      dewpoints: number[];
      ghs: number[];
      seaLevelPressure: number;
      minPressure: number;
      maxPressure: number;
      minTemp: number;
      maxTemp: number;
      cloudCover: CloudCoverGenerator;
      surfaceElevation: number;
      parcel: atm.ParcelData | undefined;
      formatAltitude: (altitude: number) => number;
      formatTemp: (temp: number) => number;
      tempUnit: string;
      tempAxisStep: number;
      ghUnit: string;
      ghAxisStep: number;
      showUpperClouds: boolean;
    };

export function SkewT(props: SkewTProps) {
  if (props.isLoading === true) {
    return;
  }

  const {
    width,
    height,
    levels,
    temps,
    ghs,
    dewpoints,
    minPressure,
    maxPressure,
    seaLevelPressure,
    minTemp,
    maxTemp,
    cloudCover,
    surfaceElevation,
    parcel,
    formatAltitude,
    formatTemp,
    tempUnit,
    ghUnit,
    // Elevation step in windy unit.
    ghAxisStep,
    showUpperClouds,
    yPointer,
  } = props as SkewTProps & { isLoading: false };

  // The full height include the ticks at the bottom.

  const pressureToGhScale = atm.getPressureToGhScale(levels, ghs, seaLevelPressure);
  const ghMeterToPxScale = math.scaleLinear(
    [pressureToGhScale(minPressure), pressureToGhScale(maxPressure)],
    [0, height],
  );
  const ghAxisToPxScale =
    ghUnit === 'm' ? ghMeterToPxScale : math.composeScales(math.scaleLinear([0, 1], [0, 0.3048]), ghMeterToPxScale);
  const pressureToPxScale = math.composeScales(pressureToGhScale, ghMeterToPxScale);

  const tempToPxScale = math.scaleLinear([minTemp, maxTemp], [0, width]);

  const skew = (75 * (width / height) * Math.log10(maxPressure / minPressure)) / (maxTemp - minTemp);

  const pathGenerator = math.svgPath(
    (point: [x: number, y: number]): number => tempToPxScale(point[0]) + skew * (height - pressureToPxScale(point[1])),
    (point: [x: number, y: number]): number => pressureToPxScale(point[1]),
  );

  const surfacePx = Math.round(ghMeterToPxScale(surfaceElevation));

  let tempAtCursor = 0;
  let dewPointAtCursor = 0;
  if (yPointer !== undefined) {
    tempAtCursor = math.sampleAt(levels, temps, pressureToPxScale.invert(yPointer));
    dewPointAtCursor = math.sampleAt(levels, dewpoints, pressureToPxScale.invert(yPointer));
  }

  return (
    <svg width={width} height={height}>
      <g className="graph skewt">
        <rect width={width} height={height} className="background" />
        <Watermark x={Math.round(width / 2)} y={Math.round(height / 2)} />
        <g className="axis">
          <g className="dry-adiabatic">
            {[-20, -10, 0, 10, 20, 30, 40, 50, 60, 70, 80].map((temp) => (
              <DryAdiabatic
                {...{ temp: temp + 273.15, pressure: maxPressure, height, pressureToPxScale, pathGenerator }}
              />
            ))}
          </g>
          <g className="wet-adiabatic">
            {[-20, -10, 0, 5, 10, 15, 20, 25, 30, 35].map((temp) => (
              <WetAdiabatic
                {...{ temp: temp + 273.15, pressure: maxPressure, height, pressureToPxScale, pathGenerator }}
              />
            ))}
          </g>
          <g className="isohume">
            {[-20, -15, -10, -5, 0, 5, 10, 15, 20].map((temp) => (
              <IsoHume
                {...{ temp: temp + 273.15, pressure: maxPressure, height: height, pressureToPxScale, pathGenerator }}
              />
            ))}
          </g>
          <g className="isotherm">
            {[-70, -60, -50, -40, -30, -20, -10, 0, 10, 20, 30, 40].map((temp) => (
              <IsoTherm
                {...{
                  temp: temp + 273.15,
                  height,
                  pressureToPxScale,
                  pathGenerator,
                  tempToPxScale,
                  unit: tempUnit,
                  skew,
                  surfacePx,
                  format: formatTemp,
                }}
              />
            ))}
          </g>
          <AltitudeAxis
            {...{
              width,
              ghToPxScale: ghAxisToPxScale,
              step: ghAxisStep,
              unit: ghUnit,
            }}
          />
        </g>
        <g className="cloud">
          <Clouds
            {...{
              width,
              cloudCover,
              pressureToPxScale,
              surfacePressure: pressureToGhScale.invert(surfaceElevation),
              showUpperClouds,
            }}
          />
        </g>
        <g className="line">
          {parcel && <Parcel {...{ parcel, width, height, pathGenerator, pressureToPxScale, formatAltitude }} />}
          <path className="temperature" d={pathGenerator(math.zip(temps, levels))} />
          <path className="dewpoint" d={pathGenerator(math.zip(dewpoints, levels))} />
        </g>
        <rect className="surface" y={surfacePx} width={width} height={height - surfacePx + 1} />
        {yPointer !== undefined && yPointer < surfacePx ? (
          <g className="cursor">
            <text class="altitude" x={width - 7} y={yPointer + 4}>
              {formatAltitude(ghMeterToPxScale.invert(yPointer))}
            </text>
            <text
              class="temperature"
              x={tempToPxScale(tempAtCursor) + skew * (height - yPointer) + 10}
              y={yPointer + 4}
            >
              {formatTemp(tempAtCursor)}
            </text>
            <text
              class="dewpoint"
              x={tempToPxScale(dewPointAtCursor) + skew * (height - yPointer) + 10}
              y={yPointer + 4}
            >
              {formatTemp(dewPointAtCursor)}
            </text>
            <line y1={yPointer} y2={yPointer} x2={width} />
          </g>
        ) : null}
        <rect width={width} height={height} className="border" />
      </g>
    </svg>
  );
}

function DryAdiabatic({
  temp,
  pressure,
  height,
  pressureToPxScale,
  pathGenerator: line,
}: {
  temp: number;
  pressure: number;
  height: number;
  pressureToPxScale: Scale;
  pathGenerator: (points: [x: number, y: number][]) => string;
}) {
  const points = [];
  const stepPx = height / 15;
  for (let y = height; y > -stepPx; y -= stepPx) {
    const p = pressureToPxScale.invert(y);
    const t = atm.dryLapse(p, temp, pressure);
    points.push([t, p]);
  }

  return <path d={line(points)} />;
}

function WetAdiabatic({
  temp,
  pressure,
  height,
  pressureToPxScale,
  pathGenerator,
}: {
  temp: number;
  pressure: number;
  height: number;
  pressureToPxScale: Scale;
  pathGenerator: (points: [x: number, y: number][]) => string;
}) {
  const points = [];
  let previousPressure = pressure;
  const stepPx = height / 15;
  for (let y = height; y > -stepPx; y -= stepPx) {
    const p = pressureToPxScale.invert(y);
    temp += (p - previousPressure) * atm.wetTempGradient(p, temp);
    previousPressure = p;
    points.push([temp, p]);
  }

  return <path d={pathGenerator(points)} />;
}

function IsoHume({
  temp,
  pressure,
  height,
  pressureToPxScale,
  pathGenerator,
}: {
  temp: number;
  pressure: number;
  height: number;
  pressureToPxScale: Scale;
  pathGenerator: (points: [x: number, y: number][]) => string;
}) {
  const points = [];
  const mixingRatio = atm.mixingRatio(atm.saturationVaporPressure(temp), pressure);
  const stepPx = height;
  for (let y = height; y > -stepPx; y -= stepPx) {
    const pressure = pressureToPxScale.invert(y);
    const temp = atm.dewpoint(atm.vaporPressure(pressure, mixingRatio));
    points.push([temp, pressure]);
  }
  return <path d={pathGenerator(points)} />;
}

function IsoTherm({
  temp,
  height,
  pressureToPxScale,
  pathGenerator,
  unit,
  tempToPxScale,
  skew,
  surfacePx,
  format,
}: {
  temp: number;
  height: number;
  pressureToPxScale: Scale;
  pathGenerator: (points: [x: number, y: number][]) => string;
  unit: string;
  tempToPxScale: Scale;
  skew: number;
  surfacePx: number;
  format: (temp: number) => number;
}) {
  const isZero = Math.round(temp) == 273;

  const points: [x: number, y: number][] = [
    [temp, pressureToPxScale.invert(height)],
    [temp, pressureToPxScale.invert(0)],
  ];
  const props = isZero ? { className: 'zero' } : {};

  const x = Math.round(tempToPxScale(temp));
  const angleRad = Math.atan2(-1, skew);
  const angleDeg = Math.round((180 * angleRad) / Math.PI);
  const yText = height - surfacePx + 10;

  return (
    <>
      <path {...props} d={pathGenerator(points)} />
      <text {...props} transform={`translate(${x} ${height}) rotate(${angleDeg}) translate(${yText} -5)`}>{`${format(
        temp,
      )}${isZero ? ` ${unit}` : ''}`}</text>
    </>
  );
}

function AltitudeAxis({
  ghToPxScale,
  width,
  unit,
  step,
}: {
  ghToPxScale: Scale;
  width: number;
  unit: string;
  step: number;
}) {
  const children = [];
  let y = Math.round(ghToPxScale(step));

  for (let elevation = step, isLast; !isLast; elevation += step) {
    const yNext = Math.round(ghToPxScale(elevation + step));
    isLast = yNext < 20;
    children.push(
      <line y1={y} x2={width} y2={y} />,
      <text y={y - 5} x={5}>{`${elevation}${isLast ? ` ${unit}` : ''}`}</text>,
    );
    y = yNext;
  }

  return <g class="altitude">{children}</g>;
}

export type CloudsProp = {
  width: number;
  cloudCover: CloudCoverGenerator;
  pressureToPxScale: Scale;
  surfacePressure: number;
  showUpperClouds: boolean;
};

function Clouds({ width, cloudCover, pressureToPxScale, surfacePressure, showUpperClouds }: CloudsProp) {
  const rects = [];

  let y = 0;

  if (showUpperClouds) {
    y = 30;
    const upperPressure = pressureToPxScale.invert(y);
    const upperCover = cloudCover(upperPressure, 150);

    if (upperCover < 255) {
      rects.push(
        <Cloud y={0} width={width} height={30} cover={upperCover} />,
        <text className="tick" y={30 - 12} x={width - 28} textAnchor="end">
          Upper
        </text>,
        <Cirrus x={width - 20} y={10} scale={0.4}></Cirrus>,
        <line y1="30" y2="30" x2={width} className="boundary" />,
      );
    }
  }

  // Then respect the y scale
  const surfaceY = pressureToPxScale(surfacePressure);
  while (y < surfaceY) {
    const startY = y;
    const cover = cloudCover(pressureToPxScale.invert(y));
    let layerHeight = 1;
    while (y++ < surfaceY && cloudCover(pressureToPxScale.invert(y)) == cover) {
      layerHeight++;
    }
    rects.push(<Cloud y={startY} width={100} height={layerHeight} cover={cover} />);
  }

  return <g>{rects}</g>;
}

function Cloud({ y, height, width, cover }: { y: number; height: number; width: number; cover: number }) {
  if (cover == 255) {
    // We do not want to display a white background for no cloud but nothing.
    // It is more efficient than setting opacity to 0.
    return;
  }
  return <rect {...{ y, height, width }} fill={`rgba(${cover}, ${cover}, ${cover}, 0.7)`} />;
}

function Cirrus({ x, y, scale }: { x: number; y: number; scale: number }) {
  return (
    <g className="cirrus" transform={`translate(${x}, ${y}) scale(${scale})`}>
      <rect x="10" y="10" width="20" height="4" />
      <rect x="0" y="10" width="6" height="4" />
      <rect x="6" y="0" width="20" height="4" />
      <rect x="30" y="0" width="6" height="4" />
      <rect x="6" y="20" width="20" height="4" />
      <rect x="30" y="20" width="6" height="4" />
    </g>
  );
}
