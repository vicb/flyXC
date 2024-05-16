# optimizer

This library was generated with [Nx](https://nx.dev).

## Description

This library computes scores for flights using applicable rules of various XC leagues.

## Usage

The `src/lib/optimizer.ts#optimize` function computes score of a given track given by a `ScoringTrack` for a given league known by it's `LeagueCode`.
You can specify `OptimizationOptions` to limit either the number of the iterations performed during the optimization (`OptimizationOptions.maxLoop`)
or the maximum duration in milliseconds allowed for the optimization.

The `optimize` function is a generator function. It returns an `Iterator<OptimizationResult,OptimizationResult>`. You should call the `next()`
method of this iterator to get the current `IteratorResult<OptimizationResult, OptimizationResult>`. The `value` property of the `IteratorResult`
gives the current `OptimizationResult` and the `done` property of the `IteratorResult` indicates if the optimization is terminated or not.

If the `done` property is false, you should call again the `next()` method of the iterator so that you get another result that should be a better
optimization result. If you want to get the best optimisation, you should repeat the process until `done` is true.

See an example in `optimizer.spec.ts#expectOptimizationIsAsExpected`

## Building

Run `nx build optimizer` to build the library.

## Running unit tests

Run `nx test optimizer` to execute the unit tests via [Jest](https://jestjs.io).
