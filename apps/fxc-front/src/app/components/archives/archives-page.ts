import { css, CSSResult, html, LitElement, TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { when } from 'lit/directives/when.js';
import { getApiKey } from '../../apikey';
import '../ui/google-btn';

const NUM_TRACKS = 30;

@customElement('archives-page')
export class ArchivesPage extends LitElement {
  @state()
  private connected = false;

  @state()
  tracks: any[] = [];

  static get styles(): CSSResult {
    return css`
      img.map-track {
        width: 50px;
        height: 50px;
      }
    `;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.fetch();
  }

  render(): TemplateResult {
    if (!this.connected) {
      return html`<google-btn callback="/arc" style="margin-top: 10px"></google-btn>`;
    }

    return html`${when(
      !this.tracks,
      () => '',
      () =>
        this.tracks.map((track) => {
          const location = track.city && track.country ? ` - ${track.city} (${track.country})` : '';
          const date = new Date(track.created);
          return html`
            <img
              width="50px"
              height="50px"
              src="https://maps.googleapis.com/maps/api/staticmap?path=weight:3|color:red|enc:${track.path}&size=100x100&key=${getApiKey(
                'gmaps',
              )}"
            />
            <a href="/?id=${track.id}">
              Track${location} - ${date.toLocaleDateString()} ${date.toLocaleTimeString()}
            </a>
          `;
        }),
    )}`;
  }

  private fetch() {
    fetch(`/api/admin/archives.json?tracks=${NUM_TRACKS}`).then(async (response) => {
      this.connected = response.ok;
      if (response.ok) {
        this.tracks = await response.json();
      }
    });
  }

  createRenderRoot(): HTMLElement {
    return this;
  }
}
