# @flyxc/windy-types

Clean, zero-config TypeScript definitions for Windy plugins extracted from [`@windycom/plugin-devtools`](https://www.npmjs.com/package/@windycom/plugin-devtools).

## What This Package Is

This library packages the TypeScript type definitions from Windy's official devtools into an isolated, zero-dependency workspace package:

- **Zero dependencies**: Does not install or depend on any of `@windycom/plugin-devtools`'s heavy tooling dependencies (Rollup, Svelte, dev servers, etc.).
- **Ambient `@windy/*` modules**: Automatically generates declarations for all `@windy/*` virtual modules (e.g. `@windy/interfaces`, `@windy/favs`, `@windy/store`), including internal `.d` module aliases.
- **Global `W` API**: Strongly types the global `W` Windy API instance.
- **No tsconfig hacks needed**: Consumers can consume types directly without `tsconfig.json` `paths` mappings, manual `.d.ts` patches, or build-time generation scripts.

## How to Use

1. Add `@flyxc/windy-types` to the consumer library's dependencies in `package.json`:

   ```json
   {
     "dependencies": {
       "@flyxc/windy-types": "workspace:*"
     }
   }
   ```

2. Add `@flyxc/windy-types` to `types` in `tsconfig.lib.json` (or `tsconfig.json`):

   ```json
   {
     "compilerOptions": {
       "types": ["@flyxc/windy-types"]
     }
   }
   ```

3. Import from `@windy/*` or use global `W` directly in your code:

   ```typescript
   import type { LatLon } from '@windy/interfaces';
   import type { Fav } from '@windy/favs';

   const windyFetch = W.fetch;
   ```

## How to Update

The package includes an automated update target configured in Nx.

### Update to Latest Version

To fetch and extract types from the latest release of `@windycom/plugin-devtools`:

```bash
pnpm nx run windy-types:update
```

### Update to a Specific Version

To update to a specific upstream version:

```bash
pnpm nx run windy-types:update --args="3.0.4"
```

### Update from a Local Directory

If working offline or testing custom upstream types:

```bash
pnpm nx run windy-types:update --args="--local /path/to/extracted/types"
```

### What the Update Process Does

When executed, the update process:

1. Downloads `@windycom/plugin-devtools` using `npm pack` into an isolated temporary folder (without running `npm install` or pulling dependencies).
2. Extracts `package/types/` as pristine source files into `src/types/` without any modification or formatting.
3. Generates `src/windy-exports.d.ts` from pristine `types/client/commonExports.d.ts` mapping modules to clean exports.
4. Generates `src/index.d.ts` with ambient `@windy/*` module declarations and global `W` typing.
5. Records the source package version in the `src/index.d.ts` header.
6. Synchronizes the version in `libs/windy-types/package.json` with the upstream source package version.
7. Formats and lints the generated files using `pnpm nx format` and `pnpm nx run windy-types:lint --fix`.
