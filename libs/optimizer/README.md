# optimizer

## Description

This library scores flight tracks using [rustigc-wasm](https://www.npmjs.com/package/rustigc-wasm).

## Usage

```ts
import { initOptimizer, scoreTrack } from '@flyxc/optimizer';
import wasmUrl from 'rustigc-wasm/rustigc_wasm_bg.wasm?url';

await initOptimizer(wasmUrl);

const result = scoreTrack(points, 'FFVL');
```

The supported league rules are exposed in `scoringRuleNames`.

## Running unit tests

Run `nx test optimizer`.
