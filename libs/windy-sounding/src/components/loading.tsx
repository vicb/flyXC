export function LoadingIndicator({ x, y }: { x: number; y: number }) {
  return (
    <svg width="100" height="100" viewBox="-25 -25 50 50" x={x - 50} y={y - 50}>
      <g fill="none">
        <circle r="18" stroke="#ddd" stroke-width="2" stroke-dasharray="90 20">
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
