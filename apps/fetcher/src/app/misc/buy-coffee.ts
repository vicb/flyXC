// Buy me a coffee
//
// https://developers.buymeacoffee.com/

import { fetchResponse } from '@flyxc/common';
import { Secrets } from '@flyxc/secrets';
import { format, subMonths } from 'date-fns';

export type Supporters = {
  // visible supporters
  names: Set<string>;
  // all supporters
  numSupporters: number;
  // total amount
  totalAmount: number;
  // last3MonthsAmount
  last3MonthsAmount: number;
};

export async function fetchSupporters(): Promise<Supporters> {
  const supporters: Supporters = {
    names: new Set<string>(),
    numSupporters: 0,
    totalAmount: 0,
    last3MonthsAmount: 0,
  };

  const cutoffDate = subMonths(new Date(), 3);
  const cutoffDateString = format(cutoffDate, 'yyyy-MM-dd');

  let url = `https://developers.buymeacoffee.com/api/v1/supporters`;
  try {
    while (url) {
      const response = await fetchResponse(url, {
        headers: {
          Authorization: `Bearer ${Secrets.BUY_ME_A_COFFEE_TOKEN}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        const users = data.data;
        for (const user of users) {
          if (user.is_refunded) {
            continue;
          }
          if (user.support_visibility === 1 && user.payer_name.length > 3 && user.payer_name !== 'Someone') {
            supporters.names.add(user.payer_name);
          }
          supporters.numSupporters++;
          const amount = user.support_coffees * user.support_coffee_price;
          supporters.totalAmount += amount;
          if (user.support_created_on >= cutoffDateString) {
            supporters.last3MonthsAmount += amount;
          }
        }
        url = data.next_page_url;
      } else {
        url = null;
      }
    }
  } catch (error) {
    console.error('Buy me a coffee API error!', error);
  }
  return supporters;
}
