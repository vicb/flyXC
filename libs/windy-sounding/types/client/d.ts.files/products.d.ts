import { AromeProduct } from '@windy/AromeProduct';
import { EcmwfAnalysisProduct } from '@windy/EcmwfAnalysisProduct';
import { EcmwfProduct } from '@windy/EcmwfProduct';
import { Product } from '@windy/Product';
import { SatelliteProduct } from '@windy/SatelliteProduct';
import { Products } from '@windy/rootScope.d';

export type products = Implements<
  { [P in Products]: Product },
  {
    bomAccess: Product;
    mblue: Product;
    ecmwf: EcmwfProduct;
    ecmwfWaves: Product;
    ecmwfAifs: Product;
    ecmwfAnalysis: EcmwfAnalysisProduct;
    canHrdps: Product;
    canRdwpsWaves: Product;
    cams: Product;
    camsEu: Product;
    cmems: Product;
    gfs: Product;
    gfsWaves: Product;
    icon: Product;
    iconD2: Product;
    iconEu: Product;
    iconEuWaves: Product;
    iconWaves: Product;
    arome: Product;
    aromeAntilles: AromeProduct;
    aromeReunion: AromeProduct;
    nems: Product;
    namAlaska: Product;
    namConus: Product;
    namHawaii: Product;
    capAlerts: Product;
    efi: Product;
    radar: Product;
    satellite: SatelliteProduct;
    hrrrAlaska: Product;
    hrrrConus: Product;
    ukv: Product;
    drought: Product;
    fireDanger: Product;
    activeFires: Product;
    jmaMsm: Product;
    jmaCwmWaves: Product;
  }
>;
