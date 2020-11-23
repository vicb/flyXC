import { League } from '../league';
import { FrCfd } from './frcfd';
import { Leonardo } from './leonardo';
import { UKXCLClub, UKXCLInternational, UKXCLNational } from './ukxcl';
import { WXC } from './wxc';
import { XContest } from './xcontest';
import { CzechLocal, CzechEurope, CzechOutEurope } from './czech';

export const LEAGUES: { [name: string]: League } = {
  fr: new FrCfd(),
  leo: new Leonardo(),
  ukc: new UKXCLClub(),
  uki: new UKXCLInternational(),
  ukn: new UKXCLNational(),
  xc: new XContest(),
  wxc: new WXC(),
  czl: new CzechLocal(),
  cze: new CzechEurope(),
  czo: new CzechOutEurope(),
};
