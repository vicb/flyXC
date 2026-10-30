export const scoringRuleNames = [
  'CzechLocal',
  'CzechEurope',
  'CzechOutsideEurope',
  'FFVL',
  'Leonardo',
  'None',
  'Norway',
  'UKClub',
  'UKInternational',
  'UKNational',
  'XContest',
  'XContestPPG',
  'WorldXC',
] as const;

export const enum CircuitType {
  OpenDistance = 'Open distance',
  FlatTriangle = 'Flat triangle',
  FaiTriangle = 'Fai triangle',
  OutAndReturn = 'Out and return',
}

export type ScoringRuleName = (typeof scoringRuleNames)[number];
