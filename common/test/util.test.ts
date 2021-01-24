import { formatReqError, parallelTasksWithTimeout } from '../src/util';

describe('FormatReqError', () => {
  it('should format scalars', () => {
    expect(formatReqError('test')).toBe('test');
    expect(formatReqError(123)).toBe('123');
    expect(formatReqError(null)).toBe('null');
    expect(formatReqError(undefined)).toBe('undefined');
  });

  it('should format arbitrary errors', () => {
    expect(formatReqError(new Error('test'))).toBe('test');
    expect(formatReqError({ one: 1 })).toBe('{one:1}');
  });

  it('should format ECONNRESET', () => {
    const error = {
      code: 'ECONNRESET',
      message: 'socket hang up',
      url: 'https://share.garmin.com/Feed/Share/...',
      trace: ['https://share.garmin.com/Feed/Share/...'],
    };
    expect(formatReqError(error)).toBe('ECONNRESET (socket hang up)');
  });

  it('should format 404', () => {
    const error = {
      code: 404,
      message: 'Not Found',
      url: 'https://share.garmin.com/Feed/Share/...',
      trace: ['https://share.garmin.com/Feed/Share/...'],
      headers: { date: 'Sat, 09 Jan 2021 15:44:02 GMT' },
    };
    expect(formatReqError(error)).toBe('404');
  });
});

describe('parallelTasksWithTimeout', () => {
  it('only runs as many promises in parallel as given by the pool limit', async () => {
    const results: number[] = [];
    const timeout = (i: number) =>
      new Promise((resolve) =>
        setTimeout(() => {
          results.push(i);
          resolve(i);
        }, i),
      );
    await parallelTasksWithTimeout(2, [100, 500, 300, 200], timeout);
    expect(results).toEqual([100, 300, 500, 200]);
  });

  it('runs all promises in parallel when the pool is bigger than needed', async () => {
    const results: number[] = [];
    const timeout = (i: number) =>
      new Promise((resolve) =>
        setTimeout(() => {
          results.push(i);
          resolve(i);
        }, i),
      );
    await parallelTasksWithTimeout(5, [100, 500, 300, 200], timeout);
    expect(results).toEqual([100, 200, 300, 500]);
  });

  it('stop running tasks after timeout', async () => {
    const results: number[] = [];
    const timeout = (i: number) =>
      new Promise((resolve) =>
        setTimeout(() => {
          results.push(i);
          resolve(i);
        }, i),
      );
    await parallelTasksWithTimeout(2, [100, 100, 100, 100], timeout, 50);
    expect(results).toEqual([100, 100]);
  });
});
