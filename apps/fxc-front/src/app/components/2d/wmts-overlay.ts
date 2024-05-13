import { LitElement } from 'lit';
import { property } from 'lit/decorators.js';

export abstract class WMTSOverlayElement extends LitElement {
  @property({ attribute: false })
  map!: google.maps.Map;

  protected mapBounds?: google.maps.LatLngBounds[];
  protected copyrightEl?: HTMLElement;
  protected registered = false;
  protected mapType?: google.maps.ImageMapType;

  abstract get mapName(): string;
  abstract get copyright(): { html: string; url: string };
  abstract get url(): string;
  abstract get zoom(): number[];
  abstract get bounds(): number[][] | null;

  disconnectedCallback(): void {
    const els = this.map.controls[google.maps.ControlPosition.BOTTOM_RIGHT];
    for (let i = 0; i < els.getLength(); i++) {
      if (els.getAt(i) == this.copyrightEl) {
        els.removeAt(i);
        break;
      }
    }
    this.copyrightEl = undefined;
  }

  shouldUpdate(): boolean {
    if (this.map && !this.registered) {
      this.init(this.map);
      this.registered = true;
      this.dispatchEvent(
        new CustomEvent('overlayready', {
          detail: {
            mapType: () => this.getMapType(),
            copyrightEl: this.copyrightEl,
          },
        }),
      );
    }
    return false;
  }

  protected init(_map: google.maps.Map): void {
    this.createCopyrightElement();
    this.setBounds();
  }

  protected getTileUrl(coord: google.maps.Point, zoom: number): string {
    if (!this.isTileVisible(coord, zoom)) {
      return '';
    }

    const numTiles = Math.pow(2, zoom);
    return this.url
      .replace('{zoom}', String(zoom))
      .replace('{x}', String(((coord.x % numTiles) + numTiles) % numTiles))
      .replace('{y}', String(coord.y));
  }

  protected getMapType(): google.maps.MapType {
    if (!this.mapType) {
      const [minZoom, maxZoom] = this.zoom;
      this.mapType = new google.maps.ImageMapType({
        getTileUrl: (coord: google.maps.Point, zoom: number): string => this.getTileUrl(coord, zoom),
        tileSize: new google.maps.Size(256, 256),
        minZoom,
        maxZoom,
        name: this.mapName,
      });
    }
    return this.mapType;
  }

  protected setBounds(): void {
    const { bounds } = this;
    if (bounds != null) {
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
    const { html, url } = this.copyright;
    this.copyrightEl = document.createElement('div');
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('target', '_blank');
    a.className = 'attribution';
    a.innerHTML = html;
    this.copyrightEl.appendChild(a);
    this.copyrightEl.hidden = true;
    this.map.controls[google.maps.ControlPosition.BOTTOM_RIGHT].push(this.copyrightEl);
  }

  protected isTileVisible(coord: google.maps.Point, zoom: number): boolean {
    if (this.mapBounds == null) {
      return true;
    }
    const numTiles = Math.pow(2, zoom);
    const e = (256 * coord.x) / numTiles;
    const w = (256 * (coord.x + 1)) / numTiles;
    const s = (256 * (coord.y + 1)) / numTiles;
    const n = (256 * coord.y) / numTiles;
    const projection = this.map.getProjection() as google.maps.Projection;
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
      this.visibilityHandler(map.getMapTypeId() as string);
    });
  }

  protected registerMapType(name = (this.constructor as any).mapTypeId, mapType = this.getMapType()): void {
    this.map.mapTypes.set(name, mapType);
  }

  protected visibilityHandler(mapTypeId: string): void {
    if (this.copyrightEl) {
      this.copyrightEl.hidden = mapTypeId != (this.constructor as any).mapTypeId;
    }
  }

  protected createRenderRoot(): HTMLElement {
    return this;
  }
}

// Interpolate tiles when the layer zoom level is greater than the highest available tile zoom.
export abstract class WMTSInterpolatingOverlayElement extends WMTSOverlayElement {
  protected tileSet = new Set<HTMLElement>();
  protected opacity = 1;

  disconnectedCallback() {
    super.disconnectedCallback();
    this.tileSet.clear();
  }

  // Highest available zoom level
  abstract get maxTileZoom(): number;

  protected getTile(coord: google.maps.Point | null, zoom: number, ownerDocument: Document | null): HTMLElement {
    if (coord == null || ownerDocument == null) {
      return null as any;
    }

    const div = ownerDocument.createElement('div') as HTMLDivElement;
    const img = ownerDocument.createElement('img') as HTMLImageElement;
    div.classList.add('fxc-tile');
    img.classList.add('fxc-tile');
    div.appendChild(img);
    img.setAttribute('referrerpolicy', 'no-referrer');
    img.onload = () => {
      img.style.opacity = String(this.opacity);
    };
    img.onerror = () => {
      div.removeChild(img);
    };

    div.style.opacity = String(this.opacity);

    if (zoom <= this.maxTileZoom) {
      img.width = 256;
      img.height = 256;
      img.src = this.getTileUrl(coord, zoom);
    } else {
      const scale = Math.pow(2, zoom - this.maxTileZoom);
      img.width = 256 * scale;
      img.height = 256 * scale;
      img.style.top = `-${(coord.y % scale) * 256}px`;
      img.style.left = `-${(coord.x % scale) * 256}px`;
      img.src = this.getTileUrl(
        new google.maps.Point(Math.floor(coord.x / scale), Math.floor(coord.y / scale)),
        this.maxTileZoom,
      );
    }

    this.tileSet.add(div);

    return div;
  }

  protected releaseTile(tile: Element | null): void {
    if (tile == null) {
      return;
    }
    this.tileSet.delete(tile as HTMLElement);
    const img = tile.childNodes[0] as HTMLImageElement;
    if (img && img.tagName == 'IMG') {
      img.onload = null;
      img.setAttribute('src', '');
    }
  }

  protected getMapType(): google.maps.MapType {
    const [minZoom, maxZoom] = this.zoom;
    return {
      getTile: (...args): HTMLElement => this.getTile(...args),
      tileSize: new google.maps.Size(256, 256),
      minZoom,
      maxZoom,
      name: this.mapName,
      releaseTile: (...args): void => this.releaseTile(...args),
      alt: this.mapName,
      projection: null,
      radius: 6378137,
      setOpacity: (v: number) => {
        for (const tile of this.tileSet) {
          tile.style.opacity = String(v);
        }
        this.opacity = v;
      },
      getOpacity: () => this.opacity,
    } as google.maps.MapType;
  }
}
