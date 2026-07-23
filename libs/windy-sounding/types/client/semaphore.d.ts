export declare class Semaphore {
    private readonly _queue;
    private readonly _capacity;
    private _inside;
    constructor(capacity: number);
    enter(): Promise<void>;
    exit(): void;
}
