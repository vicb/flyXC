/* eslint-disable @typescript-eslint/no-var-requires */
const request = require('request-zero');

import { getFlyMeId, resolveAccount } from 'flyxc/run/src/trackers/flyme';

jest.mock('request-zero');

describe('Fetch FlyMe id', () => {
  it('should return an existing user id', async () => {
    request.mockResolvedValue({ code: 200, body: 'ok: 123' });
    const id = await getFlyMeId('foo');
    expect(request).toHaveBeenCalled();
    expect(id).toBe(123);
  });

  it('should return undefined when the user does not exist', async () => {
    request.mockResolvedValue({ code: 200, body: 'invalid username' });
    const id = await getFlyMeId('foo');
    expect(request).toHaveBeenCalled();
    expect(id).toBe(undefined);
  });

  it('should throw on server error', async () => {
    request.mockImplementation(() => {
      throw new Error('Mock Error');
    });
    await expect(async () => await getFlyMeId('foo')).rejects.toThrow(/Server error/i);
  });

  it('should throw when the status code is not 200', async () => {
    request.mockResolvedValue({ code: 500 });
    await expect(async () => await getFlyMeId('foo')).rejects.toThrow(/500/);
  });
});

describe('Fetch FlyMe id', () => {
  let error: any;

  beforeAll(() => {
    // Remove expected console.error calls from the output.
    error = console.error;
    console.error = jest.fn();
  });

  afterAll(() => {
    console.error = error;
  });

  it('should resolve the account when username exists', async () => {
    request.mockResolvedValue({ code: 200, body: 'ok: 123' });
    const account = await resolveAccount({ value: 'foo' });
    expect(JSON.parse(account as string)).toEqual({
      value: 'foo',
      id: 123,
    });
  });

  it('should disable the account when username does not exist', async () => {
    request.mockResolvedValue({ code: 200, body: 'invalid username' });
    const account = await resolveAccount({ value: 'foo' });
    expect(account).toBe(false);
  });

  it('should record retry on error', async () => {
    request.mockImplementation(() => {
      throw new Error('Mock Error');
    });
    let account = await resolveAccount({ value: 'foo' });
    expect(JSON.parse(account as string)).toEqual({
      value: 'foo',
      retries: 1,
    });
    account = await resolveAccount({ value: 'foo', retries: 1 });
    expect(JSON.parse(account as string)).toEqual({
      value: 'foo',
      retries: 2,
    });
  });

  it('should be able to resolve an account after a retry', async () => {
    request.mockImplementation(() => {
      throw new Error('Mock Error');
    });
    let account = await resolveAccount({ value: 'foo' });
    expect(JSON.parse(account as string)).toEqual({
      value: 'foo',
      retries: 1,
    });
    account = await resolveAccount({ value: 'foo', retries: 1 });
    expect(JSON.parse(account as string)).toEqual({
      value: 'foo',
      retries: 2,
    });
    request.mockResolvedValue({ code: 200, body: 'ok: 123' });
    account = await resolveAccount({ value: 'foo', retries: 1 });
    expect(JSON.parse(account as string)).toEqual({
      value: 'foo',
      id: 123,
    });
  });

  it('should disable an account after too many retries', async () => {
    request.mockImplementation(() => {
      throw new Error('Mock Error');
    });
    const account = await resolveAccount({ value: 'foo', retries: 100 });
    expect(account).toBe(false);
  });
});
