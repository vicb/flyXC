export type Levels = typeof import('./rootScope').levels[number];

export type Overlays = typeof import('./rootScope').overlays[number];

export type LocalProducts = typeof import('./rootScope').localProducts[number];

export type GlobalProducts = typeof import('./rootScope').globalProducts[number];

export type SeaProducts = typeof import('./rootScope').seaProducts[number];

export type AirQualityProducts = typeof import('./rootScope').airQualityProducts[number];

export type LocalPointProducts = typeof import('./rootScope').localPointProducts[number];

export type GlobalPointProducts = typeof import('./rootScope').globalPointProducts[number];

export type PointProducts = typeof import('./rootScope').pointProducts[number];

export type Products = typeof import('./rootScope').products[number];

export type SupportedLanguages = typeof import('./rootScope').supportedLanguages[number];

export type Pois = keyof typeof import('./rootScope').pois;

export type Isolines = typeof import('./rootScope').isolinesType[number];
