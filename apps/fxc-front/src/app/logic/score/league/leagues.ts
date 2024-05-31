import { ScoringRuleNames } from '@flyxc/optimizer';

export const leagueCodes = ['czl', 'cze', 'czo', 'fr', 'leo', 'nor', 'ukc', 'uki', 'ukn', 'xc', 'xcppg', 'wxc'];
export type LeagueCode = (typeof leagueCodes)[number];

export const LEAGUES_NAMES: Readonly<Record<LeagueCode, string>> = {
  czl: 'Czech (ČPP local)',
  cze: 'Czech (ČPP Europe)',
  czo: 'Czech (ČPP outside Europe)',
  fr: 'France (CFD)',
  leo: 'Leonardo',
  nor: 'Norway (Distanseligaen)',
  ukc: 'UK (XC League, Club)',
  uki: 'UK (XC League, International)',
  ukn: 'UK (XC League, National)',
  xc: 'XContest',
  xcppg: 'XContest PPG',
  wxc: 'World XC Online Contest',
};

export function getScoringRules(league: LeagueCode): ScoringRuleNames {
  switch (league) {
    case 'czl':
      return 'CzechLocal';
    case 'cze':
      return 'CzechEuropean';
    case 'czo':
      return 'CzechOutsideEurope';
    case 'fr':
      return 'FederationFrancaiseVolLibre';
    case 'leo':
      return 'Leonardo';
    case 'nor':
      return 'Norway';
    case 'ukc':
      return 'UnitedKingdomClub';
    case 'uki':
      return 'UnitedKingdomInternational';
    case 'ukn':
      return 'UnitedKingdomNational';
    case 'xc':
      return 'XContest';
    case 'xcppg':
      return 'XContestPPG';
    case 'wxc':
      return 'WorldXC';
  }
  throw Error('no corresponding rule for ' + league);
}
