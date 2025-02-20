import { AccessProduct, AccessCProduct } from '@windy/AccessProducts';
import { AromeProduct } from '@windy/AromeProduct';
import { EcmwfAnalysisProduct } from '@windy/EcmwfAnalysisProduct';
import { EcmwfProduct } from '@windy/EcmwfProduct';
import { Product } from '@windy/Product';
import { RadarPlusProduct } from '@windy/RadarPlusProduct';
import { SatelliteProduct } from '@windy/SatelliteProduct';

import { Products } from '@windy/rootScope.d';

export type products = Implements<
  { [P in Products]: Product },
  {
    bomAccess: AccessProduct;
    bomAccessAd: AccessCProduct;
    bomAccessBn: AccessCProduct;
    bomAccessDn: AccessCProduct;
    bomAccessNq: AccessCProduct;
    bomAccessPh: AccessCProduct;
    bomAccessSy: AccessCProduct;
    bomAccessVt: AccessCProduct;
    mblue: Product;
    ecmwf: EcmwfProduct;
    ecmwfWaves: Product;
    ecmwfAnalysis: EcmwfAnalysisProduct;
    canHrdps: Product;
    canRdwpsWaves: Product;
    cams: Product;
    camsEu: Product;
    cmems: Product;
    czeAladin: Product;
    gfs: Product;
    gfsWaves: Product;
    icon: Product;
    iconD2: Product;
    iconEu: Product;
    iconEuWaves: Product;
    arome: Product;
    aromeAntilles: AromeProduct;
    aromeFrance: AromeProduct;
    aromeReunion: AromeProduct;
    nems: Product;
    namAlaska: Product;
    namConus: Product;
    namHawaii: Product;
    capAlerts: Product;
    efi: Product;
    radar: Product;
    satellite: SatelliteProduct;
    radarPlus: RadarPlusProduct;
    hrrrAlaska: Product;
    hrrrConus: Product;
    ukv: Product;
    drought: Product;
    fireDanger: Product;
    activeFires: Product;
    jmaMsm: Product;
    jmaCwmWaves: Product;
    topoMap: Product;
  }
>;
