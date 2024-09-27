export class CanvasLayer extends L.Layer {
  targetPane?: 'mapPane' | 'tilePane' | 'overlayPane' | 'objectsPane' | 'popupPane' | 'shadowPane' | 'markerPane';
  _showCanvasOn?: boolean;
  failed?: boolean;
  _canvas?: L.CanvasElement | null;
  _center?: L.LatLng;
  _zoom?: number;
  _frame?: number | null;
  wasOnZoom?: boolean;
  options: L.LayerOptions & {
    disableAutoReset: boolean;
    padding: number;
  };

  initialize(this: this, options?: L.LayerOptions): void;
  onResizeCanvas(this: this, width: number, height: number): void;
  showCanvas(this: this, on: boolean): void;
  reset(this: this): void;
  canvasDisplay(this: this, enable: boolean): void;
  getCanvas(this: this): L.CanvasElement | undefined | null;
  redraw(this: this): void;

  _resize(this: this, event: L.ResizeEvent): void;
  _animateZoom(this: this, e: L.ZoomAnimEvent): void;
  _onZoom(this: this): void;
  _onZoomStart(this: this): void;
  _onZoomEnd(this: this): void;
  _moveEnd(this: this): void;
  _reset(this: this): void;
  _redraw(this: this): void;
  _updateTransform(center: L.LatLng, zoom: number): void;

  /** TODO empty by default */
  onInit(this: this): void;

  /** TODO true by default */
  onCreateCanvas(this: this, canvas?: HTMLElement): boolean;

  /** TODO empty by default */
  onCanvasFailed(this: this): void;

  /** TODO empty by default */
  onRemoveCanvas(this: this, canvas?: HTMLElement): void;

  /** TODO empty by default */
  onMoveEnd(this: this): void;

  /** TODO empty by default */
  onZoomEnd(this: this): void;

  /** TODO empty by default */
  onReset(this: this): void;

  // Just this typings rewrites of leaflet methods
  onAdd(this: this, map: L.Map): this;
  addTo(this: this, map: L.Map): this;
  onRemove(this: this, map: L.Map): this;

  onContextLost(): void;
  onContextRestored(): void;
  onContextCreationError(e: WebGLContextEvent): void;
  canvasHooks(canvas: L.CanvasElement | null | undefined, on: boolean): void;
}
