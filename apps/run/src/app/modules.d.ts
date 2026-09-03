declare module 'google-polyline' {
  const polyline: {
    encode(points: Array<[number, number] | { lat: number; lng: number } | { x: number; y: number }>): string;
    decode(str: string): Array<[number, number]>;
  };
  export default polyline;
}
