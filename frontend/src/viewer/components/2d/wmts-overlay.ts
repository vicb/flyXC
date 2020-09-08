import { LitElement, property } from 'lit-element';
// Warning: those are not the same at lit-element ones.
import { html as baseHtml, render as baseRender, TemplateResult } from 'lit-html';

export abstract class WMTSOverlayElement extends LitElement {
  map_: google.maps.Map | undefined;

  @property()
  get map(): google.maps.Map | undefined {
    return this.map_;
  }
  set map(map: google.maps.Map | undefined) {
    this.map_ = map;
    if (map && !this.registered) {
      this.init(map);
      this.registered = true;
      this.dispatchEvent(
        new CustomEvent('overlayready', { detail: { mapType: (): google.maps.ImageMapType => this.getMapType() } }),
      );
    }
  }

  protected mapBounds: google.maps.LatLngBounds[] | null = null;
  protected copyrightEl?: HTMLElement;
  protected registered = false;

  abstract get mapName(): string;
  abstract get copyright(): { html: TemplateResult; url: string };
  abstract get url(): string;
  abstract get zoom(): number[];
  abstract get bounds(): number[][] | null;

  protected init(map: google.maps.Map): void {
    this.createCopyrightElement();
    this.setBounds();
  }

  protected getTileUrl(coord: google.maps.Point, zoom: number): string {
    if (!this.isTileVisible(coord, zoom)) {
      return '';
    }

    const numTiles = Math.pow(2, zoom);
    return this.url
      .replace('{zoom}', zoom.toString())
      .replace('{x}', (((coord.x % numTiles) + numTiles) % numTiles).toString())
      .replace('{y}', coord.y.toString());
  }

  protected getMapType(): google.maps.ImageMapType {
    const [minZoom, maxZoom] = this.zoom;
    return new google.maps.ImageMapType({
      getTileUrl: (...args): string => this.getTileUrl(...args),
      tileSize: new google.maps.Size(256, 256),
      minZoom,
      maxZoom,
      name: this.mapName,
    });
  }

  protected setBounds(): void {
    const bounds = this.bounds;
    if (bounds == null) {
      this.mapBounds = null;
    } else {
      this.mapBounds = bounds.map((b) => {
        const lats = [b[0], b[2]].sort();
        const lons = [b[1], b[3]].sort();

        return new google.maps.LatLngBounds(
          new google.maps.LatLng(lats[0], lons[0]),
          new google.maps.LatLng(lats[1], lons[3]),
        );
      });
    }
  }

  protected createCopyrightElement(): void {
    if (this.map) {
      const { html, url } = this.copyright;
      this.copyrightEl = document.createElement('div');
      baseRender(
        baseHtml`
          <a href=${url} target="_blank" class="attribution">${html}</a>
        `,
        this.copyrightEl,
      );
      this.copyrightEl.hidden = true;
      this.map.controls[google.maps.ControlPosition.BOTTOM_RIGHT].push(this.copyrightEl);
    }
  }

  protected isTileVisible(coord: google.maps.Point, zoom: number): boolean {
    if (this.mapBounds == null) {
      return true;
    }
    const map = this.map;
    if (!map) {
      return false;
    }
    const numTiles = Math.pow(2, zoom);
    const e = (256 * coord.x) / numTiles;
    const w = (256 * (coord.x + 1)) / numTiles;
    const s = (256 * (coord.y + 1)) / numTiles;
    const n = (256 * coord.y) / numTiles;
    const projection = map.getProjection() as google.maps.Projection;
    const tileBounds = new google.maps.LatLngBounds(
      projection.fromPointToLatLng(new google.maps.Point(w, s)),
      projection.fromPointToLatLng(new google.maps.Point(e, n)),
    );
    return this.mapBounds.some((b) => b.intersects(tileBounds));
  }
}

export abstract class WMTSMapTypeElement extends WMTSOverlayElement {
  protected init(map: google.maps.Map): void {
    super.init(map);
    this.registerMapType((this.constructor as any).mapTypeId);
    map.addListener('maptypeid_changed', () => {
      this.visibilityHandler(map.getMapTypeId());
    });
  }

  protected registerMapType(
    name = (this.constructor as any).mapTypeId,
    mapType: google.maps.ImageMapType = this.getMapType(),
  ): void {
    if (this.map) {
      this.map.mapTypes.set(name, mapType);
    }
  }

  protected visibilityHandler(mapTypeId: string): void {
    if (this.copyrightEl) {
      this.copyrightEl.hidden = mapTypeId != (this.constructor as any).mapTypeId;
    }
  }
}
