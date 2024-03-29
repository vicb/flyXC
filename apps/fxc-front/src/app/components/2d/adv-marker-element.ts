import { LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

// Wrapper component for Advanced Markers.
@customElement('adv-marker-element')
export class AdvancedMarkerElement extends LitElement {
  @property({ attribute: false })
  set lat(value: number) {
    this.lat_ = value;
    this.requestUpdate();
  }

  get lat(): number {
    return this.lat_;
  }

  @property({ attribute: false })
  set lng(value: number) {
    this.lng_ = value;
    this.requestUpdate();
  }

  get lng(): number {
    return this.lng_;
  }

  @property({ attribute: false })
  set title(value: string) {
    this.marker_.title = value;
  }

  get title(): string {
    return this.marker_.title;
  }

  @property({ attribute: false })
  set zindex(value: number) {
    this.marker_.zIndex = value;
  }

  get zindex(): number {
    return this.marker_.zIndex ?? 0;
  }

  @property({ attribute: false })
  set map(value: google.maps.Map | null | undefined) {
    this.marker_.map = value ?? null;
  }

  get map() {
    return this.marker_.map;
  }

  @property({ attribute: false })
  set content(value: Node | null | undefined) {
    this.marker_.content = value;
  }

  get content() {
    return this.marker_.content;
  }

  private lat_ = 0;
  private lng_ = 0;
  private marker_ = new google.maps.marker.AdvancedMarkerElement();

  connectedCallback(): void {
    super.connectedCallback();
    this.marker_.addListener('click', () => this.dispatchEvent(new CustomEvent('click')));
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    google.maps.event.clearInstanceListeners(this.marker_);
    this.marker_.map = null;
  }

  render() {
    this.marker_.position = { lat: this.lat_, lng: this.lng_ };
  }

  protected createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }
}
