export declare class Vector2 {
  x: number;
  y: number;
}
export declare class Vector3 extends Vector2 {
  z: number;
}
export declare class Vector4 extends Vector3 {
  w: number;
}
export type BoxBounds2D = {
  min: Vector2;
  max: Vector2;
};
