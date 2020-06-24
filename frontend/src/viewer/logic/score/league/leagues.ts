import { League } from '../league';
import { FrCfd } from './frcfd';
import { Leonardo } from './leonardo';
import { UKXCLClub, UKXCLInternational, UKXCLNational } from './ukxcl';
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
