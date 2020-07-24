import { CSSResult, customElement, html, LitElement, property, TemplateResult } from 'lit-element';

import { addUrlParamValues, ParamNames, pushCurrentState } from '../logic/history';
import { uploadTracks } from '../logic/map';
import { controlHostStyle } from './control-style';

@customElement('upload-ctrl-element')
export class UploadElement extends LitElement {
  @property()
  expanded = false;

  static get styles(): CSSResult {
    return controlHostStyle;
  }

  protected toggleExpanded(): void {
    this.expanded = !this.expanded;
  }

  protected render(): TemplateResult {
    return html`
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/line-awesome@1/dist/line-awesome/css/line-awesome.min.css"
      />
      <input type="file" multiple id="track" name="track" .hidden=${!this.expanded} @change=${this.upload} />
      <i class="la la-cloud-upload-alt la-2x" style="cursor: pointer" @click=${this.toggleExpanded}></i>
    `;
  }

  protected async upload(e: Event): Promise<void> {
    if (e.target) {
      const el = e.target as HTMLInputElement;
      if (el.files?.length) {
        const files: File[] = [];
        for (let i = 0; i < el.files.length; i++) {
          files.push(el.files[i]);
        }
        const ids = await uploadTracks(files);
        pushCurrentState();
        addUrlParamValues(ParamNames.TRACK_ID, ids);
        el.value = '';
        this.expanded = false;
      }
    }
  }
}
