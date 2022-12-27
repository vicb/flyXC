// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck

import { css, CSSResult, html, LitElement, TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import { getApiKey } from '../apikey';

declare const Tooltip: any;

@customElement('xc-archives')
export class ArchivesElement extends LitElement {
  @property()
  numtracks = 0;

  @property()
  tracks: any[] = [];

  popper: any = null;

  static get styles(): CSSResult {
    return css`
      :host {
        display: block;
        font: 14px 'Nobile', verdana, sans-serif;
      }
      .popper,
      .tooltip {
        position: absolute;
        background: #aaa;
        color: black;
        border-radius: 3px;
        box-shadow: 0 0 5px rgba(0, 0, 0, 0.5);
        padding: 2px;
        text-align: center;
      }
      .popper .popper__arrow,
      .tooltip .tooltip-arrow {
        width: 0;
        height: 0;
        border-style: solid;
        position: absolute;
        margin: 5px;
      }
      .tooltip .tooltip-arrow,
      .popper .popper__arrow {
        border-color: #aaa;
      }
      .popper[x-placement^='top'],
      .tooltip[x-placement^='top'] {
        margin-bottom: 5px;
      }
      .popper[x-placement^='top'] .popper__arrow,
      .tooltip[x-placement^='top'] .tooltip-arrow {
        border-width: 5px 5px 0 5px;
        border-left-color: transparent;
        border-right-color: transparent;
        border-bottom-color: transparent;
        bottom: -5px;
        left: calc(50% - 5px);
        margin-top: 0;
        margin-bottom: 0;
      }
      .popper[x-placement^='bottom'],
      .tooltip[x-placement^='bottom'] {
        margin-top: 5px;
      }
      .tooltip[x-placement^='bottom'] .tooltip-arrow,
      .popper[x-placement^='bottom'] .popper__arrow {
        border-width: 0 5px 5px 5px;
        border-left-color: transparent;
        border-right-color: transparent;
        border-top-color: transparent;
        top: -5px;
        left: calc(50% - 5px);
        margin-top: 0;
        margin-bottom: 0;
      }
      .tooltip[x-placement^='right'],
      .popper[x-placement^='right'] {
        margin-left: 5px;
      }
      .popper[x-placement^='right'] .popper__arrow,
      .tooltip[x-placement^='right'] .tooltip-arrow {
        border-width: 5px 5px 5px 0;
        border-left-color: transparent;
        border-top-color: transparent;
        border-bottom-color: transparent;
        left: -5px;
        top: calc(50% - 5px);
        margin-left: 0;
        margin-right: 0;
      }
      .popper[x-placement^='left'],
      .tooltip[x-placement^='left'] {
        margin-right: 5px;
      }
      .popper[x-placement^='left'] .popper__arrow,
      .tooltip[x-placement^='left'] .tooltip-arrow {
        border-width: 5px 0 5px 5px;
        border-top-color: transparent;
        border-right-color: transparent;
        border-bottom-color: transparent;
        right: -5px;
        top: calc(50% - 5px);
        margin-left: 0;
        margin-right: 0;
      }
    `;
  }

  connectedCallback(): void {
    fetch(`/api/track/archives.pbf?tracks=${this.numtracks}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((tracks) => (this.tracks = tracks));
    super.connectedCallback();
  }

  render(): TemplateResult {
    return html`
      <h1>Track list</h1>
      ${this.tracks.map((track) => {
        const location = track.city && track.country ? ` - ${track.city} (${track.country})` : '';
        const date = new Date(track.created);
        return html`
          <a
            href="/?id=${track.id}"
            @mouseenter=${(e: MouseEvent): void => this.createPopper(e, track.path)}
            @mouseleave=${this.destroyPopper}
          >
            Track${location} - ${date.toLocaleDateString()} ${date.toLocaleTimeString()} </a
          ><br />
        `;
      })}
    `;
  }

  protected createPopper(e: MouseEvent, path: string): void {
    this.destroyPopper();
    const target = e.target as HTMLElement;
    this.popper = new Tooltip(target, {
      placement: 'right',
      html: true,
      title: `<img src="https://maps.googleapis.com/maps/api/staticmap?path=weight:3|color:red|enc:${path}&size=300x300&key=${getApiKey(
        'gmaps',
      )}">`,
    });
    this.popper.show();
  }

  protected destroyPopper(): void {
    this.popper?.dispose();
    this.popper = null;
  }
}
