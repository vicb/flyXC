/**
 * Updated version of @pwabuilder/pwainstall.
 *
 * https://github.com/pwa-builder/PWABuilder/blob/main/components/pwa-install
 *
 * Based on v 1.6.10 - only 1.6.7 is available on npm as of June 2024.
 */

import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { when } from 'lit/directives/when.js';

interface ManifestData {
  name: string;
  short_name: string;
  description: string;
  screenshots: Array<any>;
  features: Array<any>;
  icons: Array<any>;
}

@customElement('pwa-install')
export class PWAInstallComponent extends LitElement {
  @property({ type: String }) manifestpath = 'manifest.json';
  @property({ type: String }) iconpath = '';
  @property({ type: Object }) manifestdata: ManifestData = {
    name: '',
    short_name: '',
    description: '',
    icons: [],
    screenshots: [],
    features: [],
  };

  @property({ type: Boolean }) openmodal = false;
  @property({ type: Boolean }) isSupportingBrowser: boolean;
  @property({ type: Boolean }) isIOS: boolean;
  @property({ type: Boolean }) installed: boolean;
  @property({ type: Boolean }) hasprompt = false;
  @property({ type: Boolean }) usecustom = false;
  @property({ type: Array }) relatedApps: any[] = [];

  @property({ type: String }) explainer =
    'This app can be installed on your PC or mobile device. This will allow this web app to look and behave like any other installed app. You will find it in your app lists and be able to pin it to your home screen, start menus or task bars. This installed web app will also be able to safely interact with other apps and your operating system. ';
  @property({ type: String }) featuresheader = 'Key Features';
  @property({ type: String }) descriptionheader = 'Description';
  @property({ type: String }) installbuttontext = 'Install';
  @property({ type: String }) cancelbuttontext = 'Cancel';
  @property({ type: String }) iosinstallinfotext = "Tap the share button and then 'Add to Homescreen'";

  @property() deferredprompt: any;

