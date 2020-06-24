import { CSSResult, LitElement, TemplateResult, css, customElement, html, property } from 'lit-element';

@customElement('expand-ctrl-element')
export class ExpandElement extends LitElement {
  @property({ attribute: false })
  expanded = false;

  element: Element | null = null;

  constructor() {
    super();
    const fs = document.getElementsByClassName('fs-enabled');
    if (fs && fs.length) {
      const el = (this.element = fs[0]);
      el.addEventListener('fullscreenchange', (_) => {
        this.expanded = document.fullscreenElement != null;
      });
    }
  }

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

  protected toggleExpand(): void {
    this.expanded = !this.expanded;
    if (this.element) {
      if (this.expanded) {
        this.element.requestFullscreen();
      } else {
        document.exitFullscreen();
      }
    }
  }

  render(): TemplateResult {
    return html`
      <link rel="stylesheet" href="https://kit-free.fontawesome.com/releases/latest/css/free.min.css" />
      <i class="fas ${this.expanded ? 'fa-compress' : 'fa-expand'} fa-2x" @click=${this.toggleExpand}></i>
    `;
  }
}
