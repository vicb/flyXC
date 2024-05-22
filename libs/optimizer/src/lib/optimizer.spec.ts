import { OptimizationResult, optimize } from './optimizer';
import {
  createClosedFaiTriangleFixture,
  createClosedFaiTriangleFixtureWithSmallCycle,
  createClosedFaiTriangleFixtureWithSmallLoop,
  createClosedFlatTriangleFixture,
  createEmptyTrackFixture,
  createFreeDistance1PointFixture,
  createFreeDistance2PointsFixture,
  createFreeDistance3PointsFixture,
  createFreeDistanceFixture,
  OptimizerFixture,
} from './fixtures/optimizer.fixtures';
import { LeagueCode } from './scoringRules';

describe('optimizer', () => {
  describe('given an empty request', () => {
    const fixture = createEmptyTrackFixture();
    it('should return a 0 score', () => {
      expectOptimizationIsAsExpected(fixture);
    });
  });
  [
    LeagueCode.CZE,
    LeagueCode.CZL,
    LeagueCode.CZO,
    LeagueCode.FFVL,
    LeagueCode.LEO,
    LeagueCode.NOR,
    LeagueCode.UKC,
    LeagueCode.UKI,
    LeagueCode.UKN,
    LeagueCode.XContest,
    LeagueCode.XCPPG,
    LeagueCode.WXC,
    undefined,
  ].forEach((league?) => {
    describe(LeagueCode[league] + ' rules', () => {
      const oneSegmentPerBranch = 1;
      const tenSegmentsPerBranch = 10;
      [oneSegmentPerBranch, tenSegmentsPerBranch].forEach((nbSegmentsPerBranch) => {
        describe('given a free distance request (' + nbSegmentsPerBranch + ' segments(s)/branch)', () => {
          const fixture = createFreeDistanceFixture(
            { lat: 45, lon: 5 },
            { lat: 45, lon: 6 },
            nbSegmentsPerBranch,
            league,
          );
          it('should return the expected score', () => {
            expectOptimizationIsAsExpected(fixture);
          });
        });

        describe(
          'given a free distance with 1 intermediate point request (' + nbSegmentsPerBranch + ' segment(s)/branch)',
          () => {
            const fixture = createFreeDistance1PointFixture(
              { lat: 45, lon: 5 },
              { lat: 45, lon: 6 },
              { lat: 46, lon: 6 },
              nbSegmentsPerBranch,
              league,
            );
            it('should return the expected score', () => {
              expectOptimizationIsAsExpected(fixture);
            });
          },
        );

        describe(
          'given a free distance with 2 intermediate points request (' + nbSegmentsPerBranch + ' segment(s)/branch)',
          () => {
            const fixture = createFreeDistance2PointsFixture(
              { lat: 45, lon: 5 },
              { lat: 45, lon: 6 },
              { lat: 46, lon: 6 },
              { lat: 46, lon: 5 },
              nbSegmentsPerBranch,
              league,
            );
            it('should return the expected score (' + nbSegmentsPerBranch + ' segment(s)/branch)', () => {
              expectOptimizationIsAsExpected(fixture);
            });
          },
        );

        describe(
          'given a free distance with 3 intermediate points request (' + nbSegmentsPerBranch + ' segment(s)/branch)',
          () => {
            const fixture = createFreeDistance3PointsFixture(
              { lat: 45, lon: 5 },
              { lat: 45, lon: 6 },
              { lat: 46, lon: 6 },
              { lat: 46, lon: 5 },
              { lat: 47, lon: 5 },
              nbSegmentsPerBranch,
              league,
            );
            it('should return the expected score', () => {
              expectOptimizationIsAsExpected(fixture);
            });
          },
        );

        describe('given a closed flat triangle request (' + nbSegmentsPerBranch + ' segment(s)/branch)', () => {
          const fixture = createClosedFlatTriangleFixture(
            { lat: 45, lon: 5 },
            { lat: 45, lon: 6 },
            { lat: 45.2, lon: 6 },
            nbSegmentsPerBranch,
            league,
          );
          it('should return the expected score', () => {
            expectOptimizationIsAsExpected(fixture);
          });
        });

        describe('given a closed FAI triangle request (' + nbSegmentsPerBranch + ' segment(s)/branch)', () => {
          const fixture = createClosedFaiTriangleFixture(
            { lat: 45, lon: 5 },
            { lat: 45, lon: 6 },
            nbSegmentsPerBranch,
            league,
          );
          it('should return the expected score', () => {
            expectOptimizationIsAsExpected(fixture);
          });
        });
      });
    });
  });

  describe('given a closed FAI triangle request (10 segments/branch) with minimal cycle allowed', () => {
    const fixture = createClosedFaiTriangleFixtureWithSmallCycle(
      { lat: 45, lon: 5 },
      { lat: 45, lon: 6 },
      9,
      LeagueCode.FFVL,
    );
    it('should return the expected score', () => {
      expectOptimizationIsAsExpected(fixture);
    });
  });

  describe('given a closed FAI triangle request (10 segments/branch) with minimal loop allowed', () => {
    const fixture = createClosedFaiTriangleFixtureWithSmallLoop(
      { lat: 45, lon: 5 },
      { lat: 45, lon: 6 },
      9,
      LeagueCode.FFVL,
    );
    it('should return the expected score', () => {
      expectOptimizationIsAsExpected(fixture);
    });
  });

  function expectOptimizationIsAsExpected(fixture: OptimizerFixture) {
    const optimization = optimize(fixture.givenRequest);
    let currentResult: IteratorResult<OptimizationResult, OptimizationResult>,
      done = false;
    while (!done) {
      currentResult = optimization.next();
      done = currentResult.done;
    }
    expect(currentResult.value.score).toBeCloseTo(fixture.expectedResult.score, 1);
  }
});