  static get styles() {
    return css`
      :host {
        --install-focus-color: #919c9c;
        --install-button-color: #0078d4;
        --modal-z-index: 9999;
        --background-z-index: 9998;
        --modal-background-color: white;
      }

      button {
        outline: none;
      }

      #installModalWrapper {
        height: 100vh;
        width: 100vw;
        overflow: auto;
        position: fixed;
        bottom: 0;
        top: 0;
        left: 0;
        right: 0;
        z-index: var(--modal-z-index);
        opacity: 0.9;
        display: flex;
        justify-content: center;
        align-items: center;
        box-sizing: border-box;
      }

      #descriptionWrapper {
        margin-bottom: 3em;
      }

      #installModal {
        position: absolute;
        background: var(--modal-background-color);
        font-family: sans-serif;
        box-shadow: 0px 25px 26px rgba(32, 36, 50, 0.25), 0px 5px 9px rgba(51, 58, 83, 0.53);
        border-radius: 10px;
        display: flex;
        flex-direction: column;
        padding: 0;
        animation-name: opened;
        animation-duration: 150ms;
        z-index: var(--modal-z-index);
        max-width: 56em;
      }

      @keyframes opened {
        from {
          transform: scale(0.8, 0.8);
          opacity: 0.4;
        }
        to {
          transform: scale(1, 1);
          opacity: 1;
        }
      }

      @keyframes mobile {
        from {
          opacity: 0.6;
        }
        to {
          opacity: 1;
        }
      }

      @keyframes fadein {
        from {
          opacity: 0.2;
        }
        to {
          opacity: 1;
        }
      }

      #background {
        position: fixed;
        top: 0;
        bottom: 0;
        left: 0;
        right: 0;
        background: #e3e3e3;
        z-index: var(--background-z-index);
        animation-name: fadein;
        animation-duration: 250ms;
        cursor: pointer;
      }

      #headerContainer {
        display: flex;
        justify-content: space-between;
        margin: 40px;
        margin-bottom: 32px;
        position: relative;
      }

      #headerContainer h1 {
        font-size: 28px;
        color: #3c3c3c;
        margin-top: 20px;
        margin-bottom: 7px;
      }

      #headerContainer img {
        height: 122px;
        width: 122px;
        background: lightgrey;
        border-radius: 10px;
        padding: 12px;
        border-radius: 24px;
        margin-right: 24px;
      }

      #buttonsContainer {
        display: flex;
        justify-content: flex-end;
        position: relative;
        height: 100px;

        background: #dedede75;
        width: 100%;
        right: 0em;
        border-radius: 0px 0px 12px 12px;
      }

      #openButton,
      #installButton,
      #installCancelButton {
        text-align: center;
        align-content: center;
        align-self: center;
        vertical-align: middle;
        justify-self: flex-end;
        line-height: 200%;
        flex: 0 0 auto;
        display: inline-block;
        background: #0078d4;
        color: #ffffff;
        cursor: pointer;
        border: solid 1px rgba(0, 0, 0, 0);
        outline: none;
      }

      #openButton {
        background: var(--install-button-color);
      }

      #openButton:focus {
        outline: auto;
        outline: -webkit-focus-ring-color auto 1px;
      }

      #installButton,
      #installCancelButton {
        min-width: 130px;
        margin-right: 30px;
        background: var(--install-button-color);
        border-radius: 20px;
        font-weight: 600;
        font-size: 14px;
        line-height: 21px;
        padding-top: 10px;
        padding-bottom: 9px;
        padding-left: 20px;
        padding-right: 20px;
        outline: none;
        color: white;
      }

      #closeButton {
        background: transparent;
        border: none;
        color: black;
        padding-left: 12px;
        padding-right: 12px;
        padding-top: 4px;
        padding-bottom: 4px;
        border-radius: 20px;
        font-weight: 600;
        outline: none;
        cursor: pointer;
        align-self: self-end;
        position: absolute;
        right: 0;
        top: 0;
      }

      #closeButton:focus,
      #installButton:focus,
      #installCancelButton:focus {
        box-shadow: 0 0 0 3px var(--install-focus-color);
      }

      #contentContainer {
        margin-left: 40px;
        margin-right: 40px;
        flex: 1;
        box-sizing: border-box;
      }

      #contentContainer h3 {
        font-size: 22px;
        color: #3c3c3c;
        margin-bottom: 12px;
      }

      #contentContainer p {
        font-size: 16px;
        color: #3c3c3c;
      }

      #featuresScreenDiv {
        display: flex;
        justify-content: space-around;
        align-items: center;
        margin-right: 20px;
      }

      #featuresScreenDiv h3 {
        font-style: normal;
        font-weight: 600;
        font-size: 22px;
        line-height: 225%;
        margin-top: 0px;
      }

      #keyFeatures {
        overflow: hidden;
        padding-right: 2em;
      }

      #keyFeatures ul {
        padding-inline-start: 22px;
        margin-block-start: 12px;
      }

      #featuresScreenDiv #keyFeatures li {
        font-style: normal;
        font-weight: 600;
        font-size: 16px;
        line-height: 29px;
        color: rgba(51, 51, 51, 0.72);
      }

      #screenshotsContainer {
        max-height: 250px;
        display: flex;
        max-width: 30em;
      }

      #screenshotsContainer button {
        border: none;
        width: 4em;

        transition: background-color 0.2s;
      }

      #screenshotsContainer button:focus,
      #screenshotsContainer button:hover {
        background-color: #bbbbbb;
      }

      #screenshotsContainer button svg {
        width: 28px;
        fill: #6b6969;
      }

      #screenshots {
        display: flex;
        scroll-snap-type: x mandatory;
        flex-wrap: wrap;
        flex-direction: column;
        overflow: hidden;

        width: 22em;
        max-height: 220px;

        -webkit-overflow-scrolling: touch;
      }

      #screenshots div {
        display: flex;
        align-items: center;
        justify-content: center;
        scroll-snap-align: start;
        overflow: hidden;

        height: 14em;
        width: 100%;

        background: #efefef;
      }

      #screenshots img {
        height: 100%;
        object-fit: contain;
        overflow: hidden;
      }

      #tagsDiv {
        margin-top: 1em;
        margin-bottom: 1em;
      }

      #desc {
        width: 100%;
        max-width: 40em;
        font-size: 16px;
        color: #7e7e7e;
        text-overflow: ellipsis;
        overflow: hidden;
      }

      #logoContainer {
        display: flex;
      }

      #tagsDiv span {
        background: grey;
        color: white;
        padding-left: 12px;
        padding-right: 12px;
        padding-bottom: 4px;
        font-weight: bold;
        border-radius: 24px;
        margin-right: 12px;
        padding-top: 1px;
      }

      #iosText {
        color: var(--install-button-color);
        text-align: center;
        font-weight: bold;

        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        background: rgba(239, 239, 239, 0.17);
        margin: 0;
        padding: 2em;
      }

      #manifest-description {
        white-space: pre-wrap;
      }

      @media (max-height: 780px) {
        #buttonsContainer {
          height: 70px;
          background: transparent;
        }
      }

      @media (max-width: 1220px) {
        #installModal {
          margin: 0;
          border-radius: 0px;
          min-height: 100%;
          width: 100%;

          animation-name: mobile;
          animation-duration: 250ms;
        }

        #screenshots {
          justify-content: center;
        }
      }

      @media (max-width: 962px) {
        #headerContainer h1 {
          margin-top: 0;
          margin-bottom: 0;
        }

        #logoContainer {
          align-items: center;
        }

        #headerContainer {
          margin-bottom: 24px;
        }

        #headerContainer img {
          height: 42px;
          width: 42px;
        }
      }

      @media (max-width: 800px) {
        #background {
          display: none;
        }

        #installModal {
          overflow: scroll;
          box-shadow: none;
          max-width: 100%;
          height: 100%;
        }

        #screenshotsContainer {
          width: 100%;
        }

        #screenshots img {
          height: 180px;
        }

        #buttonsContainer {
          display: flex;
          justify-content: center;
          bottom: 0;
          margin-bottom: 0;
          border-radius: 0;

          padding-top: 1em;
          padding-bottom: 1em;
        }

        #buttonsContainer #installButton {
          margin-right: 0px;
        }

        #featuresScreenDiv {
          flex-direction: column;
          align-items: flex-start;
          margin-right: 0px;
        }

        #headerContainer {
          margin: 20px;
        }

        #contentContainer {
          margin-left: 20px;
          margin-right: 20px;
          margin-bottom: 5em;
        }

        #headerContainer img {
          height: 60px;
          width: 60px;
          margin-right: 12px;
        }

        #buttonsContainer {
          position: fixed;
          bottom: 0;
          background: #efefef2b;
        }
      }

      @media (max-width: 400px) {
        #headerContainer h1 {
          font-size: 26px;
        }

        #headerContainer img {
          height: 40px;
          width: 40px;
        }

        #featuresScreenDiv h3 {
          font-size: 18px;
          margin-bottom: 0px;
        }

        #keyFeatures ul {
          margin-top: 0px;
        }
      }

      @media all and (display-mode: standalone) {
        button {
          display: none;
        }
      }

      @media (prefers-color-scheme: dark) {
        :host {
          --modal-background-color: black;
        }

        #installModal h1,
        #installModal h2,
        #installModal h3,
        #installModal p,
        #featuresScreenDiv #keyFeatures li {
          color: #ffffff;
        }

        #closeButton svg path {
          fill: #ffffff;
          opacity: 1;
        }

        #buttonsContainer {
          background: rgb(36 36 36);
        }
      }

      /* 08-26-2020: supported by only safari desktop */
      @media (inverted-colors: inverted) {
        :host {
          --install-focus-color: #6e6363;
          --install-button-color: #ff872b;
          --modal-background-color: black;
        }

        #installModal h1,
        #installModal h2,
        #installModal h3,
        #installModal p,
        #featuresScreenDiv #keyFeatures li {
          color: #ffffff;
        }

        #closeButton svg path {
          fill: #ffffff;
          opacity: 1;
        }

        #buttonsContainer {
          background: rgb(36 36 36);
        }
      }
    `;
  }

