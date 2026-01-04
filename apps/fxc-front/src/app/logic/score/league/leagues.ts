import type { ScoringRuleName } from '@flyxc/optimizer/src/lib/api';

export const LEAGUE_CODES = [
  'czl',
  'cze',
  'czo',
  'fr',
  'leo',
  'none',
  'nor',
  'ukc',
  'uki',
  'ukn',
  'xc',
  'xcppg',
  'wxc',
] as const;

export type LeagueCode = (typeof LEAGUE_CODES)[number];

interface LeagueDetails {
  name: string;
  ruleName: ScoringRuleName;
}

export const LEAGUES: Readonly<Record<LeagueCode, LeagueDetails>> = {
  czl: { name: 'Czech (ČPP local)', ruleName: 'CzechLocal' },
  cze: { name: 'Czech (ČPP Europe) / SHV', ruleName: 'CzechEurope' },
  czo: { name: 'Czech (ČPP outside Europe)', ruleName: 'CzechOutsideEurope' },
  fr: { name: 'France (CFD)', ruleName: 'FFVL' },
  leo: { name: 'Leonardo', ruleName: 'Leonardo' },
  none: { name: 'None (no scoring)', ruleName: 'None' },
  nor: { name: 'Norway (Distanseligaen)', ruleName: 'Norway' },
  ukc: { name: 'UK (XC League, Club)', ruleName: 'UKClub' },
  uki: { name: 'UK (XC League, International)', ruleName: 'UKInternational' },
  ukn: { name: 'UK (XC League, National)', ruleName: 'UKNational' },
  xc: { name: 'XContest', ruleName: 'XContest' },
  xcppg: { name: 'XContest PPG', ruleName: 'XContestPPG' },
  wxc: { name: 'World XC Online Contest', ruleName: 'WorldXC' },
};

export function getScoringRuleName(leagueCode: LeagueCode): ScoringRuleName {
  const ruleName = LEAGUES[leagueCode]?.ruleName;
  if (ruleName == null) {
    throw new Error('Unkown league code "${leagueCode}"');
  }
  return ruleName;
}
