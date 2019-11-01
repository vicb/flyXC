import { CSSResult, LitElement, PropertyValues, TemplateResult, css, customElement, html, property } from 'lit-element';

declare global {
  interface Window {
    initLogin: () => void;
  }
}

window.initLogin = (): void => {
  window.dispatchEvent(new CustomEvent('login-init'));  
};

declare const gapi: any;

@customElement('tracker-form')
export class TrackerFrom extends LitElement {
  @property({ attribute: false })
  auth: any;

  @property({ attribute: false })
  signedIn = false;

  @property({ attribute: false })
  device = 'no';

  constructor() {
    super();
    window.addEventListener('login-init', () => {
      gapi.load('auth2', async () => {
        this.auth = await gapi.auth2.init({
          client_id: '754556983658-qscerk4tpsu8mgb1kfcq5gvf8hmqsamn.apps.googleusercontent.com',
        });
        gapi.signin2.render('g-signin', {
          scope: 'profile email',
          longtitle: true,
          theme: 'dark',
          onsuccess: (user: any) => this.onSignIn(user),
          onerror: (e: any) => console.log('ERROR', e),
        });
        this.signedIn = this.auth.currentUser.get().isSignedIn();
        this.auth.isSignedIn.listen((signedIn: boolean) => (this.signedIn = signedIn));
      });
    });
  }

  firstUpdated(changedProps: PropertyValues): void {
    super.firstUpdated(changedProps);
    const loader = document.createElement('script');
    loader.src = `https://apis.google.com/js/platform.js?onload=initLogin`;
    const shadowRoot = this.shadowRoot as ShadowRoot;
    shadowRoot.appendChild(loader);
  }  

  static get styles(): CSSResult[] {
    return [
      css`
        :host {
          display: block;
          font: 14px 'Nobile', verdana, sans-serif;
        }
      `,
    ];
  }

  render(): TemplateResult {
    return html`
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bulma@0.8.0/css/bulma.min.css" />
      <section class="hero is-primary">
        <div class="hero-body">
          <div class="container">
            <h1 class="title">
              Tracker configuration
            </h1>
            <h2 class="subtitle">
              Configure your satellite tracking device.
            </h2>
          </div>
        </div>
      </section>

      <div class="container">
        ${!this.signedIn
          ? html`
              <div class="notification">Sign in to configure your tracking device</div>
              <slot name="button"></slot>
            `
          : html`
              <div class="notification">
                ${this.auth.currentUser
                  .get()
                  .getBasicProfile()
                  .getName()},
                select your device:
              </div>
              <form>
                <div class="field">
                  <label class="label">
                    <input
                      type="radio"
                      id="inreach"
                      name="tracker"
                      value="inreach"
                      @change=${(): void => void (this.device = 'inreach')}
                    />
                    InReach
                  </label>
                </div>

                <div class="field" style=${`display:${this.device == 'inreach' ? 'block' : 'none'}`}>
                  <label class="label"
                    >Raw KML data feed
                    <input
                      class="input"
                      type="text"
                      id="inreach-url"
                      name="inreach-url"
                      placeholder="https://inreach.garmin.com/Feed/Share/user_name"
                    />
                  </label>
                  <p class="help">
                    See
                    <a href="https://support.garmin.com/en-US/?faq=tdlDCyo1fJ5UxjUbA9rMY8" target="_blank"
                      >this Garmin post</a
                    >
                    to retrieve the <strong>raw KML data</strong> feed url
                  </p>
                </div>

                <div class="field">
                  <label class="label">
                    <input type="radio" id="spot" name="tracker" value="spot" @change=${() => (this.device = 'spot')} />
                    Spot
                  </label>
                </div>

                <div class="field" style=${`display:${this.device == 'spot' ? 'block' : 'none'}`}>
                  <label class="label"
                    >SPOT id
                    <input id="spot-id" class="input" type="text" name="spot-id" />
                  </label>
                  <p class="help">
                    The id for your spot device is at the end of your shared page url:
                    http://share.findmespot.com/shared/faces/viewspots.jsp?glId=<strong>[id]</strong>
                  </p>
                </div>
                <div class="field">
                  <label class="label">
                    <input type="radio" id="no" name="tracker" value="no" @change=${(): void => void (this.device = 'no')} />
                    Do not track me
                  </label>
                </div>
                <div class="field is-grouped">
                  <p class="control">
                    <a class="button is-primary" @click=${(): void => this.updateTracker()}>
                      Save
                    </a>
                  </p>
                  <p class="control">
                    <a class="button is-light" @click=${(): void => {
                        this.auth.signOut(); 
                        document.location.href = '/';
                    }}>
                      Cancel
                    </a>
                  </p>
                </div>
              </form>
            `}
      </div>
    `;
  }

  protected updateTracker(): void {
    const shadowRoot = this.shadowRoot as ShadowRoot;
    const data = [
      `device=${encodeURIComponent(this.device)}`,
      `token=${encodeURIComponent(this.auth.currentUser.get().getAuthResponse().id_token)}`,
      `inreach=${(shadowRoot.getElementById('inreach-url') as HTMLInputElement)?.value}`,
      `spot=${(shadowRoot.getElementById('spot-id') as HTMLInputElement)?.value}`,
    ];
    fetch('_updateTracker', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: data.join('&'),
    }).then(() => {
      this.auth.signOut();
      document.location.href = "/"
    });
  }

  protected onSignIn(user: any): void {
    const data = [
      `token=${encodeURIComponent(user.getAuthResponse().id_token)}`,
      `email=${encodeURIComponent(user.getBasicProfile().getEmail())}`,   
      `name=${encodeURIComponent(user.getBasicProfile().getName())}`,   
    ]
    fetch('_tokenSignIn', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: data.join('&'),
    })
      .then(r => r.json())
      .then(data => {
        const shadowRoot = this.shadowRoot as ShadowRoot;
        // Radio buttons
        ['inreach', 'spot', 'no'].map(device => {
          const radio = shadowRoot.getElementById(device) as HTMLInputElement;
          if (data.device == device) {
            radio.setAttribute('checked', '');
          }
        });
        this.device = data.device;
        const inreach = shadowRoot.getElementById('inreach-url') as HTMLInputElement;
        inreach.value = data.inreach;
        const spot = shadowRoot.getElementById('spot-id') as HTMLInputElement;
        spot.value = data.spot;
      });
  }
}
