import * as igcXcScore from 'igc-xc-score';

import type { ScoringRuleName } from './api';

// TODO: Export the rules from igc-xc-score
const scoringBaseModel = igcXcScore.scoringRules['XContest'];
const openDistance = scoringBaseModel[0];
const freeTriangle = scoringBaseModel[1];
const faiTriangle = scoringBaseModel[2];
const outAndReturn = igcXcScore.scoringRules['FAI-OAR'][0];

//Czech rules see https://www.xcontest.org/cesko/pravidla/

const czechLocalRule = [
  { ...openDistance, multiplier: 1 },
  { ...freeTriangle, multiplier: 1.8, closingDistanceRelative: 0.05 },
  { ...faiTriangle, multiplier: 2.2, closingDistanceRelative: 0.05 },
];

const czechEuropeRule = [
  { ...openDistance, multiplier: 1 },
  { ...freeTriangle, multiplier: 1.2, closingDistanceRelative: 0.05 },
  { ...faiTriangle, multiplier: 1.4, closingDistanceRelative: 0.05 },
];

const czechOutEuropeRule = [
  { ...openDistance, multiplier: 0.8 },
  { ...freeTriangle, multiplier: 1.2, closingDistanceRelative: 0.05 },
  { ...faiTriangle, multiplier: 1.4, closingDistanceRelative: 0.05 },
];

const leonardoRule = [
  { ...openDistance, multiplier: 1.5 },
  { ...freeTriangle, multiplier: 1.75, closingDistanceRelative: 0.2 },
  { ...faiTriangle, multiplier: 2, closingDistanceRelative: 0.2 },
];

const norwayRule = [
  { ...openDistance, multiplier: 1 },
  { ...freeTriangle, multiplier: 1.7, closingDistanceRelative: 0.05 },
  { ...freeTriangle, multiplier: 1.5, closingDistanceRelative: 0.2 },
  { ...faiTriangle, multiplier: 2.4, closingDistanceRelative: 0.05 },
  { ...faiTriangle, multiplier: 2.2, closingDistanceRelative: 0.2 },
];

const ukXclClubRule = [
  { ...openDistance, multiplier: 1, minDistance: 5 },
  { ...outAndReturn, multiplier: 1.2, minDistance: 5 },
  { ...outAndReturn, multiplier: 1.3, minDistance: 15 },
  { ...outAndReturn, multiplier: 1.7, minDistance: 35 },
  { ...freeTriangle, multiplier: 1.2, minDistance: 5 },
  { ...freeTriangle, multiplier: 1.3, minDistance: 15 },
  { ...freeTriangle, multiplier: 1.7, minDistance: 35 },
  { ...faiTriangle, multiplier: 1.5, minDistance: 5 },
  { ...faiTriangle, multiplier: 1.7, minDistance: 15 },
  { ...faiTriangle, multiplier: 2, minDistance: 35 },
];

const ukXclInternationalRule = [
  { ...openDistance, multiplier: 1, minDistance: 10 },
  { ...outAndReturn, multiplier: 1.2, minDistance: 35 },
  { ...freeTriangle, multiplier: 1.2, minDistance: 35 },
  { ...faiTriangle, multiplier: 1.5, minDistance: 25 },
];

const ukXclNationalRule = [
  { ...openDistance, multiplier: 1, minDistance: 10 },
  { ...outAndReturn, multiplier: 1.3, minDistance: 15 },
  { ...outAndReturn, multiplier: 1.7, minDistance: 35 },
  { ...freeTriangle, multiplier: 1.3, minDistance: 15 },
  { ...freeTriangle, multiplier: 1.7, minDistance: 35 },
  { ...faiTriangle, multiplier: 1.7, minDistance: 15 },
  { ...faiTriangle, multiplier: 2, minDistance: 25 },
];

const xContestPpgRule = [
  { ...openDistance, multiplier: 1 },
  { ...freeTriangle, multiplier: 2, closingDistanceFixed: 0.8 },
  { ...faiTriangle, multiplier: 4, closingDistanceFixed: 0.8 },
];

const wxcRule = [
  { ...openDistance, multiplier: 1 },
  { ...freeTriangle, multiplier: 1.75, closingDistanceRelative: 0.2 },
  { ...faiTriangle, multiplier: 2, closingDistanceFixed: 0.2 },
];

export const scoringRules: Map<ScoringRuleName, object> = new Map([
  ['CzechEurope', czechEuropeRule],
  ['CzechLocal', czechLocalRule],
  ['CzechOutsideEurope', czechOutEuropeRule],
  ['FFVL', igcXcScore.scoringRules['FFVL']],
  ['Leonardo', leonardoRule],
  ['Norway', norwayRule],
  ['UKClub', ukXclClubRule],
  ['UKInternational', ukXclInternationalRule],
  ['UKNational', ukXclNationalRule],
  ['XContest', igcXcScore.scoringRules['XContest']],
  ['XContestPPG', xContestPpgRule],
  ['WorldXC', wxcRule],
]);
