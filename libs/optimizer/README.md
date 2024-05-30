# optimizer

This library was generated with [Nx](https://nx.dev).

## Description

This library computes scores for flights using applicable rules of various XC leagues.

## Usage

The `src/lib/optimizer.ts#optimize` function computes score of a given track given by a `ScoringTrack` for a given league known by it's `LeagueCode`.

The `optimize` function is a generator function.

It takes an `OptimizationRequest` describing containing the track an some options.

It returns an `Iterator<OptimizationResult,OptimizationResult>`.

You should call the `next()` method of this iterator to get the current `IteratorResult<OptimizationResult, OptimizationResult>`.
The `value` property of the `IteratorResult` gives the current `OptimizationResult` and the `done` property indicates whether the optimization is terminated.

If the `done` property is false, you should call the `next()` method again to get a more optimal result. To get the best optimization, you should repeat the process until `done` is true.

See an example in `optimizer.spec.ts#expectOptimizationIsAsExpected`

## Building

Run `nx build optimizer` to build the library.

## Running unit tests

Run `nx test optimizer` to execute the unit tests via [Jest](https://jestjs.io).
