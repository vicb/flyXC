import { getPressureToGhScale } from '../util/atmosphere';
import * as math from '../util/math';
import { sampleAt } from '../util/math';

export type WindProfileProps = {
  width: number;
  height: number;
  levels: number[];
  ghs: number[];
  minPressure: number;
  maxPressure: number;
  seaLevelPressure: number;
  windByLevel: { speed: number; direction: number }[];
  unit: string;
  format: (windSpeed: number) => number;
  surfaceElevation: number;
  isFixedRange: boolean;
  yPointer: number | undefined;
};

export function WindProfile(props: WindProfileProps) {
  const {
    width,
    height,
    levels,
    ghs,
    minPressure,
    maxPressure,
    seaLevelPressure,
    windByLevel,
    unit,
    format,
    surfaceElevation,
    isFixedRange,
    yPointer,
  } = props;

  const maxLevelIndex = levels.findIndex((level) => level < minPressure);
  const keepToIndex = maxLevelIndex == -1 ? levels.length - 1 : maxLevelIndex;
  const speedByLevel = windByLevel.map(({ speed }) => speed);
  const directionByLevel = windByLevel.map(({ direction }) => direction);

  // Set the max to at least 30km/h.
  const maxSpeed = Math.max(60 / 3.6, ...speedByLevel.slice(0, keepToIndex + 1));

  const pressureToGhScale = getPressureToGhScale(levels, ghs, seaLevelPressure);
  const ghToPxScale = math.scaleLinear([pressureToGhScale(minPressure), pressureToGhScale(maxPressure)], [0, height]);
  const pressureToPxScale = math.composeScales(pressureToGhScale, ghToPxScale);

  const speedToPxScale = isFixedRange
    ? math.scaleLinear([0, 30 / 3.6, maxSpeed], [0, width / 2, width])
    : math.scaleLinear([0, maxSpeed], [0, width]);

  const pathGenerator = math.svgPath(
    (v: [x: number, y: number]) => speedToPxScale(v[0]),
    (v: [x: number, y: number]) => pressureToPxScale(v[1]),
  );

  const surfacePx = Math.round(ghToPxScale(surfaceElevation));
  const surfacePressure = pressureToGhScale.invert(surfaceElevation);

  let yOffsetCursor = 4;
  let cursorClass = 'top';
  let windAtCursor = 0;
  if (yPointer !== undefined) {
    windAtCursor = sampleAt(levels, speedByLevel, pressureToPxScale.invert(yPointer));
    if (yPointer > height / 2) {
      yOffsetCursor = -4;
      cursorClass = 'bottom';
    }
  }

  return (
    <g className="graph wind">
      <rect width={width} height={height} className="background" />
      <WindAxis {...{ speedToPxScale, width, height, maxSpeed, unit, format, isZoomedIn: isFixedRange }} />
      <path className="speed line" d={pathGenerator(math.zip(speedByLevel, levels))} />
      <g transform={`translate(${width / 2}, 0)`}>
        {levels.map((level: number, i: number) => {
          if (level > surfacePressure) {
            return undefined;
          }
          return <WindSymbol direction={directionByLevel[i]} speed={speedByLevel[i]} y={pressureToPxScale(level)} />;
        })}
      </g>
      <rect className="surface" y={surfacePx} width={width} height={height - surfacePx + 1} />
      {yPointer !== undefined && yPointer < surfacePx && (
        <g className={`cursor ${cursorClass}`}>
          <text className="speed" x={width - 5} y={yPointer + yOffsetCursor}>
            {format(windAtCursor)}
          </text>
          <line y1={yPointer} y2={yPointer} x2={width} />
        </g>
      )}
      <rect width={width} height={height} className="border" />
    </g>
  );
}

function WindAxis({
  height,
  width,
  unit,
  format,
  speedToPxScale,
  maxSpeed,
  isZoomedIn,
}: {
  height: number;
  width: number;
  unit: string;
  format: (windSpeed: number) => number;
  speedToPxScale: math.Scale;
  maxSpeed: number;
  isZoomedIn: boolean;
}) {
  if (isZoomedIn) {
    const x30 = Math.round(speedToPxScale(30 / 3.6));
    const x15 = Math.round(x30 / 2);
    return (
      <g className="axis">
        <rect x={width / 2} width={width / 2} height={height} fill="red" opacity="0.1" />
        <line y1={height} x1={x15} x2={x15} className="speed" />
        <text transform={`translate(${x15 - 5} 80) rotate(-90)`}>{format(15 / 3.6)}</text>
        <text transform={`translate(${x30 - 5} 80) rotate(-90)`}>{format(30 / 3.6)}</text>
        <text transform={`translate(${width - 5} 80) rotate(-90)`}>{`${format(maxSpeed)} ${unit}`}</text>
      </g>
    );
  }

  return (
    <g className="axis">
      <line y1={height} x1={width / 3} x2={width / 3} className="speed" />
      <text transform={`translate(${width / 3 - 5} 80) rotate(-90)`}>{format(maxSpeed / 3)}</text>
      <line y1={height} x1={(2 * width) / 3} x2={(2 * width) / 3} className="speed" />
      <text transform={`translate(${(2 * width) / 3 - 5} 80) rotate(-90)`}>{format((maxSpeed * 2) / 3)}</text>
      <text transform={`translate(${width - 5} 80) rotate(-90)`}>{`${format(maxSpeed)} ${unit}`}</text>
    </g>
  );
}

const WindSymbol = ({ direction, y, speed }: { direction: number; y: number; speed: number }) => {
  return speed > 1 ? (
    <g transform={`translate(0 ${Math.round(y)}) rotate(${direction})`} stroke="black" fill="none">
      <line y2="-30" />
      <path d="M-3,-6L0,0L3,-6" strokeLinejoin="round" />
    </g>
  ) : (
    <g transform={`translate(${Math.round(y)})`} stroke="black" fill="none">
      <circle r="6" />
      <circle r="1" />
    </g>
  );
};
