type MessageProps = {
  width: number;
  height: number;
  // text or jsx
  message: any;
};

export function Message({ width, height, message }: MessageProps) {
  return (
    <div className="wsp-message" style={{ height: `${height}px`, width: `${width}px` }}>
      {/* the inner div is here so that there is only one direct child for styling */}
      <div>{message}</div>
    </div>
  );
}
