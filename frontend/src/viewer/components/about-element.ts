import { css, CSSResult, customElement, html, LitElement, TemplateResult } from 'lit-element';

@customElement('about-ctrl-element')
export class AboutElement extends LitElement {
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
        .form-fields {
          display: flex;
          flex-direction: column;
          justify-content: space-evenly;
          align-items: flex-start;
          text-align: left;
          margin: 1rem;
          min-width: 200px;
        }
        .form-fields a {
          outline: none;
          color: inherit;
          font-weight: bold;
          text-decoration: none;
        }
      `,
    ];
  }

  render(): TemplateResult {
    return html`
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/line-awesome@1/dist/line-awesome/css/line-awesome.min.css"
      />
      <i class="la la-info-circle la-2x" style="cursor: pointer" @click=${this.openDialog}></i>
      <ui5-dialog id="about-dialog" header-text="FlyXC.app">
        <section class="form-fields">
          <div>
            <ui5-label
              >FlyXC by <a href="https://github.com/vicb" target="_blank">Victor Berchet</a>,
              <a href="https://github.com/mmomtchev" target="_blank">Momtchil Momtchev</a>.</ui5-label
            >
          </div>
          <br />
          <div>
            <ui5-label
              >See the
              <a href="https://github.com/vicb/flyxc/blob/master/README.md" target="_blank">Quick Start guide</a
              >.</ui5-label
            >
          </div>
          <br />
          <div>
            <ui5-label
              >Airspaces from
              <a href="http://www.openaip.net" target="_blank">openaip.net</a>
            </ui5-label>
          </div>
          <div>
            <ui5-label
              >Airways from
              <a href="https://thermal.kk7.ch" target="_blank">thermal.kk7.ch</a>
            </ui5-label>
          </div>
          <div>
            <ui5-label
              >Line Awesome icon font from
              <a href="https://icons8.com/line-awesome" target="_blank">icons8</a>
            </ui5-label>
          </div>          
          <br />
          <div>
            <ui5-label>build <%BUILD%></ui5-label>
          </div>
          <br />
          <div>
            <ui5-label
              >Report issues on
              <a href="https://github.com/vicb/flyxc/issues" target="_blank"
                >github <i class="lab la-github-square"></i></a
            ></ui5-label>
          </div>
        </section>
        <div slot="footer" style="display:flex;align-items:center;padding:.5rem">
          <div style="flex: 1"></div>
          <ui5-button design="Emphasized" @click=${this.closeDialog}>Close</ui5-button>
        </div>
      </ui5-dialog>
    `;
  }

  protected openDialog(): void {
    const shadowRoot = this.shadowRoot as ShadowRoot;
    const dialog = shadowRoot.getElementById('about-dialog');
    (dialog as any).open();
  }

  protected closeDialog(): void {
    const shadowRoot = this.shadowRoot as ShadowRoot;
    const dialog = shadowRoot.getElementById('about-dialog');
    (dialog as any).close();
  }
}
