/* eslint-disable @typescript-eslint/no-var-requires */
const request = require('request-zero');

import { getFlyMeId } from 'flyxc/run/src/trackers/flyme';

jest.mock('request-zero');

describe('Fetch FlyMe id', () => {
  it('should return an existing user id', async () => {
    request.mockResolvedValue({ code: 200, body: 'ok: 123' });
    const id = await getFlyMeId('foo');
    expect(request).toHaveBeenCalled();
    expect(id).toBe('123');
  });

  it('should return undefined when the user does not exist', async () => {
    request.mockResolvedValue({ code: 200, body: 'invalid username' });
    await expect(async () => await getFlyMeId('foo')).rejects.toThrow(/can not be found/);
  });

  it('should throw on server error', async () => {
    request.mockImplementation(() => {
      throw new Error('Mock Error');
    });
    await expect(async () => await getFlyMeId('foo')).rejects.toThrow(/Flyme server error/i);
  });

  it('should throw when the status code is not 200', async () => {
    request.mockResolvedValue({ code: 500 });
    await expect(async () => await getFlyMeId('foo')).rejects.toThrow(/Flyme server error/);
  });
});
