import type { ParcelData } from '../util/atmosphere';

export type ParcelProps = {
  parcel: ParcelData;
  width: number;
  pathGenerator: (coordinates: [number, number][]) => string;
  pressureToPxScale: (pressure: number) => number;
  formatAltitude: (altitude: number) => number;
};

export const CUMULUS_PATH =
  'M26 24H6a4 4 0 0 1-1-7.9A7.2 7.2 0 0 1 5 15a7 7 0 0 1 13.7-2 4.5 4.5 0 0 1 2.8-1c2.3 0 4.2 1.8 4.5 4a4 4 0 0 1 0 8z';

// Small/medium clouds that drift slowly in the background
const CUMULUS_SMALL_CLOUDS = [
  { x: 55, y: 118, scale: 0.95 },
  { x: 108, y: 82, scale: 1.1 },
  { x: 158, y: 35, scale: 0.85 },
  { x: 232, y: 132, scale: 0.9 },
  { x: 282, y: 112, scale: 1.05 },
  { x: 308, y: 38, scale: 0.8 },
  { x: 318, y: 88, scale: 1.15 },
];

// Large clouds that drift faster in the foreground
const CUMULUS_LARGE_CLOUDS = [
  { x: 30, y: 48, scale: 1.25 },
  { x: 82, y: 24, scale: 1.35 },
  { x: 135, y: 140, scale: 1.3 },
  { x: 184, y: 98, scale: 1.48 },
  { x: 208, y: 22, scale: 1.22 },
  { x: 258, y: 64, scale: 1.42 },
  { x: 42, y: 142, scale: 1.35 },
];

export function CumulusPattern() {
  return (
    <>
      <pattern id="cumulus-pattern-slow" patternUnits="userSpaceOnUse" width="340" height="160">
        <g fill="lightyellow" stroke="#030104" strokeWidth="1" opacity="0.7">
          {CUMULUS_SMALL_CLOUDS.map(({ x, y, scale }, i) => (
            <path
              key={i}
              className="cumulus bg"
              vectorEffect="non-scaling-stroke"
              transform={`translate(${x}, ${y}) scale(${scale}) translate(-15, -15.5)`}
              d={CUMULUS_PATH}
            />
          ))}
        </g>
      </pattern>
      <pattern id="cumulus-pattern-fast" patternUnits="userSpaceOnUse" width="340" height="160">
        <g fill="lightyellow" stroke="#030104" strokeWidth="1" opacity="0.7">
          {CUMULUS_LARGE_CLOUDS.map(({ x, y, scale }, i) => (
            <path
              key={i}
              className="cumulus bg"
              vectorEffect="non-scaling-stroke"
              transform={`translate(${x}, ${y}) scale(${scale}) translate(-15, -15.5)`}
              d={CUMULUS_PATH}
            />
          ))}
        </g>
      </pattern>
    </>
  );
}

export function Parcel({ parcel, width, pathGenerator, pressureToPxScale, formatAltitude }: ParcelProps) {
  const parts = [];
  const thermalTopY = Math.round(pressureToPxScale(parcel.thermalTopPressure));
  if (parcel.cloudTopPressure) {
    const cloudTopY = Math.round(pressureToPxScale(parcel.cloudTopPressure));
    const h = thermalTopY - cloudTopY;
    parts.push(
      <g key="cumulus-layer" clipPath="url(#convective-clip)">
        <defs>
          <clipPath id="convective-clip">
            <rect x={0} y={cloudTopY} width={width} height={h} />
          </clipPath>
        </defs>
        <rect
          className="cumulus-drift slow"
          x={-340}
          y={cloudTopY}
          width={width + 340}
          height={h}
          fill="url(#cumulus-pattern-slow)"
        />
        <rect
          className="cumulus-drift fast"
          x={-340}
          y={cloudTopY}
          width={width + 340}
          height={h}
          fill="url(#cumulus-pattern-fast)"
        />
      </g>,
      <Cumulus key="cumulus-icon" x={width} y={thermalTopY} />,
      <line key="cloud-top-line" className="boundary" x1={0} y1={cloudTopY} x2={width} y2={cloudTopY} />,
    );
  }
  parts.push(
    <line key="thermal-top-line" className="boundary" x1={0} y1={thermalTopY} x2={width} y2={thermalTopY} />,
    <text key="elev-tick" className="tick" y={thermalTopY + 4} x={width - 7}>
      {formatAltitude(parcel.thermalTopElev)}
    </text>,
    <path key="trajectory" className="line" d={pathGenerator([...parcel.dry, ...parcel.wet])} />,
    <path key="isohume" className="isohume" d={pathGenerator(parcel.isohume)} />,
  );

  return <g className="parcel">{parts}</g>;
}

// https://www.flaticon.com/authors/yannick
function Cumulus({ x, y }: { x: number; y: number }) {
  return <path className="cumulus" transform={`translate(${x - 36}, ${y - 28})`} d={CUMULUS_PATH} />;
}
