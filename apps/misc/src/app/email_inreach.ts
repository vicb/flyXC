import { readFileSync } from 'node:fs';
import { setTimeout } from 'node:timers/promises';

import type { LiveTrackEntity } from '@flyxc/common';
import { trackerNames } from '@flyxc/common';
import { EmailParams, MailerSend, Recipient, Sender } from 'mailersend';

(async () => {
  const trackers = JSON.parse(readFileSync(`${__dirname}/assets/trackers.json`, 'utf-8')) as LiveTrackEntity[];
  const numTrackers = trackers.length;
  console.log(`## Found ${numTrackers} trackers`);

  const inreachOnly = await retrieveInreachOnly(trackers);
  console.log(`## Found ${inreachOnly.length} account with only inReach enabled`);

  const mailerSend = new MailerSend({
    apiKey: SECRETS.MAILERSEND_TOKEN,
  });

  for (const { name, email } of inreachOnly) {
    await sendEmail(mailerSend, email, name);
  }
})();

function retrieveInreachOnly(trackers: LiveTrackEntity[]): { name: string; email: string }[] {
  const inreach: { name: string; email: string }[] = [];

  const trackersWithoutInreach = trackerNames.filter((name) => name != 'inreach');

  for (const tracker of trackers) {
    if (
      tracker.enabled &&
      tracker?.inreach?.enabled &&
      trackersWithoutInreach.every((name) => tracker[name]?.enabled !== true)
    ) {
      inreach.push({ name: tracker.name, email: tracker.email });
    }
  }

  return inreach;
}

async function sendEmail(mailerSend: MailerSend, email: string, name: string) {
  const sentFrom = new Sender('victor@flyxc.app', 'Victor Berchet');

  const recipients = [new Recipient(email, name)];

  const personalization = [
    {
      email,
      data: {
        name,
      },
    },
  ];

  const emailParams = new EmailParams()
    .setFrom(sentFrom)
    .setTo(recipients)
    .setReplyTo(sentFrom)
    .setPersonalization(personalization)
    .setSubject('High resolution live tracks on flyxc.app')
    .setTemplateId('jpzkmgqdm3ml059v');

  console.log(`- Sending email to ${name} (${email})`);
  try {
    await mailerSend.email.send(emailParams);
  } catch (error) {
    console.error(`Error sending email to ${name} (${email})`, error);
  }

  // Rate limit is 1 email per minute
  await setTimeout(61 * 1000);
}
