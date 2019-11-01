import { UKXCLClub, UKXCLInternational, UKXCLNational } from './ukxcl';

import { FrCfd } from './frcfd';
import { League } from '../league';
import { Leonardo } from './leonardo';
import { WXC } from './wxc';
import { XContest } from './xcontest';

export const LEAGUES: { [name: string]: League } = {
  fr: new FrCfd(),
  leo: new Leonardo(),
  ukc: new UKXCLClub(),
  uki: new UKXCLInternational(),
  ukn: new UKXCLNational(),
  xc: new XContest(),
  wxc: new WXC(),
};