  constructor() {
    super();

    // check for beforeinstallprompt support
    this.isSupportingBrowser = 'BeforeInstallPromptEvent' in window;

    // handle iOS specifically
    // this includes the regular iPad
    // and the iPad pro
    // but not macOS
    this.isIOS =
      navigator.userAgent.includes('iPhone') ||
      navigator.userAgent.includes('iPad') ||
      (navigator.userAgent.includes('Macintosh') &&
        typeof navigator.maxTouchPoints === 'number' &&
        navigator.maxTouchPoints > 2);

    this.installed = false;

    // grab an install event
    window.addEventListener('beforeinstallprompt', (event) => this.handleInstallPromptEvent(event));

    document.addEventListener('keyup', (event) => {
      if (event.key === 'Escape') {
        this.cancel();
      }
    });
  }

  async firstUpdated(): Promise<void> {
    if (this.manifestpath) {
      try {
        await this.getManifestData();
      } catch (err) {
        console.error('Error getting manifest, check that you have a valid web manifest');
      }
    }

    if ('getInstalledRelatedApps' in navigator) {
      this.relatedApps = await (navigator as any).getInstalledRelatedApps();
    }
  }

  handleInstallPromptEvent(event: Event): void {
    this.deferredprompt = event;

    this.hasprompt = true;

    event.preventDefault();
  }

