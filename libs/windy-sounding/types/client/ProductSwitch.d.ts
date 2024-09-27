import { BindedSwitch } from '@windy/BindedSwitch';
import type { BindedSwitchInitParams } from '@windy/BindedSwitch';
export type ProductSwitchInitParams = {
  showResolution?: boolean;
} & Omit<BindedSwitchInitParams<'product'>, 'bindStore'>;
export declare class ProductSwitch extends BindedSwitch<'product'> {
  showResolution: boolean;
  constructor(params: ProductSwitchInitParams);
  printHTML(
    prods?: (
      | 'icon'
      | 'satellite'
      | 'radar'
      | 'drought'
      | 'capAlerts'
      | 'gfs'
      | 'ecmwf'
      | 'ecmwfAnalysis'
      | 'ecmwfAifs'
      | 'ecmwfWaves'
      | 'gfsWaves'
      | 'iconWaves'
      | 'cams'
      | 'efi'
      | 'cmems'
      | 'fireDanger'
      | 'activeFires'
      | 'nems'
      | 'namConus'
      | 'namHawaii'
      | 'namAlaska'
      | 'iconEu'
      | 'iconD2'
      | 'arome'
      | 'aromeAntilles'
      | 'aromeReunion'
      | 'canHrdps'
      | 'canRdwpsWaves'
      | 'camsEu'
      | 'iconEuWaves'
      | 'hrrrAlaska'
      | 'hrrrConus'
      | 'bomAccess'
      | 'ukv'
      | 'jmaMsm'
      | 'jmaCwmWaves'
      | 'mblue'
    )[],
  ): void;
  /**
   * The menu is already in a DOM since we do not modify products so often
   */
  protected redraw(): void;
}
