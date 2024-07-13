export function LoadingIndicator({ width, height }: { width: number; height: number }) {
  return (
    <svg {...{ width, height }}>
      <rect {...{ width, height }} fill="#eee" />
      <g transform={`translate(${width / 2 - 9} ${height / 2 - 9}) scale(3)`}>
        <circle r="18" stroke="black" fill="none" stroke-width="2" stroke-dasharray="90 20">
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0"
            to="360"
            dur="1s"
            repeatCount="indefinite"
          />
        </circle>
      </g>
    </svg>
  );
}