  // Check that the manifest has our 3 required properties
  // If not console an error to the user and return
  checkManifest(manifestData: ManifestData): void {
    if (!manifestData.icons || !manifestData.icons[0]) {
      console.error('Your web manifest must have at least one icon listed');
      return;
    }

    if (!manifestData.name) {
      console.error('Your web manifest must have a name listed');
      return;
    }

    if (!manifestData.description) {
      console.error('Your web manifest must have a description listed');
      return;
    }
  }

  async getManifestData(): Promise<ManifestData | null> {
    try {
      const response = await fetch(this.manifestpath);
      const data = await response.json();

      this.manifestdata = data;

      if (this.manifestdata) {
        this.checkManifest(this.manifestdata);

        return data;
      }
    } catch (err) {
      console.error(err);
    }

    return null;
  }

  scrollToLeft(): void {
    const screenshotsDiv = this.shadowRoot?.querySelector('#screenshots');
    screenshotsDiv?.scrollBy({
      left: -screenshotsDiv.clientWidth,
      top: 0,
      behavior: 'smooth',
    });
  }

  scrollToRight(): void {
    const screenshotsDiv = this.shadowRoot?.querySelector('#screenshots');
    screenshotsDiv?.scrollBy({
      left: screenshotsDiv.clientWidth,
      top: 0,
      behavior: 'smooth',
    });
  }

  openPrompt(): void {
    this.openmodal = true;

    this.dispatchEvent(new CustomEvent('show'));
    this.updateComplete.then(() => {
      (this.shadowRoot?.querySelector('#closeButton') as HTMLElement)?.focus();
    });
  }

  closePrompt(): void {
    this.openmodal = false;

    this.dispatchEvent(new CustomEvent('hide'));
  }

  shouldShowInstall() {
    return this.isSupportingBrowser && this.relatedApps.length < 1 && (this.hasprompt || this.isIOS);
  }

  async install(): Promise<boolean> {
    if (this.deferredprompt) {
      this.deferredprompt.prompt();

      this.dispatchEvent(new CustomEvent('show'));

      const choiceResult = await this.deferredprompt.userChoice;

      if (choiceResult.outcome === 'accepted') {
        console.log('Your PWA has been installed');

        await this.cancel();
        this.installed = true;

        this.dispatchEvent(new CustomEvent('hide'));

        return true;
      } else {
        console.log('User chose to not install your PWA');

        await this.cancel();

        // set installed to true because we dont
        // want to show the install button to
        // a user who chose not to install
        this.installed = true;

        this.dispatchEvent(new CustomEvent('hide'));
      }
    }

    return false;
  }

  getInstalledStatus(): boolean {
    return (
      (navigator as Navigator & { standalone?: boolean }).standalone === true ||
      matchMedia('(display-mode: standalone)').matches
    );
  }

  cancel(): Promise<void> {
    return new Promise((resolve) => {
      this.openmodal = false;

      if (this.hasAttribute('openmodal')) {
        this.removeAttribute('openmodal');
      }

      this.dispatchEvent(new CustomEvent('hide'));

      resolve();
    });
  }

