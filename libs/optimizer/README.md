# optimizer

## Description

This library scores flight tracks using [rustigc-wasm](https://www.npmjs.com/package/rustigc-wasm).

## Usage

```ts
import { scoreTrack } from '@flyxc/optimizer';

const result = scoreTrack(points, 'FFVL');
```

The supported league rules are exposed in `scoringRuleNames`.

## Running unit tests

Run `nx test optimizer`.
