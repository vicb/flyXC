import type { LeafletGlMap } from '@leafletGl';
export declare class Throttler {
    private _workItemEnergyAvailable;
    private _workItems;
    private _map;
    private _interval;
    private _lastFrameTime;
    private _maxRefreshMs;
    /**
     * How much energy is accumulated per frame.
     * This number can also be decimal.
     * A work item consumes 1 energy by default.
     */
    energyPerFrame: number;
    maxAccumulatedEnergy: number;
    constructor(map: LeafletGlMap);
    /**
     * Await this function inside an asynchronous work item that might trigger a long-running task.
     * Returns a promise that resolves once this work item is scheduled to run.
     * This call ensures that only a certain number of items are permitted to run within a given frame.
     *
     * You may optionally pass an abort signal. If the item is aborted, the promise is resolved in the next update.
     * Distinguishing between regular promise resolve and an abort is the caller's responsibility!
     *
     * You may optionally specify a priority for this work item. Default is 0, higher values are scheduled with higher priority.
     *
     * You may optionally specify a weight multiplier for this work item. Default is 1. More work items with lower weights may be executed in a single frame.
     */
    awaitThrottled(abort?: AbortSignal, priority?: number, weight?: number): Promise<void>;
    dispose(): void;
    private _onNewFrame;
}
