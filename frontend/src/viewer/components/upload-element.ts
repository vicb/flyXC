import { css, CSSResult, customElement, html, LitElement, TemplateResult } from 'lit-element';

import { addUrlParamValues, ParamNames, pushCurrentState } from '../logic/history';
import { uploadTracks } from '../logic/tracks';
import { controlStyle } from './control-style';

@customElement('upload-ctrl-element')
export class UploadElement extends LitElement {
  static get styles(): CSSResult[] {
    return [
      controlStyle,
      css`
        #track {
          position: absolute;
          left: 10000px;
        }
      `,
    ];
  }

  protected render(): TemplateResult {
    return html`
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/line-awesome@1/dist/line-awesome/css/line-awesome.min.css"
      />
      <input type="file" multiple id="track" name="track" @change=${this.upload} />
      <i class="la la-cloud-upload-alt la-2x" style="cursor: pointer" @click=${this.forwardClick}></i>
    `;
  }

  // Programmatically opens the file dialog.
  private forwardClick(): void {
    (this.renderRoot.querySelector('#track') as HTMLInputElement)?.click();
  }

  private async upload(e: Event): Promise<void> {
    if (e.target) {
      const el = e.target as HTMLInputElement;
      if (el.files?.length) {
        const files: File[] = [];
        for (let i = 0; i < el.files.length; i++) {
          files.push(el.files[i]);
        }
        const ids = await uploadTracks(files);
        pushCurrentState();
        addUrlParamValues(ParamNames.groupId, ids);
        el.value = '';
      }
    }
  }
}
