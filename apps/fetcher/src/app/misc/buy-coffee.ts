// Buy me a coffee
//
// https://developers.buymeacoffee.com/

import { SecretKeys, fetchResponse } from '@flyxc/common';

export type Supporters = {
  // visible supporters
  names: Set<string>;
  // all supporters
  numSupporters: number;
  // total amount
  totalAmount: number;
};

export async function fetchSupporters(): Promise<Supporters> {
  const supporters: Supporters = {
    names: new Set<string>(),
    numSupporters: 0,
    totalAmount: 0,
  };
  let url = `https://developers.buymeacoffee.com/api/v1/supporters`;
  try {
    while (url) {
      const response = await fetchResponse(url, {
        headers: {
          Authorization: `Bearer ${SecretKeys.BUY_ME_A_COFFEE_TOKEN}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        const users = data.data;
        for (const user of users) {
          if (user.amount <= 0) {
            continue;
          }
          if (user.support_visibility === 1 && user.payer_name) {
            supporters.names.add(user.payer_name);
          }
          supporters.numSupporters++;
          supporters.totalAmount += user.support_coffees * user.support_coffee_price;
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
