export class PoisOverlay extends L.Layer {
  className?: string;
  displayed?: boolean;
  _container?: HTMLElement;
  _markers?: Record<string, L.LatLng>;
  constructor(className?: string);
  initialize(this: this, className: string): void;
  getHtml(this: this, id: string, point: L.LatLng, params: { html?: string; style?: string; attrs?: string[] }): string;
  addPois(this: this, html: string, markers: Record<string, L.LatLng>): void;
  getPane(this: this): HTMLElement | undefined;
  removePois(this: this): void;
  replaceMarker(this: this, id: string, html: string): void;
  getAllMarkers(this: this): NodeListOf<HTMLElement>;
  _reset(this: this): void;
  forAllMarkers(this: this, fun: (point: L.LatLng) => L.Point): void;
  getPosReset(this: this, point: L.LatLng): L.Point;
  setPoistion(this: this, marker: HTMLElement, pos: L.Point): void;

  // Just this typings rewrites of leaflet methods
  onAdd(this: this, map: L.Map): this;
  onRemove(this: this, map: L.Map): this;
}
