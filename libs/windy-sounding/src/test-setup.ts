(globalThis as any).W = {
  store: {
    get: vi.fn(),
    set: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  },
  utils: {
    computeDewPointKelvin: vi.fn(),
    loadScript: vi.fn(),
    latLon2str: vi.fn(({ lat, lon }: { lat: number; lon: number }) => `${lat},${lon}`),
  },
  fetch: {
    getPointForecastData: vi.fn(),
  },
  subscription: {
    hasAny: vi.fn().mockReturnValue(false),
  },
  products: {
    ecmwf: { interval: 360 },
  },
  map: {
    map: {
      getCenter: vi.fn().mockReturnValue({ lat: 45, lng: 6 }),
      setZoom: vi.fn(),
    },
  },
  picker: {
    emitter: { on: vi.fn(), off: vi.fn() },
  },
  singleclick: {
    on: vi.fn(),
    off: vi.fn(),
  },
  rootScope: {
    isMobileOrTablet: false,
  },
  userFavs: {
    getAll: vi.fn().mockResolvedValue([]),
  },
  broadcast: {
    on: vi.fn(),
    off: vi.fn(),
  },
  models: {
    getAllPointProducts: vi.fn().mockReturnValue([]),
  },
  location: {
    setUrl: vi.fn(),
  },
};
