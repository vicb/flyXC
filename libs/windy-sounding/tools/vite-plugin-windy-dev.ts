import type { Plugin } from 'vite';

export interface WindyDevPluginOptions {
  /**
   * The port of the development server that Windy will fetch modules from.
   * Defaults to 9999.
   */
  port?: number;
  /**
   * The origin of the development server that Windy will fetch modules from.
   * Defaults to 'https://localhost:<port>'.
   */
  origin?: string;
}

/**
 * Vite plugin enabling local development and Hot Module Replacement (HMR)
 * for Windy plugins loaded externally via `https://www.windy.com/dev`.
 *
 * ### Architectural Context:
 * Standard Vite applications serve an `index.html` file on `localhost` which
 * automatically injects `<script type="module" src="/@vite/client"></script>`
 * and resolves root-relative ES module specifiers (`/...`) against `localhost`.
 *
 * In contrast, a Windy plugin is loaded into an external website (`windy.com`)
 * by dynamically evaluating `import('https://localhost:9999/plugin.js')`.
 *
 * This plugin serves as the network & origin bridge to enable Vite and Preact
 * Fast Refresh inside the external Windy page by handling 5 key requirements:
 *
 * 1. **Virtual Entry Point Mapping:**
 *    Windy expects to fetch `https://localhost:9999/plugin.js`, but the source
 *    entry point is `src/plugin.ts`. This plugin intercepts `/plugin.js` and
 *    compiles `src/plugin.ts` on demand via `server.transformRequest`.
 *
 * 2. **HMR Client Injection:**
 *    Because there is no local `index.html` page loaded by Windy, Vite's `@vite/client`
 *    would never be loaded. This plugin injects `import "https://localhost:9999/@vite/client";`
 *    at the top of `/plugin.js`, establishing the HMR WebSocket connection.
 *
 * 3. **Root-Relative Import Rewriting:**
 *    Vite compiles imports as root-relative paths (e.g. `from "/src/..."` or
 *    `from "/node_modules/..."`). In the browser at `windy.com`, standard paths
 *    resolve against `window.location.origin` (`https://www.windy.com/...`) and fail.
 *    This plugin rewrites those specifiers to point to `https://localhost:9999/...`.
 *
 * 4. **Dynamic HMR Base URL Rewriting:**
 *    In `@vite/client`, dynamic module re-fetching uses `import(base + browserPath + ...)`.
 *    By default, `base` is `"/"`, which would cause HMR updates to be fetched from
 *    `windy.com` and 404. This plugin rewrites `base` in `@vite/client` to
 *    `"https://localhost:9999/"`.
 *
 * 5. **CORS & Preflight Handling:**
 *    Cross-origin requests from `https://windy.com` and `https://www.windy.com`
 *    require CORS headers (`Access-Control-Allow-Origin`) and immediate `204 No Content`
 *    responses for HTTP `OPTIONS` preflight requests.
 */
export const WINDY_ORIGINS = ['https://windy.com', 'https://www.windy.com'];

export function windyDevPlugin(options: WindyDevPluginOptions = {}): Plugin {
  const port = options.port ?? 9999;
  const origin = options.origin ?? `https://localhost:${port}`;

  return {
    name: 'windy-dev-hmr',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        // 1. CORS & Preflight: Allow windy.com, www.windy.com, and sub-module requests without Origin header.
        const requestOrigin = req.headers.origin;
        const isAllowedOrigin =
          !requestOrigin || (typeof requestOrigin === 'string' && WINDY_ORIGINS.includes(requestOrigin));

        if (isAllowedOrigin) {
          res.setHeader('Access-Control-Allow-Origin', requestOrigin ?? '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', '*');
          res.setHeader('Access-Control-Allow-Private-Network', 'true');
          res.setHeader('Vary', 'Origin');
        }

        if (req.method === 'OPTIONS') {
          res.statusCode = isAllowedOrigin ? 204 : 403;
          if (isAllowedOrigin) {
            res.setHeader('Access-Control-Allow-Private-Network', 'true');
          }
          res.end();
          return;
        }

        // Identify plugin entry points, source files, and Vite client requests.
        const isPluginEntry = req.url === '/plugin.js' || req.url?.startsWith('/plugin.js?');
        const isSrc = req.url?.startsWith('/src/');
        const isViteClient = req.url === '/@vite/client' || req.url?.startsWith('/@vite/client?');

        if (isPluginEntry || isSrc || isViteClient) {
          try {
            // 2. Virtual Entry Mapping:
            // Map Windy's expected `/plugin.js` URL to the actual TypeScript entry `/src/plugin.ts`.
            const targetUrl = isPluginEntry ? '/src/plugin.ts' : req.url ?? '';
            const result = await server.transformRequest(targetUrl);
            if (!result) {
              res.statusCode = 404;
              res.end('Not found');
              return;
            }

            // 3. Specifier Rewriting:
            // Rewrite root-relative imports (e.g. `/src/...`, `/node_modules/...`) to absolute
            // dev server URLs so that the browser on windy.com fetches dependencies from localhost.
            let code = result.code
              .replace(/\bfrom\s+(['"])(\/(?!\/))/g, `from $1${origin}/`)
              .replace(/\bimport\s+(['"])(\/(?!\/))/g, `import $1${origin}/`)
              .replace(/\bimport\s*\(\s*(['"])(\/(?!\/))/g, `import($1${origin}/`);

            // 4. HMR Client Base URL:
            // In `@vite/client`, `base` is used by `importUpdatedModule` to fetch modified files:
            //   import(base + browserPath.slice(1) + '?t=' + timestamp)
            // When executing inside windy.com, `base` must be rewritten from "/" to the dev
            // server origin so dynamic HMR imports resolve to localhost:9999 instead of windy.com.
            if (isViteClient) {
              code = code
                .replace(/\bconst base = [^;]+;/, `const base = "${origin}/";`)
                .replace(/\bconst base\$1 = [^;]+;/, `const base$1 = "${origin}/";`);
            }

            // 5. HMR Client Bootstrap:
            // Prepend an import for `@vite/client` into the plugin entry so that loading `/plugin.js`
            // automatically starts the HMR WebSocket connection and runtime on windy.com.
            if (isPluginEntry && !code.includes('@vite/client')) {
              code = `import "${origin}/@vite/client";\n` + code;
            }

            const buf = Buffer.from(code, 'utf-8');
            res.statusCode = 200;
            res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Content-Length', buf.length);
            res.end(buf);
            return;
          } catch (err) {
            next(err);
            return;
          }
        }

        next();
      });
    },
  };
}
