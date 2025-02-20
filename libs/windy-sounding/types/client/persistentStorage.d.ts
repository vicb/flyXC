declare class PersistentStorage {
  private readonly internalStorage;
  constructor();
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}
export declare const persistentStorage: PersistentStorage;
export {};
