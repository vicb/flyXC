import { html, LitElement, type TemplateResult } from 'lit';
import { customElement } from 'lit/decorators.js';

@customElement('terms-page')
export class TermsPage extends LitElement {
  render(): TemplateResult {
    return html`
      <style>
        #page-content {
          font-size: 16px;
        }
        #page-content h2 {
          font-size: 16px;
          color: var(--ion-color-primary);
        }
      </style>
      <ion-header>
        <ion-toolbar color="primary">
          <ion-title>flyXC Terms and Conditions</ion-title>
        </ion-toolbar>
      </ion-header>
      <ion-content id="page-content" class="ion-padding">
        <ion-text>
          <p>
            This website, flyxc.app (the "Website"), provides free flight enthusiasts with tools to plan flights, upload
            and display their track logs, and view live tracking of other pilots.
          </p>

          <p>
            By using the Website, you agree to these terms and conditions (the "Terms") and acknowledge that they
            constitute a legally binding contract between you and flyxc. If you do not agree to these Terms, please do
            not use the Website. We reserve the right to modify or update these Terms at any time without prior notice.
            Your continued use of the Website after any changes indicates your acceptance of the new terms and
            conditions. Therefore, we recommend that you review these Terms regularly for any changes.
          </p>

          <h2>1. Purpose of the Website</h2>
          <p>
            The purpose of the Website is to enhance safety and education in free flight sports such as paragliding and
            hang gliding. The Website provides users with access to various features, including:
          </p>
          <ul>
            <li>
              Flight planning tools that allow users to enter their desired takeoff location, destination and other
              parameters for a flight;
            </li>
            <li>
              Track log uploader that allows users to upload their igc track logs (a standard format for recording GPS
              data) from their devices or online platforms such as XCSoar or XContest;>
            </li>
            <li>
              Map viewer that shows users' igc track logs on a map and enables them to share their tracks with others;
            </li>
            <li>
              Live tracking feature that allows users to see the real-time location of other pilots who have shared
              their location publicly.
            </li>
          </ul>

          <h2>2. Data Collection and Use</h2>
          <p>
            flyxc collects two types of data from its users: live tracking location data and recorded track log data.
          </p>
          <p>
            The live tracking location data is used to provide real-time information about the whereabouts of pilots who
            have opted in for this service. The recorded track log data is used to show users' flights on a map and to
            allow them to compare their performance with other pilots.
          </p>
          <p>
            flyxc does not sell, rent, or otherwise share your personal information with any third parties, except as
            required by law or as necessary to protect the rights, property, or safety of flyxc, its employees, users,
            or others. flyxc may also disclose your data if it is involved in a merger, acquisition, or sale of all or
            part of its assets.
          </p>

          <h2>3. Ownership and Intellectual Property</h2>
          <p>
            Rights The Website, including but not limited to its design, layout, content, graphics, images, audio,
            video, and code, is owned by flyxc and protected by copyright laws and international intellectual property
            rights. You may not reproduce, modify, distribute, sell, or otherwise use any part of the Website without
            the prior written consent of flyxc.
          </p>

          <h2>4. Disclaimer of Warranties and Liability</h2>
          <p>
            The Website is provided "as is" and "as available". flyxc disclaims all warranties, express or implied,
            including but not limited to warranties of merchantability, fitness for a particular purpose, title,
            non-infringement, and security. flyxc does not guarantee that the Website will be error-free, uninterrupted,
            or accessible at all times. flyxc is not responsible for any losses, damages, or expenses arising from your
            use of the Website, including but not limited to direct, indirect, special, incidental, consequential, or
            punitive damages. flyxc also disclaims any liability for any actions taken by you or others based on the
            information provided by the Website, which may be inaccurate, incomplete, or outdated.
          </p>

          <h2>5. Indemnification</h2>
          <p>
            You agree to indemnify and hold harmless flyxc, its officers, directors, employees, agents, licensors, and
            suppliers from any claims, actions, demands, liabilities, costs, damages, and expenses (including reasonable
            attorneys' fees) arising from your use of the Website or your violation of these Terms. 6. Applicable Law
            and Dispute Resolution These Terms shall be governed by and construed in accordance with the laws of France,
            without giving effect to any principles of conflicts of law. Any disputes arising out of or in connection
            with these Terms or your use of the Website shall be subject to the exclusive jurisdiction of the courts of
            England and Wales. 7. Entire Agreement These Terms constitute the entire agreement between you and flyxc
            regarding your use of the Website and supersede any prior agreements, understandings, or representations,
            whether written or oral. If any provision of these Terms is found to be unenforceable or invalid, that
            provision shall be limited or eliminated to the minimum extent necessary so that these Terms shall otherwise
            remain in full force and effect and enforceable. By using the Website, you acknowledge that you have read,
            understood, and agreed to these Terms. If you do not agree to these Terms, please do not use the Website.
          </p>
        </ion-text>
      </ion-content>
      <ion-footer>
        <ion-toolbar color="light">
          <ion-buttons slot="primary">
            <ion-button href="/" fill="solid" color="primary">Close</ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-footer>
    `;
  }

  protected createRenderRoot(): HTMLElement {
    return this;
  }
}
