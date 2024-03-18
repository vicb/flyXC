import * as common from '@flyxc/common';
import { LitElement, PropertyValues, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { connect } from 'pwa-helpers';
import * as units from '../../logic/units';
import * as sel from '../../redux/selectors';
import { RootState, store } from '../../redux/store';
import { setCurrentTrackId } from '../../redux/track-slice';

import './adv-marker-element';

const INACTIVE_OPACITY = 0.5;

@customElement('marker-element')
export class MarkerElement extends connect(store)(LitElement) {
  @property({ attribute: false })
  map!: google.maps.Map;

  @property({ attribute: false })
  timeSec = 0;
  @property({ attribute: false })
  track?: common.RuntimeTrack;

  @state()
  active = false;
  @state()
  private units!: units.Units;
  @state()
  private displayLabels = true;
  @state()
  private color = 'white';

  private offsetSeconds = 0;
  private markerContent: HTMLDivElement;
  private svg: SVGElement;
  private path: SVGPathElement;
  private label: HTMLParagraphElement;

  constructor() {
    super();
    this.markerContent = document.createElement('div');
    this.markerContent.className = 'fxc-marker';
    this.markerContent.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><path fill="orange" stroke="#000" d="M134.5-168.8A121.8 121.8 0 0 0 99-149.6C86.9-86 55.2-64 30.5-57a5.4 5.4 0 0 1-6.8-4c-.2-.8-.2-1 .2-25.4L11.6-78c-1 .7-2.3 1-3.5 1H-7.3c-1.2 0-2.5-.3-3.5-1l-12.3-8.4c.4 24.4.3 24.6.2 25.3a5.4 5.4 0 0 1-6.8 4.1c-24.6-7-56.3-29-68.4-92.5-3.6-3-15.4-11.9-35.6-19.2-21-7.5-55.2-14.6-102.7-8.2a118.3 118.3 0 0 1 41 93.2c11.9.2 23.7 2.4 34.8 6.6 18 7 40.5 22.6 50.3 57.3 10.9-8.7 27.8-12.6 53.8-12.6A60.8 60.8 0 0 1-8.5-10 71.9 71.9 0 0 1 .3 3.5 73 73 0 0 1 9.2-10a60.8 60.8 0 0 1 48-22.5c26 0 43 4 54 12.7A82.2 82.2 0 0 1 161.5-77a101 101 0 0 1 34.8-6.6 118.3 118.3 0 0 1 41-93.2c-47.5-6.4-81.8.7-102.7 8.2z"/></svg><p class="max-content" style="transform: translate(-50%, 5px)"></p>';
    this.svg = this.markerContent.querySelector('svg')!;
    this.path = this.svg.querySelector('path')!;
    this.label = this.markerContent.querySelector('p')!;
  }

  stateChanged(state: RootState): void {
    if (this.track) {
      const id = this.track.id;
      this.offsetSeconds = sel.offsetSeconds(state)[id] ?? 0;
      this.color = sel.trackColors(state)[id];
      this.active = sel.currentTrackId(state) == id;
    }
    this.units = state.units;
    this.displayLabels = state.track.displayLabels;
  }

  shouldUpdate(changedProps: PropertyValues): boolean {
    if (changedProps.has('color')) {
      this.path.setAttribute('fill', this.color);
      changedProps.delete('color');
    }
    if (changedProps.has('active')) {
      this.path.setAttribute('opacity', `${this.active ? 1 : INACTIVE_OPACITY}`);
      this.path.setAttribute('stroke-color', `${this.active ? '#000' : '#555'}`);
      changedProps.delete('active');
    }

    return super.shouldUpdate(changedProps);
  }

  render() {
    if (!this.track) {
      return nothing;
    }

    const timeSec = this.timeSec + this.offsetSeconds;
    const { lat, lon, alt } = sel.getTrackLatLonAlt(store.getState())(timeSec, this.track) as common.LatLonAlt;
    const altAboveMin = (alt ?? 0) - this.track.minAlt;
    const altDelta = this.track.maxAlt - this.track.minAlt;
    const scale = (50 * altAboveMin) / altDelta + 20;
    // todo
    this.path.setAttribute('transform', `scale(${scale / 512})`);
    this.path.setAttribute('stroke-width', `${2 / (scale / 512)}`);

    let label = '';
    if (this.displayLabels) {
      const altitude = `${units.formatUnit(alt ?? 0, this.units.altitude)}`;
      label = (this.track.name == 'unknown' ? '' : `${this.track.name} · `) + altitude;
    }

    this.label.textContent = label;

    return html`<adv-marker-element
      .map=${this.map}
      .lat=${lat}
      .lng=${lon}
      .content=${this.markerContent}
      .zindex=${Math.floor(alt ?? 0)}
      .title=${label}
      @click=${this.onClick}
      }
    ></adv-marker-element>`;
  }

  private onClick() {
    store.dispatch(setCurrentTrackId(this.track?.id));
  }

  createRenderRoot(): HTMLElement {
    return this;
  }
}
