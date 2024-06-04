// Do not depend on igc-xc-score that pollutes the global namespace
// See https://github.com/mmomtchev/igc-xc-score/issues/234

export const scoringRuleNames = [
  'CzechLocal',
  'CzechEurope',
  'CzechOutsideEurope',
  'FFVL',
  'Leonardo',
  'Norway',
  'UKClub',
  'UKInternational',
  'UKNational',
  'XContest',
  'XContestPPG',
  'WorldXC',
] as const;

export enum CircuitType {
  OpenDistance = 'Open distance',
  FlatTriangle = 'Flat triangle',
  FaiTriangle = 'Fai triangle',
  OutAndReturn = 'Out and return',
}

export type ScoringRuleName = (typeof scoringRuleNames)[number];
