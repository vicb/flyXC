import type { TemplateResult } from 'lit';
import { html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';

@customElement('privacy-policy-page')
export class PrivacyPolicyPage extends LitElement {
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
          <ion-title>flyXC Privacy Policy</ion-title>
        </ion-toolbar>
      </ion-header>
      <ion-content id="page-content" class="ion-padding">
        <ion-text>
          <p>
            At flyXC (referred to as "we", "us" or "our" in this policy), we understand the importance of protecting
            your personal data. This privacy policy explains how we collect, use, share and store information when you
            access our website at flyXC.app, which is operated by us, and any other services provided by flyXC
            (collectively referred to as the "Services").
          </p>
          <p>
            You acknowledge that this Privacy Policy is part of our Site Terms of Use, and by accessing or using our
            site, you agree to be bound by all of its terms and conditions. If you do not agree to these terms, please
            do not access or use this site.
          </p>
          <p>
            We reserve the right to change this Privacy Policy at any time. Such changes, modifications, additions or
            deletions shall be effective immediately upon notice thereof, which may be given by means including, but not
            limited to issuing an email to the email address listed by registered users and posting the revised Policy
            on this page. You acknowledge and agree that it is your responsibility to maintain a valid email address as
            a registered user, review this site and this Policy periodically and to be aware of any modifications. Your
            continued use of the site after such modifications will constitute your: (a) acknowledgment of the modified
            Policy; and (b) agreement to abide and be bound by the modified Policy.
          </p>

          <h2>1. Information We Collect</h2>
          <p>We collect two types of information: Personal Data and Non-Personal Data.</p>
          <ul>
            <li>
              A) Personal Data: This includes data that can be used to directly or indirectly identify you, such as your
              name, location, email address, and other similar information. You are not required to provide the personal
              data that we have requested, but if you choose not to do so, in many cases we will not be able to provide
              you with our products or services, and/or respond to any queries or requests you may have.
            </li>
            <li>
              B) Non-Personal Data: This includes information that cannot identify a specific individual, such as
              browser types, operating systems, and the pages viewed while navigating through the Services. We collect
              this data using cookies and other similar technologies.
            </li>
          </ul>

          <h2>2. How We Collect Information</h2>
          <p>We may obtain Personal Data from you when you:</p>
          <ul>
            <li>Register on our website or application;</li>
            <li>Submit an inquiry through the Services;</li>
            <li>Communicate with us via email, phone, or other means</li>
          </ul>
          <p>
            We do not collect any Personally Identifiable Information about you unless you voluntarily provide it to us.
            You provide certain Personally Identifiable Information to us when you register your account.
          </p>
          <p>
            We collect your registered tracker positions continuously and use that to display your position on the map
            for up to 48 hours. By signing up for flyXC and registering your tracker devices, you acknowledge and agree
            that your tracker devices location will be displayed and viewable via our services.
          </p>
          <p>
            For safety purpose, we keep an archive of the last 30 days for the live tracks. The archive is not publicly
            accessible.
          </p>
          <p>
            We reserve the right to use any track uploaded on our services. i.e. to derive heat maps of thermal
            locations.
          </p>

          <h2>3. How We Use Information</h2>
          <p>We use your information to:</p>
          <ul>
            <li>Provide and improve our products and services;</li>
            <li>Respond to requests, inquiries, and comments;</li>
            <li>Analyze usage trends and preferences;</li>
            <li>Comply with legal obligations;</li>
            <li>Enforce our terms of service;</li>
            <li>Protect the rights, property, or safety of flyXC, our users, or others.</li>
          </ul>

          <h2>4. How We Share Information</h2>
          <p>We may share your information:</p>
          <ul>
            <li>With third parties who provide services on our behalf;</li>
            <li>In response to legal process;</li>
            <li>To investigate suspected fraud or potential threats to the security of our Services;</li>
            <li>In connection with an acquisition, merger, or sale of assets;</li>
            <li>When we have your explicit consent.</li>
          </ul>

          <h2>5. How We Store Information</h2>
          <p>
            We store your information on secure servers that are protected by appropriate physical, technical, and
            organizational measures designed to prevent unauthorized access, loss, misuse, disclosure, alteration, and
            destruction. However, no electronic transmission or storage of data is completely secure, so we cannot
            guarantee the absolute security of this information.
          </p>

          <h2>6. Your Rights</h2>
          <p>
            You have certain rights regarding your Personal Data, subject to local law. These include the right to
            request access, correction, erasure, restriction, portability, and objection to processing of your Personal
            Data. You can exercise these rights by contacting us using the details provided in this policy.
          </p>

          <h2>7. Children's Privacy</h2>
          <p>
            Our Services are not directed at children under 16 years old. If you learn that a child has provided us with
            their information without consent, please contact us immediately so we can take appropriate action.
          </p>

          <h2>8. Changes to This Policy</h2>
          <p>
            We may update our privacy policy from time to time. When we make significant changes, we will notify you by
            posting a notice on our website or through other communication channels. We encourage you to review this
            page periodically for the latest information on our privacy practices.
          </p>

          <h2>9. Contact Information</h2>
          <p>If you have any questions about this Privacy Policy, please contact us at: contact@flyxc.app</p>
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
