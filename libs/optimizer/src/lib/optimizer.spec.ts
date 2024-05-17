import { OptimizationResult, optimize } from './optimizer';
import {
  closedFaiTriangleFixture,
  closedFaiTriangleFixtureWithSmallCycle, closedFaiTriangleFixtureWithSmallLoop,
  closedFlatTriangleFixture,
  emptyTrackFixture,
  freeDistance1PointFixture,
  freeDistance2PointsFixture,
  freeDistance3PointsFixture,
  freeDistanceFixture,
  OptimizerFixture,
} from './fixtures/optimizer.fixtures';
import { LeagueCode } from './scoringRules';

describe('optimizer', () => {
  describe('given an empty request', () => {
    const fixture = emptyTrackFixture();
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
  ].forEach((league) => {
    describe(LeagueCode[league] + ' rules', () => {
      const noSplitIntervals = 1;
      const tenSplitIntervals = 10;
      [noSplitIntervals, tenSplitIntervals].forEach((intervals) => {
        describe('given a free distance request (' + intervals + ' interval(s)/branch)', () => {
          const fixture = freeDistanceFixture({ lat: 45, lon: 5 }, { lat: 45, lon: 6 }, intervals, league);
          it('should return the expected score', () => {
            expectOptimizationIsAsExpected(fixture);
          });
        });

        describe(
          'given a free distance with 1 intermediate point request (' + intervals + ' interval(s)/branch)',
          () => {
            const fixture = freeDistance1PointFixture(
              { lat: 45, lon: 5 },
              { lat: 45, lon: 6 },
              { lat: 46, lon: 6 },
              intervals,
              league,
            );
            it('should return the expected score', () => {
              expectOptimizationIsAsExpected(fixture);
            });
          },
        );

        describe(
          'given a free distance with 2 intermediate points request (' + intervals + ' interval(s)/branch)',
          () => {
            const fixture = freeDistance2PointsFixture(
              { lat: 45, lon: 5 },
              { lat: 45, lon: 6 },
              { lat: 46, lon: 6 },
              { lat: 46, lon: 5 },
              intervals,
              league,
            );
            it('should return the expected score (' + intervals + ' interval(s)/branch)', () => {
              expectOptimizationIsAsExpected(fixture);
            });
          },
        );

        describe(
          'given a free distance with 3 intermediate points request (' + intervals + ' interval(s)/branch)',
          () => {
            const fixture = freeDistance3PointsFixture(
              { lat: 45, lon: 5 },
              { lat: 45, lon: 6 },
              { lat: 46, lon: 6 },
              { lat: 46, lon: 5 },
              { lat: 47, lon: 5 },
              intervals,
              league,
            );
            it('should return the expected score', () => {
              expectOptimizationIsAsExpected(fixture);
            });
          },
        );

        describe('given a closed flat triangle request (' + intervals + ' interval(s)/branch)', () => {
          const fixture = closedFlatTriangleFixture(
            { lat: 45, lon: 5 },
            { lat: 45, lon: 6 },
            { lat: 45.2, lon: 6 },
            intervals,
            league,
          );
          it('should return the expected score', () => {
            expectOptimizationIsAsExpected(fixture);
          });
        });

        describe('given a closed FAI triangle request (' + intervals + ' interval(s)/branch)', () => {
          const fixture = closedFaiTriangleFixture({ lat: 45, lon: 5 }, { lat: 45, lon: 6 }, intervals, league);
          it('should return the expected score', () => {
            expectOptimizationIsAsExpected(fixture);
          });
        });
      });
    });
  });

  describe('given a closed FAI triangle request (10 interval/branch) with minimal cycle allowed', () => {
    const fixture = closedFaiTriangleFixtureWithSmallCycle(
      { lat: 45, lon: 5 },
      { lat: 45, lon: 6 },
      9,
      LeagueCode.FFVL,
    );
    it('should return the expected score', () => {
      expectOptimizationIsAsExpected(fixture);
    });
  });


  describe('given a closed FAI triangle request (10 interval/branch) with minimal loop allowed', () => {
    const fixture = closedFaiTriangleFixtureWithSmallLoop(
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
      done = currentResult.value.optimal;
    }
    expect(currentResult.value.score).toBeCloseTo(fixture.expectedResult.score, 1);
  }
});
