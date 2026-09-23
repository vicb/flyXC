import type { Request, Response } from 'express';
import { Router } from 'express';

import { config } from '../config';

/**
 * Handles GET /api/country requests.
 *
 * Detects the visitor's country using the Google App Engine geolocation header
 * (`x-appengine-country`), falling back to Cloudflare's `cf-ipcountry` header.
 * In development / non-production environments, defaults to 'FR' and supports
 * a `?country=XX` query parameter override for testing.
 *
 * The response is marked as privately cacheable by the browser for 1 day (86400 seconds)
 * so that client browsers only perform the check once per day without shared caches
 * sharing the result across different IP addresses.
 */
export function handleCountryRequest(req: Request, res: Response): void {
  // GAE provides the ISO 3166-1 alpha-2 country code (or 'ZZ' if unknown).
  // Cloudflare also sets cf-ipcountry when proxied.
  let country = (req.headers['x-appengine-country'] as string) || (req.headers['cf-ipcountry'] as string) || '';

  // Allow query param override in development mode to simplify local testing.
  if (!country && !config.production) {
    country = (req.query?.country as string) ?? 'FR';
  }

  // Instruct client browsers to cache the result locally for 1 day (avoid shared caches).
  res.set('Cache-Control', 'private, max-age=86400');
  res.json({ country: country.toUpperCase() });
}

/**
 * Returns the router mounted at /api/country.
 */
export function getCountryRouter(): Router {
  const router = Router();

  router.get('/', handleCountryRequest);

  return router;
}
