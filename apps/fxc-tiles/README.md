# Generate the vector tiles

Install [tippecanoe](https://github.com/felt/tippecanoe) - note that the mapbox repo is unmaintained.

## Airspaces

- `pnpm nx build fxc-tiles`
- `cd apps/fxc-tiles`
- `pnpm run download-airspaces`
- Display stats with `node dist/airspaces/stats.js` (quick check of the airspaces)
- Create the geojson with `node dist/airspaces/create-geojson.js`
  - Assigns sequential 1-based integer `id`s (`id: 1..N`) across all airspaces (with reserved IDs `1..100` for temporal overrides).
  - Sets both top-level `feature.id` and property `id` so tippecanoe preserves native protobuf feature IDs.
  - Simplifies dense airspace boundaries using Ramer-Douglas-Peucker equirectangular simplification (default: 15m tolerance, configurable via `-t, --tolerance`), removing ~90% of redundant curve vertices while preserving visual and spatial fidelity.
- Create the PMTiles archives with `node dist/airspaces/create-tiles.js`
  - Generates 2D PMTiles (zooms 0 to 10) in `assets/tiles/airspaces.pmtiles`.
  - Generates 3D unclipped PMTiles (`-z 6 -Z 6 -pc`) in `assets/tiles/airspaces-3d.pmtiles`.
  - Embeds `{ "date": "YYYY-MM-DD", "timestamp": 1234567890 }` into both archives' PMTiles metadata (`--description`).

### Upload

- Run checks: `pnpm nx reset && pnpm -w run check`
- Ensure `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, and `R2_SECRET_ACCESS_KEY` are set (in `secrets.env` or environment variables)
- Upload both archives to Cloudflare R2: `node dist/airspaces/upload-tiles.js`

## Cloudflare R2 ref

_enable CORS (required for HTTP Range requests)_
`$ pnpm exec wrangler r2 bucket cors set flyxc-airspaces --file=assets/cors.json`

_custom domain & edge caching_

- `airspaces.flyxc.app` is connected to `flyxc-airspaces` with a Cloudflare Cache Rule (`http.host eq "airspaces.flyxc.app"`, **Eligible for cache**, **Origin range requests** enabled, **Respect strong ETags** enabled).

_urls_

- 2D PMTiles: `<https://airspaces.flyxc.app/airspaces.pmtiles>`
- 3D Unclipped PMTiles: `<https://airspaces.flyxc.app/airspaces-3d.pmtiles>`
