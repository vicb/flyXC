import type { Scale } from '../util/math.js';

/**
 * Defines a gradient vector parallel to the Skew-T temperature axis, so a
 * temperature keeps the same color at every pressure level. Its vector is
 * `(gradientLength, skew * gradientLength)`; `gradientLength` is the
 * horizontal temperature range projected onto that vector.
 *
 * @param tempToPxScale Maps a temperature to its horizontal chart position.
 * @param gradientMinTemp Lowest temperature represented by the color scale.
 * @param gradientMaxTemp Highest temperature represented by the color scale.
 * @param height Chart height in pixels.
 * @param skew Horizontal displacement per vertical pixel in the Skew-T projection.
 * @param gradientTempStops Color stops normalized across the temperature range.
 */
export function TemperatureGradient({
  tempToPxScale,
  gradientMinTemp,
  gradientMaxTemp,
  height,
  skew,
  gradientTempStops,
}: {
  tempToPxScale: Scale;
  gradientMinTemp: number;
  gradientMaxTemp: number;
  height: number;
  skew: number;
  gradientTempStops: { offset: number; color: string }[];
}) {
  const xMinTemp = tempToPxScale(gradientMinTemp);
  const x1 = xMinTemp + skew * height;
  // Project the horizontal temperature range onto the gradient vector.
  const gradientLength = (tempToPxScale(gradientMaxTemp) - xMinTemp) / (1 + skew ** 2);

  return (
    <linearGradient
      id="tempGrad"
      gradientUnits="userSpaceOnUse"
      {...{ x1 }}
      y1="0"
      x2={x1 + gradientLength}
      y2={skew * gradientLength}
    >
      {gradientTempStops.map(({ offset, color }) => (
        <stop key={offset} offset={offset} stop-color={color} />
      ))}
    </linearGradient>
  );
}
