import type { ParcelData } from '../util/atmosphere';

export type ParcelProps = {
  parcel: ParcelData;
  width: number;
  pathGenerator: (coordinates: [number, number][]) => string;
  pressureToPxScale: (pressure: number) => number;
  formatAltitude: (altitude: number) => number;
};

export function Parcel({ parcel, width, pathGenerator, pressureToPxScale, formatAltitude }: ParcelProps) {
  const parts = [];
  const thermalTopY = Math.round(pressureToPxScale(parcel.thermalTopPressure));
  if (parcel.cloudTopPressure) {
    const cloudTopY = Math.round(pressureToPxScale(parcel.cloudTopPressure));
    parts.push(
      <rect y={cloudTopY} height={thermalTopY - cloudTopY} width={width} className="cumulus" />,
      <Cumulus x={width} y={thermalTopY} />,
      <line className="boundary" y1={cloudTopY} y2={cloudTopY} x2={width} />,
    );
  }
  parts.push(
    <line className="boundary" y1={thermalTopY} y2={thermalTopY} x2={width} />,
    <text className="tick" y={thermalTopY + 4} x={width - 7}>
      {formatAltitude(parcel.thermalTopElev)}
    </text>,
    <path className="line" d={pathGenerator([...parcel.dry, ...parcel.wet])} />,
  );
  parts.push(<path className="isohume" d={pathGenerator(parcel.isohume)} />);

  return <g className="parcel">{parts}</g>;
}

// https://www.flaticon.com/authors/yannick
function Cumulus({ x, y }: { x: number; y: number }) {
  return (
    <path
      className="cumulus"
      transform={`translate(${x - 36}, ${y - 28})`}
      d="M26 24H6a4 4 0 0 1-1-7.9A7.2 7.2 0 0 1 5 15a7 7 0 0 1 13.7-2 4.5 4.5 0 0 1 2.8-1c2.3 0 4.2 1.8 4.5 4a4 4 0 0 1 0 8z"
    />
  );
}
