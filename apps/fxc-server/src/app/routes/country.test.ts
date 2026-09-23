import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

import { handleCountryRequest } from './country';

describe('handleCountryRequest', () => {
  it('should return x-appengine-country when provided', () => {
    const req = {
      headers: {
        'x-appengine-country': 'fr',
      },
      query: {},
    } as unknown as Request;

    const res = {
      set: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;

    handleCountryRequest(req, res);

    expect(res.set).toHaveBeenCalledWith('Cache-Control', 'private, max-age=86400');
    expect(res.json).toHaveBeenCalledWith({ country: 'FR' });
  });

  it('should return cf-ipcountry as fallback', () => {
    const req = {
      headers: {
        'cf-ipcountry': 'es',
      },
      query: {},
    } as unknown as Request;

    const res = {
      set: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;

    handleCountryRequest(req, res);

    expect(res.json).toHaveBeenCalledWith({ country: 'ES' });
  });

  it('should support country query param in non-production', () => {
    const req = {
      headers: {},
      query: { country: 'it' },
    } as unknown as Request;

    const res = {
      set: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;

    handleCountryRequest(req, res);

    expect(res.json).toHaveBeenCalledWith({ country: 'IT' });
  });

  it('should default to FR in non-production when no header or query param is given', () => {
    const req = {
      headers: {},
      query: {},
    } as unknown as Request;

    const res = {
      set: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;

    handleCountryRequest(req, res);

    expect(res.json).toHaveBeenCalledWith({ country: 'FR' });
  });
});
