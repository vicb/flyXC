// Vitest setup file for fxc-front.
//
// In Node.js 25/26+, experimental built-in Web Storage (localStorage) is defined on globalThis,
// but evaluates to undefined when running without the --localstorage-file flag. In Vitest with jsdom,
// this shadows jsdom's storage and causes TypeError when accessing localStorage.
// This mock provides an in-memory implementation for tests running on Node 26+.

const storage = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => {
    storage.set(key, String(value));
  },
  removeItem: (key: string) => {
    storage.delete(key);
  },
  clear: () => {
    storage.clear();
  },
  get length() {
    return storage.size;
  },
  key: (index: number) => Array.from(storage.keys())[index] ?? null,
};

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  configurable: true,
  writable: true,
});
