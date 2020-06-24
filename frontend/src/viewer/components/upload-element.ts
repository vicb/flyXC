import { css, CSSResult, customElement, html, LitElement, property, TemplateResult } from 'lit-element';

import { uploadTracks } from '../logic/map';

@customElement('upload-ctrl-element')
export class UploadElement extends LitElement {
  @property()
  expanded = false;

  static get styles(): CSSResult[] {
    return [
      css`
        :host {
          display: block;
          border: 1px inset #555;
          padding: 4px;
          margin: 2px 5px;
          background-color: #adff2f;
          text-align: right;
          border-radius: 4px;
          opacity: 0.9;
          user-select: none;
          float: right;
          clear: both;
        }
      `,
    ];
  }

  protected toggleExpanded(): void {
    this.expanded = !this.expanded;
  }

  protected render(): TemplateResult {
    return html`
      <link rel="stylesheet" href="https://kit-free.fontawesome.com/releases/latest/css/free.min.css" />
      <input type="file" multiple id="track" name="track" .hidden=${!this.expanded} @change=${this.upload} />
      <i class="fas fa-cloud-upload-alt fa-2x" style="cursor: pointer" @click=${this.toggleExpanded}></i>
    `;
  }

  protected upload(e: Event): void {
    if (e.target) {
      const el = e.target as HTMLInputElement;
      if (el.files?.length) {
        const files: File[] = [];
        for (let i = 0; i < el.files.length; i++) {
          files.push(el.files[i]);
        }
        uploadTracks(files).then(() => {
          el.value = '';
          this.expanded = false;
        });
      }
    }
  }
}