  render() {
    return html`
      ${(navigator as Navigator & { standalone?: boolean }).standalone === false ||
      (this.usecustom !== true && this.shouldShowInstall() && this.installed === false)
        ? html`<button part="openButton" id="openButton" @click="${this.openPrompt}">
            <slot> ${this.installbuttontext} </slot>
          </button>`
        : null}
      ${this.openmodal === true
        ? html`
            <dialog id="installModalWrapper">
              ${when(this.openmodal, () => html`<div id="background" @click="${this.cancel}"></div>`)}
              <div id="installModal" part="installModal">
                <div id="headerContainer">
                  <div id="logoContainer">
                    <img src="${this.iconpath || this.manifestdata.icons[0]?.src}" alt="App Logo" />
                    <div id="installTitle">
                      <h1>${this.manifestdata.short_name || this.manifestdata.name}</h1>
                      <p id="desc">${this.explainer}</p>
                    </div>
                  </div>
                  <button id="closeButton" @click="${this.cancel}" aria-label="Close">
                    <svg xmlns="http://www.w3.org/2000/svg" width="23" height="22" fill="none">
                      <path
                        fill="#60656D"
                        fill-rule="evenodd"
                        d="M1 0h2l9 9 9-9a1 1 0 0 1 1 2l-9 9 9 9a1 1 0 1 1-1 2l-9-9-9 9a1 1 0 0 1-2-2l9-9-9-9V0Z"
                        clip-rule="evenodd"
                        opacity=".3"
                      />
                    </svg>
                  </button>
                </div>

                <div id="contentContainer">
                  <div id="featuresScreenDiv">
                    ${when(
                      this.manifestdata.features,
                      () => html`<div id="keyFeatures">
                        <h3>${this.featuresheader}</h3>
                        <ul>
                          ${this.manifestdata.features.map((feature) => html`<li>${feature}</li>`)}
                        </ul>
                      </div>`,
                    )}
                    ${when(
                      this.manifestdata.screenshots,
                      () => html`
                        <div id="screenshotsContainer">
                          <button @click="${this.scrollToLeft}" aria-label="previous image">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
                              <path
                                d="M401 224H187l83-79c12-13 12-33 0-46s-31-12-43 0L89 233c-6 6-9 14-9 23s3 17 9 23l138 134c12 12 31 12 43 0 12-13 12-33 0-46l-83-79h214c17 0 31-14 31-32s-14-32-31-32z"
                              />
                            </svg>
                          </button>
                          <section id="screenshots">
                            ${this.manifestdata.screenshots.map(
                              (screen) => html`<div>
                                <img alt="App Screenshot" src="${screen.src}" />
                              </div>`,
                            )}
                          </section>
                          <button @click="${this.scrollToRight}" aria-label="next image">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
                              <path
                                d="m285 413 138-134c6-6 9-14 9-23s-3-17-9-23L285 99a30 30 0 0 0-43 0 33 33 0 0 0 0 46l83 79H111c-17 0-31 14-31 32s14 32 31 32h214l-83 79a33 33 0 0 0 0 46c12 12 31 12 43 0z"
                              />
                            </svg>
                          </button>
                        </div>
                      `,
                    )}
                  </div>

                  <div id="descriptionWrapper">
                    <h3>${this.descriptionheader}</h3>
                    <p id="manifest-description">${this.manifestdata.description}</p>
                  </div>
                </div>

                ${when(
                  this.isIOS,
                  () => html`<p id="iosText">${this.iosinstallinfotext}</p>`,
                  () =>
                    html`<div id="buttonsContainer">
                      ${when(
                        this.deferredprompt,
                        () => html`<button id="installButton" @click="${this.install}">
                          ${this.installbuttontext} ${this.manifestdata.short_name}
                        </button>`,
                        () =>
                          html`<button @click="${this.cancel}" id="installCancelButton">
                            ${this.cancelbuttontext}
                          </button>`,
                      )}
                    </div>`,
                )}
              </div>
            </dialog>
          `
        : null}
    `;
  }
}
