import { League } from '../league';
import { CzechEurope, CzechLocal, CzechOutEurope } from './czech';
import { FrCfd } from './frcfd';
import { Leonardo } from './leonardo';
import { UKXCLClub, UKXCLInternational, UKXCLNational } from './ukxcl';
import { WXC } from './wxc';
import { NorwayLeague, XContest, XContestPPG } from './xcontest';

export const LEAGUES: { [name: string]: League } = {
  czl: new CzechLocal(),
  cze: new CzechEurope(),
  czo: new CzechOutEurope(),
  fr: new FrCfd(),
  leo: new Leonardo(),
  nor: new NorwayLeague(),
  ukc: new UKXCLClub(),
  uki: new UKXCLInternational(),
  ukn: new UKXCLNational(),
  xc: new XContest(),
  xcppg: new XContestPPG(),
  wxc: new WXC(),
};
