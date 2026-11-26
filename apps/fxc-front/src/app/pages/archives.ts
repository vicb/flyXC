import '../components/ui/google-btn';

import type { TemplateResult } from 'lit';
import { html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { when } from 'lit/directives/when.js';

import { getApiKeyAndHost } from '../apikey';

const NUM_TRACKS = 30;
const IMG_SIZE = 200;

@customElement('archives-page')
export class ArchivesPage extends LitElement {
  @state()
  private connected = false;
  @state()
  tracks: any[] = [];

  private cursor: string | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    this.fetch();
  }

  render(): TemplateResult {
    return html`
      <style>
        #tooltip {
          position: fixed;
          z-index: 1000;
          pointer-events: none;
          padding: 0;
          margin: 0;
          border: 1px solid #aaa;
          display: none;
        }

        #tooltip img {
          padding: 0;
          margin: 0;
        }

        #tooltip[data-show] {
          display: block;
        }
      </style>
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/line-awesome@1/dist/line-awesome/css/line-awesome.min.css"
      />
      <ion-header>
        <ion-toolbar color="primary">
          <ion-title>Track Archives</ion-title>
        </ion-toolbar>
      </ion-header>
      <ion-content>
        ${when(
          !this.connected,
          () =>
            html`<google-btn callback="${import.meta.env.VITE_APP_SERVER}/arc" style="margin-top: 10px"></google-btn>`,
          () => {
            return when(
              this.tracks.length === 0,
              () => 'loading...',
              () =>
                html`<ion-list>
                  ${this.tracks.map((track, i) => {
                    const location = track.city && track.country ? `${track.city} (${track.country})` : 'Flight';
                    const date = new Date(track.created);
                    return html`<ion-item lines="full">
                      <ion-label>
                        <h2>
                          ${location}
                          <a
                            href="/?id=${track.id}"
                            target="_blank"
                            @mouseenter=${(e: any) => this.showPopup(e.target, i)}
                            @mouseleave=${this.hidePopup}
                            ><i class="las la-search"></i
                          ></a>
                        </h2>
                        <p>uploaded on ${date.toLocaleDateString()} ${date.toLocaleTimeString()}</p>
                      </ion-label>
                    </ion-item> `;
                  })}
                </ion-list>`,
            );
          },
        )}
      </ion-content>
      <div id="tooltip" role="tooltip">
        <img id="tooltip-img" />
      </div>
    `;
  }

  private showPopup(el: HTMLElement, i: number) {
    const tooltip = document.getElementById('tooltip');
    const tooltipImg = document.getElementById('tooltip-img');
    if (tooltip && tooltipImg) {
      const track = this.tracks[i];
      tooltipImg.setAttribute(
        'src',
        `https://maps.googleapis.com/maps/api/staticmap?path=weight:3|color:red|enc:${
          track.path
        }&size=${IMG_SIZE}x${IMG_SIZE}&key=${getApiKeyAndHost('GMAPS').key}`,
      );
      const rect = el.getBoundingClientRect();
      const rightLeft = rect.right + 20;
      const left =
        rightLeft + IMG_SIZE + 8 <= window.innerWidth
          ? rightLeft
          : Math.max(8, Math.min(rect.left - IMG_SIZE - 20, window.innerWidth - IMG_SIZE - 8));
      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${Math.max(8, Math.min(rect.top, window.innerHeight - IMG_SIZE - 8))}px`;
      tooltip.setAttribute('data-show', '');
    }
  }

  private hidePopup() {
    document.getElementById('tooltip')?.removeAttribute('data-show');
  }

  private fetch() {
    fetch(`${import.meta.env.VITE_API_SERVER}/api/admin/archives.json?tracks=${NUM_TRACKS}&cursor=${this.cursor}`, {
      credentials: 'include',
    }).then(async (response) => {
      this.connected = response.ok;
      if (response.ok) {
        const { tracks, cursor } = await response.json();
        this.tracks = tracks;
        this.cursor = cursor;
      }
    });
  }

  createRenderRoot(): HTMLElement {
    return this;
  }
}
