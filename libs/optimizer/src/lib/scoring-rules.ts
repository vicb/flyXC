import { Ruleset } from 'rustigc-wasm';

import type { ScoringRuleName } from './api';

export interface ShapeOpenPolyline {
  type: 'open_polyline';
  points: number;
}

export interface ShapeClosedCircuit {
  type: 'closed_circuit';
  turnpoints: number;
}

export interface ShapeBalancedCircuit {
  type: 'balanced_circuit';
  turnpoints: number;
  min_side: number;
}

export type ShapeSpec = ShapeOpenPolyline | ShapeClosedCircuit | ShapeBalancedCircuit;

export interface ClosingDistance {
  type: 'distance';
  distance_m: number;
  penalized: boolean;
}

export interface ClosingRatio {
  type: 'ratio';
  ratio: number;
  penalized: boolean;
}

export type Closing = ClosingDistance | ClosingRatio;

export interface ConstraintMinScore {
  type: 'min_score';
  points: number;
}

export interface ConstraintMinDistance {
  type: 'min_distance';
  meters: number;
}

export type Constraint = ConstraintMinScore | ConstraintMinDistance;

export interface VariantDefinition {
  name: string;
  multiplier: number;
  closing?: Closing;
  constraints?: Constraint[];
}

export interface RuleDefinition {
  shape: ShapeSpec;
  variants: VariantDefinition[];
}

export interface RulesetDefinition {
  name: string;
  rules: RuleDefinition[];
}

