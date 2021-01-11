import { formatReqError } from '../src/util';

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
