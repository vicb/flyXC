import { IGCFile } from 'igc-parser';
import { scoringRules, solver } from 'igc-xc-score';

describe('solver', () => {
  it('should compute a score', () => {
    const date = new Date();
    const flight: IGCFile = {
      date: date.toISOString(),
      fixes: [
        // @ts-ignore
        { ...timestamp('2023-09-01T12:00:00.000Z'), latitude: 0.0, longitude: 0.0, valid: true },
        // @ts-ignore
        { ...timestamp('2023-09-01T12:00:01.000Z'), latitude: 1.0, longitude: 1.0, valid: true },
        // @ts-ignore
        { ...timestamp('2023-09-01T12:00:02.000Z'), latitude: 2.0, longitude: 2.0, valid: true },
        // @ts-ignore
        { ...timestamp('2023-09-01T12:00:03.000Z'), latitude: 3.0, longitude: 3.0, valid: true },
        // @ts-ignore
        { ...timestamp('2023-09-01T12:00:04.000Z'), latitude: 4.0, longitude: 4.0, valid: true },
      ],
    };
    const score = solver(flight, scoringRules.FFVL).next().value;
    expect(score.optimal).toBeTruthy();
    expect(score.scoreInfo).not.toBeUndefined();
  });
});

function timestamp(s: string) {
  return {
    timestamp: new Date(Date.parse(s)),
    //time: s
  };
}
