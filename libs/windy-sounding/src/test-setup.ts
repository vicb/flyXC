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
    singleclick: { on: vi.fn(), off: vi.fn() },
    on: vi.fn(),
    off: vi.fn(),
  },
  rootScope: {
    isMobileOrTablet: false,
    levelsData: {
      surface: ['', '', 0, 0],
      '100m': ['100 m', '100m', 100, 300],
      '975h': ['975 hPa', '975h', 300, 1000],
      '950h': ['950 hPa', '950h', 600, 2000],
      '925h': ['925 hPa', '925h', 750, 2500],
      '900h': ['900 hPa', '900h', 1000, 3000],
      '850h': ['850 hPa', '850h', 1500, 5000],
      '800h': ['800 hPa', '800h', 2000, 6400],
      '700h': ['700 hPa', '700h', 3000, 10000],
      '600h': ['600 hPa', '600h', 4200, 14000],
      '500h': ['500 hPa', '500h', 5500, 18000],
      '400h': ['400 hPa', '400h', 7000, 24000],
      '300h': ['300 hPa', '300h', 9000, 30000],
      '250h': ['250 hPa', '250h', 10400, 34000],
      '200h': ['200 hPa', '200h', 11800, 39000],
      '150h': ['150 hPa', '150h', 13500, 45000],
      '10h': ['10 hPa', '10h', 30000, 100000],
    },
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
  metrics: {
    temp: {
      conv: {
        '°C': { conversion: (t: number) => t - 273.15 },
        '°F': { conversion: (t: number) => (t - 273.15) * 1.8 + 32 },
        K: { conversion: (t: number) => t },
      },
    },
    altitude: {
      conv: {
        m: { conversion: (a: number) => a },
        ft: { conversion: (a: number) => a * 3.28084 },
      },
    },
    pressure: {
      conv: {
        hPa: { conversion: (p: number) => p / 100 },
        mmHg: { conversion: (p: number) => p * 0.00750062 },
        inHg: { conversion: (p: number) => p * 0.0002953 },
      },
    },
    wind: {
      conv: {
        'km/h': { conversion: (w: number) => w * 3.6 },
        kt: { conversion: (w: number) => w * 1.94384 },
        mph: { conversion: (w: number) => w * 2.23694 },
        bft: { conversion: (w: number) => w },
      },
    },
  },
};