export const scoringRuleDefinitions: Readonly<Record<Exclude<ScoringRuleName, 'None'>, RulesetDefinition>> = {
  CzechLocal: {
    name: 'CzechLocal',
    rules: [
      { shape: { type: 'open_polyline', points: 5 }, variants: [{ name: 'open', multiplier: 1 }] },
      {
        shape: { type: 'closed_circuit', turnpoints: 3 },
        variants: [{ name: 'triangle', multiplier: 1.8, closing: { type: 'ratio', ratio: 0.05, penalized: true } }],
      },
      {
        shape: { type: 'balanced_circuit', turnpoints: 3, min_side: 280 },
        variants: [{ name: 'fai', multiplier: 2.2, closing: { type: 'ratio', ratio: 0.05, penalized: true } }],
      },
    ],
  },
  CzechEurope: {
    name: 'CzechEurope',
    rules: [
      { shape: { type: 'open_polyline', points: 5 }, variants: [{ name: 'open', multiplier: 1 }] },
      {
        shape: { type: 'closed_circuit', turnpoints: 3 },
        variants: [{ name: 'triangle', multiplier: 1.2, closing: { type: 'ratio', ratio: 0.05, penalized: true } }],
      },
      {
        shape: { type: 'balanced_circuit', turnpoints: 3, min_side: 280 },
        variants: [{ name: 'fai', multiplier: 1.4, closing: { type: 'ratio', ratio: 0.05, penalized: true } }],
      },
    ],
  },
  CzechOutsideEurope: {
    name: 'CzechOutsideEurope',
    rules: [
      { shape: { type: 'open_polyline', points: 5 }, variants: [{ name: 'open', multiplier: 0.8 }] },
      {
        shape: { type: 'closed_circuit', turnpoints: 3 },
        variants: [{ name: 'triangle', multiplier: 1.2, closing: { type: 'ratio', ratio: 0.05, penalized: true } }],
      },
      {
        shape: { type: 'balanced_circuit', turnpoints: 3, min_side: 280 },
        variants: [{ name: 'fai', multiplier: 1.4, closing: { type: 'ratio', ratio: 0.05, penalized: true } }],
      },
    ],
  },
  FFVL: {
    name: 'FFVL',
    rules: [
      { shape: { type: 'open_polyline', points: 5 }, variants: [{ name: 'open', multiplier: 1 }] },
      {
        shape: { type: 'closed_circuit', turnpoints: 3 },
        variants: [
          { name: 'triangle', multiplier: 1.2, closing: { type: 'distance', distance_m: 3000, penalized: false } },
          { name: 'triangle', multiplier: 1.2, closing: { type: 'ratio', ratio: 0.05, penalized: true } },
        ],
      },
      {
        shape: { type: 'balanced_circuit', turnpoints: 3, min_side: 280 },
        variants: [
          { name: 'fai', multiplier: 1.4, closing: { type: 'distance', distance_m: 3000, penalized: false } },
          { name: 'fai', multiplier: 1.4, closing: { type: 'ratio', ratio: 0.05, penalized: true } },
        ],
      },
    ],
  },
  Leonardo: {
    name: 'Leonardo',
    rules: [
      { shape: { type: 'open_polyline', points: 5 }, variants: [{ name: 'open', multiplier: 1.5 }] },
      {
        shape: { type: 'closed_circuit', turnpoints: 3 },
        variants: [{ name: 'triangle', multiplier: 1.75, closing: { type: 'ratio', ratio: 0.2, penalized: true } }],
      },
      {
        shape: { type: 'balanced_circuit', turnpoints: 3, min_side: 280 },
        variants: [{ name: 'fai', multiplier: 2.0, closing: { type: 'ratio', ratio: 0.2, penalized: true } }],
      },
    ],
  },
  Norway: {
    name: 'Norway',
    rules: [
      { shape: { type: 'open_polyline', points: 5 }, variants: [{ name: 'open', multiplier: 1 }] },
      {
        shape: { type: 'closed_circuit', turnpoints: 3 },
        variants: [
          { name: 'triangle', multiplier: 1.6, closing: { type: 'ratio', ratio: 0.05, penalized: true } },
          { name: 'triangle', multiplier: 1.4, closing: { type: 'ratio', ratio: 0.2, penalized: true } },
        ],
      },
      {
        shape: { type: 'balanced_circuit', turnpoints: 3, min_side: 280 },
        variants: [
          { name: 'fai', multiplier: 1.8, closing: { type: 'ratio', ratio: 0.05, penalized: true } },
          { name: 'fai', multiplier: 1.6, closing: { type: 'ratio', ratio: 0.2, penalized: true } },
        ],
      },
    ],
  },
  UKClub: {
    name: 'UKClub',
    rules: [
      {
        shape: { type: 'open_polyline', points: 5 },
        variants: [{ name: 'open', multiplier: 1, constraints: [{ type: 'min_distance', meters: 5000 }] }],
      },
      {
        shape: { type: 'closed_circuit', turnpoints: 2 },
        variants: [
          {
            name: 'out-and-return',
            multiplier: 1.7,
            closing: { type: 'distance', distance_m: 800, penalized: false },
            constraints: [{ type: 'min_distance', meters: 35000 }],
          },
          {
            name: 'out-and-return',
            multiplier: 1.3,
            closing: { type: 'distance', distance_m: 800, penalized: false },
            constraints: [{ type: 'min_distance', meters: 15000 }],
          },
          {
            name: 'out-and-return',
            multiplier: 1.2,
            closing: { type: 'distance', distance_m: 800, penalized: false },
            constraints: [{ type: 'min_distance', meters: 5000 }],
          },
        ],
      },
      {
        shape: { type: 'closed_circuit', turnpoints: 3 },
        variants: [
          {
            name: 'triangle',
            multiplier: 1.7,
            closing: { type: 'ratio', ratio: 0.2, penalized: true },
            constraints: [{ type: 'min_distance', meters: 35000 }],
          },
          {
            name: 'triangle',
            multiplier: 1.3,
            closing: { type: 'ratio', ratio: 0.2, penalized: true },
            constraints: [{ type: 'min_distance', meters: 15000 }],
          },
          {
            name: 'triangle',
            multiplier: 1.2,
            closing: { type: 'ratio', ratio: 0.2, penalized: true },
            constraints: [{ type: 'min_distance', meters: 5000 }],
          },
        ],
      },
      {
        shape: { type: 'balanced_circuit', turnpoints: 3, min_side: 280 },
        variants: [
          {
            name: 'fai',
            multiplier: 2.0,
            closing: { type: 'ratio', ratio: 0.2, penalized: true },
            constraints: [{ type: 'min_distance', meters: 35000 }],
          },
          {
            name: 'fai',
            multiplier: 1.7,
            closing: { type: 'ratio', ratio: 0.2, penalized: true },
            constraints: [{ type: 'min_distance', meters: 15000 }],
          },
          {
            name: 'fai',
            multiplier: 1.5,
            closing: { type: 'ratio', ratio: 0.2, penalized: true },
            constraints: [{ type: 'min_distance', meters: 5000 }],
          },
        ],
      },
    ],
  },
  UKInternational: {
    name: 'UKInternational',
    rules: [
      {
        shape: { type: 'open_polyline', points: 5 },
        variants: [{ name: 'open', multiplier: 1, constraints: [{ type: 'min_distance', meters: 10000 }] }],
      },
      {
        shape: { type: 'closed_circuit', turnpoints: 2 },
        variants: [
          {
            name: 'out-and-return',
            multiplier: 1.2,
            closing: { type: 'distance', distance_m: 800, penalized: false },
            constraints: [{ type: 'min_distance', meters: 35000 }],
          },
        ],
      },
      {
        shape: { type: 'closed_circuit', turnpoints: 3 },
        variants: [
          {
            name: 'triangle',
            multiplier: 1.2,
            closing: { type: 'ratio', ratio: 0.2, penalized: true },
            constraints: [{ type: 'min_distance', meters: 35000 }],
          },
        ],
      },
      {
        shape: { type: 'balanced_circuit', turnpoints: 3, min_side: 280 },
        variants: [
          {
            name: 'fai',
            multiplier: 1.5,
            closing: { type: 'ratio', ratio: 0.2, penalized: true },
            constraints: [{ type: 'min_distance', meters: 25000 }],
          },
        ],
      },
    ],
  },
  UKNational: {
    name: 'UKNational',
    rules: [
      {
        shape: { type: 'open_polyline', points: 5 },
        variants: [{ name: 'open', multiplier: 1, constraints: [{ type: 'min_distance', meters: 10000 }] }],
      },
      {
        shape: { type: 'closed_circuit', turnpoints: 2 },
        variants: [
          {
            name: 'out-and-return',
            multiplier: 1.7,
            closing: { type: 'distance', distance_m: 800, penalized: false },
            constraints: [{ type: 'min_distance', meters: 35000 }],
          },
          {
            name: 'out-and-return',
            multiplier: 1.3,
            closing: { type: 'distance', distance_m: 800, penalized: false },
            constraints: [{ type: 'min_distance', meters: 15000 }],
          },
        ],
      },
      {
        shape: { type: 'closed_circuit', turnpoints: 3 },
        variants: [
          {
            name: 'triangle',
            multiplier: 1.7,
            closing: { type: 'ratio', ratio: 0.2, penalized: true },
            constraints: [{ type: 'min_distance', meters: 35000 }],
          },
          {
            name: 'triangle',
            multiplier: 1.3,
            closing: { type: 'ratio', ratio: 0.2, penalized: true },
            constraints: [{ type: 'min_distance', meters: 15000 }],
          },
        ],
      },
      {
        shape: { type: 'balanced_circuit', turnpoints: 3, min_side: 280 },
        variants: [
          {
            name: 'fai',
            multiplier: 2.0,
            closing: { type: 'ratio', ratio: 0.2, penalized: true },
            constraints: [{ type: 'min_distance', meters: 25000 }],
          },
          {
            name: 'fai',
            multiplier: 1.7,
            closing: { type: 'ratio', ratio: 0.2, penalized: true },
            constraints: [{ type: 'min_distance', meters: 15000 }],
          },
        ],
      },
    ],
  },
  XContest: {
    name: 'XContest',
    rules: [
      { shape: { type: 'open_polyline', points: 5 }, variants: [{ name: 'open', multiplier: 1 }] },
      {
        shape: { type: 'closed_circuit', turnpoints: 3 },
        variants: [
          { name: 'triangle', multiplier: 1.4, closing: { type: 'ratio', ratio: 0.05, penalized: true } },
          { name: 'triangle', multiplier: 1.2, closing: { type: 'ratio', ratio: 0.2, penalized: true } },
        ],
      },
      {
        shape: { type: 'balanced_circuit', turnpoints: 3, min_side: 280 },
        variants: [
          { name: 'fai', multiplier: 1.6, closing: { type: 'ratio', ratio: 0.05, penalized: true } },
          { name: 'fai', multiplier: 1.4, closing: { type: 'ratio', ratio: 0.2, penalized: true } },
        ],
      },
    ],
  },
  XContestPPG: {
    name: 'XContestPPG',
    rules: [
      { shape: { type: 'open_polyline', points: 5 }, variants: [{ name: 'open', multiplier: 1 }] },
      {
        shape: { type: 'closed_circuit', turnpoints: 3 },
        variants: [
          { name: 'triangle', multiplier: 2, closing: { type: 'distance', distance_m: 800, penalized: false } },
        ],
      },
      {
        shape: { type: 'balanced_circuit', turnpoints: 3, min_side: 280 },
        variants: [{ name: 'fai', multiplier: 4, closing: { type: 'distance', distance_m: 800, penalized: false } }],
      },
    ],
  },
  WorldXC: {
    name: 'WorldXC',
    rules: [
      { shape: { type: 'open_polyline', points: 5 }, variants: [{ name: 'open', multiplier: 1 }] },
      {
        shape: { type: 'closed_circuit', turnpoints: 3 },
        variants: [{ name: 'triangle', multiplier: 1.75, closing: { type: 'ratio', ratio: 0.2, penalized: true } }],
      },
      {
        shape: { type: 'balanced_circuit', turnpoints: 3, min_side: 280 },
        variants: [{ name: 'fai', multiplier: 2.0, closing: { type: 'distance', distance_m: 200, penalized: false } }],
      },
    ],
  },
};

const rulesetCache = new Map<ScoringRuleName, Ruleset>();

export function getRuleset(ruleName: ScoringRuleName): Ruleset | undefined {
  if (ruleName === 'None') {
    return undefined;
  }
  let ruleset = rulesetCache.get(ruleName);
  if (!ruleset) {
    const def = scoringRuleDefinitions[ruleName];
    if (!def) {
      return undefined;
    }
    ruleset = Ruleset.from_json(JSON.stringify(def));
    rulesetCache.set(ruleName, ruleset);
  }
  return ruleset;
}
