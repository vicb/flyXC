export type CloseDbListener = () => void;
export declare class IdbConnection {
    private readonly databaseName;
    private dbPromise;
    private closeDbListeners;
    constructor(databaseName: string);
    onCloseDb(listener: CloseDbListener): void;
    getDb(): Promise<IDBDatabase>;
    deleteDb(): Promise<void>;
    private closeDb;
    private connect;
    private createFailHandler;
}
